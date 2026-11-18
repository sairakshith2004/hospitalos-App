#!/usr/bin/env node
// Dependency audit gate. Fails on any high or critical advisory unless it is listed in
// scripts/mobile-audit-exceptions.json and that exception is still in force.
// Listed advisories are still printed (as GitHub warnings in CI), never hidden.
//
//   node scripts/mobile-audit.mjs          apps/mobile (npm run mobile:audit), unchanged behaviour
//   node scripts/mobile-audit.mjs root     root workspace: API, web app, contracts (npm run audit)
//
// Root target rules (stricter than mobile, approved 2026-11-18):
// - The production dependency tree (npm audit --omit=dev) must have no high or critical advisory.
//   Exceptions never apply to it.
// - An exception covers one advisory in one package (`package`), only while every audit entry it
//   reaches is in `allowedDependents`, only while it stays out of production dependencies
//   (`devOnly`), and only before its `expires` date (00:00 UTC; it fails from that day on).
// - Critical advisories are never excepted, on any target.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] ?? 'mobile';
if (target !== 'mobile' && target !== 'root') {
  console.error('usage: node scripts/mobile-audit.mjs [mobile|root]');
  process.exit(2);
}
const label = target === 'mobile' ? 'apps/mobile' : 'root workspace';
const cwd = target === 'mobile' ? join(root, 'apps/mobile') : root;

const file = JSON.parse(readFileSync(join(root, 'scripts/mobile-audit-exceptions.json'), 'utf8'));
const exceptions = file.exceptions.filter((e) => (e.target ?? 'mobile') === target);

// The check date is today (UTC). AUDIT_CHECK_DATE may move it LATER, never earlier, so expiry can
// be tested ahead of time; it can only end exceptions, never revive them.
const realToday = new Date().toISOString().slice(0, 10);
const requested = process.env.AUDIT_CHECK_DATE ?? '';
const today =
  /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested > realToday ? requested : realToday;

function audit(args) {
  let raw;
  try {
    raw = execFileSync('npm', ['audit', '--json', ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (error) {
    // npm audit exits non-zero when it finds anything; the report is still on stdout.
    raw = error.stdout;
  }
  const report = JSON.parse(raw?.toString('utf8') || '{}');
  if (!report.vulnerabilities || !report.metadata) {
    console.error(`audit (${label}) could not read the npm audit report.`);
    process.exit(1);
  }
  return report;
}

/** Each high or critical advisory once, with the packages it directly affects. */
function highAdvisories(report) {
  const advisories = new Map();
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    for (const via of entry.via) {
      if (typeof via !== 'object' || !['high', 'critical'].includes(via.severity)) continue;
      const id = via.url.split('/').pop();
      const found = advisories.get(id) ?? {
        id,
        severity: via.severity,
        title: via.title,
        packages: [],
      };
      if (!found.packages.includes(name)) found.packages.push(name);
      advisories.set(id, found);
    }
  }
  return advisories;
}

/** Every audit entry flagged because it depends, directly or not, on one of `packages`. */
function reachedFrom(report, packages) {
  const reached = new Set(packages);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, entry] of Object.entries(report.vulnerabilities)) {
      if (reached.has(name)) continue;
      if (entry.via.some((via) => typeof via === 'string' && reached.has(via))) {
        reached.add(name);
        grew = true;
      }
    }
  }
  for (const name of packages) reached.delete(name);
  return [...reached].sort();
}

function inForce(exception) {
  if (typeof exception.expires === 'string') return today < exception.expires;
  return typeof exception.reviewBy === 'string' && exception.reviewBy >= today;
}

function lastDay(exception) {
  return exception.expires ? `expires ${exception.expires}` : `review by ${exception.reviewBy}`;
}

const report = audit([]);
const advisories = highAdvisories(report);
const production = target === 'root' ? audit(['--omit=dev']) : undefined;
const productionAdvisories = production ? highAdvisories(production) : new Map();

const inCi = process.env.GITHUB_ACTIONS === 'true';
const blocking = [];

// Root: production dependencies are always enforced, with no exceptions.
for (const advisory of productionAdvisories.values()) {
  blocking.push(
    `${advisory.severity} ${advisory.id} (${advisory.packages.join(', ')}) in PRODUCTION dependencies: ${advisory.title}`,
  );
}

for (const advisory of advisories.values()) {
  const exception = exceptions.find((e) => e.advisory === advisory.id);
  const line = `${advisory.severity} ${advisory.id} (${advisory.packages.join(', ')}): ${advisory.title}`;
  if (!exception) {
    blocking.push(line);
    continue;
  }
  const problems = [];
  if (advisory.severity === 'critical') problems.push('critical advisories are never excepted');
  if (!inForce(exception)) problems.push(`exception ${lastDay(exception)} has passed`);
  if (target === 'root') {
    if (typeof exception.expires !== 'string')
      problems.push('root exceptions need an expires date');
    if (exception.devOnly !== true) problems.push('root exceptions must be devOnly');
    if (!advisory.packages.every((name) => name === exception.package)) {
      problems.push(`affects packages other than ${exception.package}`);
    }
    const allowed = Array.isArray(exception.allowedDependents) ? exception.allowedDependents : [];
    const outside = reachedFrom(report, advisory.packages).filter((n) => !allowed.includes(n));
    if (outside.length > 0) {
      problems.push(`reaches packages outside the approved path: ${outside.join(', ')}`);
    }
    if (productionAdvisories.has(advisory.id)) problems.push('present in production dependencies');
  }
  if (problems.length > 0) {
    blocking.push(`${line} [exception does not apply: ${problems.join('; ')}]`);
  } else {
    console.log(`${inCi ? '::warning::' : ''}known, ${lastDay(exception)}: ${line}`);
  }
}

const unused = exceptions.filter((e) => !advisories.has(e.advisory)).map((e) => e.advisory);
if (unused.length > 0)
  console.log(`exceptions no longer needed (remove them): ${unused.join(', ')}`);

const counts = report.metadata.vulnerabilities;
console.log(
  `${label}: ${counts.critical} critical, ${counts.high} high, ${counts.moderate} moderate, ${counts.low} low`,
);
if (production) {
  const p = production.metadata.vulnerabilities;
  console.log(
    `${label} production dependencies: ${p.critical} critical, ${p.high} high, ${p.moderate} moderate, ${p.low} low`,
  );
}
const name = target === 'mobile' ? 'mobile:audit' : 'audit';
if (blocking.length > 0) {
  console.error(`${name} failed: ${blocking.length} high/critical advisory(ies) not covered:`);
  for (const line of blocking) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`${name} passed (no high or critical advisory outside a valid exception).`);
