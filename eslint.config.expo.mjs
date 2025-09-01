// https://docs.expo.dev/guides/using-eslint/
import expoConfig from 'eslint-config-expo/flat.js';
import baseConfig from './eslint.config.base.mjs';

export default [
  ...baseConfig,
  ...expoConfig,
  {
    ignores: ['dist/*'],
  },
];
