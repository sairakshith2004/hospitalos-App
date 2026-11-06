// Metro configuration. The app stays outside the npm workspace (own lockfile, AD-M-011) but reads
// the shared contracts package from source: Metro watches packages/contracts and the one runtime
// dependency it needs (zod, installed at the repository root).
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const repoRoot = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname);

config.watchFolders = [
  path.join(repoRoot, 'packages/contracts'),
  path.join(repoRoot, 'node_modules/zod'),
];
config.resolver.extraNodeModules = {
  '@hospitalos/contracts': path.join(repoRoot, 'packages/contracts/src'),
};

module.exports = config;
