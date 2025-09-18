// https://docs.expo.dev/guides/using-eslint/
import pluginQuery from '@tanstack/eslint-plugin-query'
import expoConfig from '../../eslint.config.expo.mjs'

export default [...pluginQuery.configs['flat/recommended'], ...expoConfig]
