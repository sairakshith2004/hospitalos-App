#!/usr/bin/env node
// Isolation check (ISO-1). Renders the Compose configuration and verifies its project, network,
// volume and port names, printing NAMES AND PORTS ONLY. A plain `docker compose config` would
// print the passwords from .env, so never paste its full output anywhere.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = execFileSync(
  'docker',
  ['compose', '-p', 'hospitalos-mobile', 'config', '--format', 'json'],
  { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] },
).toString('utf8');
const config = JSON.parse(raw);

const expected = {
  project: 'hospitalos-mobile',
  services: ['db'],
  volume: 'hospitalos-mobile-pgdata',
  network: 'hospitalos-mobile-network',
  container: 'hospitalos-mobile-db',
  ports: ['127.0.0.1:5433->5432/tcp'],
};

const db = config.services?.db ?? {};
const actual = {
  project: config.name,
  services: Object.keys(config.services ?? {}),
  volume: Object.values(config.volumes ?? {}).map((v) => v.name)[0],
  network: Object.values(config.networks ?? {}).map((n) => n.name)[0],
  ports: (db.ports ?? []).map(
    (p) => `${p.host_ip}:${p.published}->${p.target}/${p.protocol ?? 'tcp'}`,
  ),
  container: db.container_name,
  image: db.image,
  restart: db.restart,
};

console.log(JSON.stringify(actual, null, 2));

const problems = [];
if (actual.project !== expected.project) problems.push('project name');
if (JSON.stringify(actual.services) !== JSON.stringify(expected.services))
  problems.push('services');
if (actual.volume !== expected.volume) problems.push('volume name');
if (actual.network !== expected.network) problems.push('network name');
if (actual.container !== expected.container) problems.push('container name');
if (actual.restart !== 'no') problems.push('restart policy (must be "no")');
if (JSON.stringify(actual.ports) !== JSON.stringify(expected.ports)) problems.push('ports');
if (!/^postgres:17\.11-bookworm@sha256:[0-9a-f]{64}$/.test(actual.image ?? ''))
  problems.push('image pin');
for (const name of [actual.project, actual.volume, actual.network, actual.container]) {
  if (/^hospitalos[_-](?!mobile)/.test(name ?? '') || name === 'hospitalos') {
    problems.push(`name ${name} collides with the reference project`);
  }
}

if (problems.length > 0) {
  console.error(`iso:check failed: ${problems.join(', ')}`);
  process.exit(1);
}
console.log('iso:check passed.');
