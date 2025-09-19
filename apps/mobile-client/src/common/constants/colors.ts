import { hexToRgb } from '@/common/helpers/colors'
import { fromEntries, getEntries } from '@/common/helpers/object'
import { DarkTheme, DefaultTheme } from '@react-navigation/native'
import { vars } from 'nativewind'

export type Theme = 'light' | 'dark'

// Make sure to update tailwind.config.js when updating this
export const ColorThemesHex = {
  light: {
    primary: '#AD4FFF',
    background: '#FFFFFF',
    card: '#F2F2F7',
    text: '#000000',
    border: '#C6C6C8',
    notification: '#FF3B30',
  },
  dark: {
    primary: '#AD4FFF',
    background: '#202020',
    card: '#1C1C1E',
    text: '#FFFFFF',
    border: '#38383A',
    notification: '#FF453A',
  },
} as const

export const ColorThemesCssVariables = fromEntries(
  getEntries(ColorThemesHex).map(([theme, colors]) => [
    theme,
    vars(
      fromEntries(getEntries(colors).map(([key, value]) => [`--color-${key}`, hexToRgb(value)])),
    ),
  ]),
)

export const RNNThemes = {
  light: {
    ...DefaultTheme,
    colors: {
      ...ColorThemesHex.light,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...ColorThemesHex.dark,
    },
  },
} as const
