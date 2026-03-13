module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    '@babel/plugin-transform-export-namespace-from',
    'react-native-reanimated/plugin',
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: process.env.ENVFILE || '.env',
        safe: false,
        allowUndefined: true,
      },
    ],
  ],
  overrides: [
    {
      test: /web-streams-polyfill/,
      plugins: [
        ['@babel/plugin-transform-runtime', {helpers: false, regenerator: false}],
      ],
    },
  ],
  env: {
    production: {
      plugins: ['transform-remove-console'],
    },
  },
};
