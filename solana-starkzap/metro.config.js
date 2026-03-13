// metro.config.js
const {getDefaultConfig} = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

const emptyModule = path.resolve(__dirname, 'src/shared/utils/emptyModule.js');
const zlibStub = path.resolve(__dirname, 'src/shared/utils/zlibStub.js');

const joseBrowserDir = path.resolve(
  __dirname,
  'node_modules/.pnpm/jose@4.15.9/node_modules/jose/dist/browser'
);

config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter(ext => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
  unstable_conditionNames: ['react-native', 'require'],
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    crypto: require.resolve('expo-crypto'),
    fs: path.resolve(__dirname, './src/shared/utils/fsPolyfill.js'),
    'text-encoding': require.resolve('text-encoding'),
    stream: require.resolve('stream-browserify'),
    events: require.resolve('events'),
    zlib: zlibStub,
    http: emptyModule,
    https: emptyModule,
    net: emptyModule,
    tls: emptyModule,
    child_process: emptyModule,
    dns: emptyModule,
    url: emptyModule,
    os: emptyModule,
    path: emptyModule,
    util: emptyModule,
    querystring: emptyModule,
  },
  resolveRequest: (context, moduleName, platform) => {
    // Redirect jose to its browser build (avoids Node.js crypto/zlib/util deps)
    if (moduleName === 'jose') {
      return {filePath: path.join(joseBrowserDir, 'index.js'), type: 'sourceFile'};
    }
    // Redirect internal jose node imports to browser equivalents
    if (context.originModulePath && context.originModulePath.includes('/jose/dist/node/')) {
      const browserPath = context.originModulePath.replace('/dist/node/cjs/', '/dist/browser/').replace('/dist/node/esm/', '/dist/browser/');
      if (require('fs').existsSync(browserPath)) {
        return {filePath: browserPath, type: 'sourceFile'};
      }
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
