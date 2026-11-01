
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Support SQLite WebAssembly
config.resolver.assetExts.push('wasm');

// Required headers for SQLite on Web
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader(
        'Cross-Origin-Embedder-Policy',
        'credentialless'
      );
      res.setHeader(
        'Cross-Origin-Opener-Policy',
        'same-origin'
      );

      return middleware(req, res, next);
    };
  },
};

module.exports = config;
