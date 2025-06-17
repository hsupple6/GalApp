const webpack = require('webpack');

module.exports = function override(config, env) {
  // Add polyfills
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer/"),
    "path": require.resolve("path-browserify"),
    "fs": false
  };

  // Add buffer plugin
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ];

  // Update CSP for external scripts
  if (config.devServer) {
    config.devServer = {
      ...config.devServer,
      headers: {
        ...config.devServer.headers,
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: http://localhost:* ws://localhost:* https://js.stripe.com https://*.stripe.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://js.stripe.com https://*.stripe.com;"
      }
    };
  }

  // Handle external script loading
  config.module.rules.push({
    test: /\.js$/,
    enforce: 'pre',
    use: ['source-map-loader'],
  });

  return config;
}; 