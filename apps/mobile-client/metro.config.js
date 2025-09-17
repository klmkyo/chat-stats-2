const { withNxMetro } = require('@nx/expo')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const defaultConfig = getDefaultConfig(__dirname)

const nxMetroPromise = withNxMetro(defaultConfig)

module.exports = nxMetroPromise.then(config =>
  withNativeWind(config, { input: './src/global.css' })
)
