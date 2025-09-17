import { ThemeProvider, useTheme } from '@/common/providers/ThemeProvider'
import { Stack } from 'expo-router'

import '../global.css'

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LayoutInner />
    </ThemeProvider>
  )
}

const LayoutInner = () => {
  const { themeColors } = useTheme()

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: themeColors.background,
        },
        headerTintColor: themeColors.text,
        headerLargeTitle: true,
      }}
    >
      <Stack.Screen name="(mainscreen)" options={{ headerShown: false }} />
    </Stack>
  )
}
