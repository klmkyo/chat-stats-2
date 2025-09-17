import { ThemeProvider, useTheme } from '@/providers/ThemeProvider'
import { Stack } from 'expo-router'

import '../global.css'

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LayoutInner />
    </ThemeProvider>
  )
}

const themeColors = {
  dark: {
    backgroundColor: 'black',
    textColor: 'white',
  },
  light: {
    backgroundColor: 'white',
    textColor: 'black',
  },
}

const LayoutInner = () => {
  const { theme } = useTheme()

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: themeColors[theme].backgroundColor,
        },
        headerTintColor: themeColors[theme].textColor,
      }}
    />
  )
}
