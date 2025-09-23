const { withNxMetro } = require('@nx/expo')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

module.exports = (async () => {
  const config = getDefaultConfig(__dirname)
  const nxMetroConfig = await withNxMetro(config)
  const nativeWindConfig = withNativeWind(nxMetroConfig, { input: './src/global.css' })
  nativeWindConfig.resolver.sourceExts.push('sql')
  return nativeWindConfig
})()
