#!/usr/bin/env node
// Fails if a secret appears in any file Git tracks or would track (tracked + untracked, not
// ignored). Run locally and first in CI. Prints file and line only, never the matched value.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

// Values that are clearly placeholders are allowed (templates, docs and tests).
const PLACEHOLDER = /change-me|placeholder|example|<[^>]*>|\$\{|xxxx|\*\*\*/i;

const RULES = [
  { name: 'private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: 'connection string with password',
    pattern: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s/'"]+:([^@\s'"]+)@/,
  },
  {
    name: 'secret assignment',
    pattern: /\b[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|PEPPER)\s*=\s*['"]?([^\s'"#]{12,})/,
  },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
];

const SKIP = [/(^|\/)package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|icon)$/i];

const findings = [];
for (const file of files) {
  if (SKIP.some((re) => re.test(file))) continue;
  if (/(^|\/)\.env$/.test(file) || /(^|\/)\.env\.(?!example$)/.test(file)) {
    findings.push(`${file}: environment file is not ignored by Git`);
    continue;
  }
  const path = join(root, file);
  let text;
  try {
    if (statSync(path).size > 2_000_000) continue;
    text = readFileSync(path, 'utf8');
  } catch {
    continue; // deleted in the working tree
  }
  text.split('\n').forEach((line, index) => {
    for (const rule of RULES) {
      const match = rule.pattern.exec(line);
      if (!match) continue;
      const value = match[1] ?? match[0];
      if (PLACEHOLDER.test(value) || PLACEHOLDER.test(line)) continue;
      findings.push(`${file}:${index + 1}: possible ${rule.name}`);
    }
  });
}

if (findings.length > 0) {
  console.error(`secrets:check found ${findings.length} problem(s):\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`secrets:check passed (${files.length} files scanned).`);
