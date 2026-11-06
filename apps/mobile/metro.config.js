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

// KI-12: Expo Router's query-string 7 uses decode-uri-component 0.2.2, whose malformed-input
// fallback is quadratic (GHSA-qr28-fpjm-wq7f). Resolve it to a linear-time local copy so the
// vulnerable code is not bundled. Remove with the Expo SDK 58 upgrade.
const safeDecoder = path.join(__dirname, 'shims/decode-uri-component.js');
config.resolver.resolveRequest = (context, moduleName, platform) =>
  moduleName === 'decode-uri-component'
    ? { type: 'sourceFile', filePath: safeDecoder }
    : context.resolveRequest(context, moduleName, platform);

module.exports = config;
