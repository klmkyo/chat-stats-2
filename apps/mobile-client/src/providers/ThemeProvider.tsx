import { ColorThemesCssVariables, ColorThemesHex, RNNThemes, Theme } from '@/constants/colors'
import { ThemeProvider as RNNThemeProvider } from '@react-navigation/native'
import { useColorScheme } from 'nativewind'
import React, { createContext, useContext, useMemo } from 'react'
import { View } from 'react-native'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme | 'system') => void
  themeColors: (typeof ColorThemesHex)[Theme]
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { colorScheme: systemColorScheme, setColorScheme } = useColorScheme()

  const adjustedTheme: Theme = systemColorScheme ?? 'light'

  const themeColors = ColorThemesHex[adjustedTheme]
  const cssColors = ColorThemesCssVariables[adjustedTheme]

  const rnnTheme = useMemo(() => {
    return RNNThemes[adjustedTheme]
  }, [adjustedTheme])

  const contextValue: ThemeContextType = {
    theme: adjustedTheme,
    setTheme: setColorScheme,
    themeColors,
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      <RNNThemeProvider value={rnnTheme}>
        <View style={[cssColors]} className="flex-1">
          {children}
        </View>
      </RNNThemeProvider>
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
