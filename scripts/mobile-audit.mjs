#!/usr/bin/env node
// Mobile dependency audit gate. Fails on any high or critical advisory in apps/mobile unless it is
// listed in scripts/mobile-audit-exceptions.json with a reviewBy date that has not passed.
// Listed advisories are still printed (as GitHub warnings in CI), never hidden.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { exceptions } = JSON.parse(
  readFileSync(join(root, 'scripts/mobile-audit-exceptions.json'), 'utf8'),
);

let raw;
try {
  raw = execFileSync('npm', ['audit', '--json'], {
    cwd: join(root, 'apps/mobile'),
    stdio: ['ignore', 'pipe', 'ignore'],
  });
} catch (error) {
  // npm audit exits non-zero when it finds anything; the report is still on stdout.
  raw = error.stdout;
}
const report = JSON.parse(raw.toString('utf8'));
if (!report.vulnerabilities) {
  console.error('mobile:audit could not read the npm audit report.');
  process.exit(1);
}

// Collect each high or critical advisory once, with the packages it affects.
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
    found.packages.push(name);
    advisories.set(id, found);
  }
}

const today = new Date().toISOString().slice(0, 10);
const inCi = process.env.GITHUB_ACTIONS === 'true';
const blocking = [];
for (const advisory of advisories.values()) {
  const exception = exceptions.find((e) => e.advisory === advisory.id);
  const line = `${advisory.severity} ${advisory.id} (${advisory.packages.join(', ')}): ${advisory.title}`;
  if (advisory.severity !== 'critical' && exception && exception.reviewBy >= today) {
    console.log(`${inCi ? '::warning::' : ''}known, review by ${exception.reviewBy}: ${line}`);
  } else {
    blocking.push(exception ? `${line} [exception expired ${exception.reviewBy}]` : line);
  }
}
const unused = exceptions.filter((e) => !advisories.has(e.advisory)).map((e) => e.advisory);
if (unused.length > 0)
  console.log(`exceptions no longer needed (remove them): ${unused.join(', ')}`);

const counts = report.metadata.vulnerabilities;
console.log(
  `apps/mobile: ${counts.critical} critical, ${counts.high} high, ${counts.moderate} moderate, ${counts.low} low`,
);
if (blocking.length > 0) {
  console.error(
    `mobile:audit failed: ${blocking.length} unclassified high/critical advisory(ies):`,
  );
  for (const line of blocking) console.error(`  ${line}`);
  process.exit(1);
}
console.log('mobile:audit passed (no unclassified high or critical advisories).');
