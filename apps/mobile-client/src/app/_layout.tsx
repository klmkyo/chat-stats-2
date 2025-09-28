import { useUserOnboarded } from '@/common/hooks/useUserOnboarded'
import { ThemeProvider, useTheme } from '@/common/providers/ThemeProvider'
import { router, Stack, usePathname } from 'expo-router'
import { useEffectOnceWhen } from 'rooks'

import { QueryClientProvider } from '@/common/providers/QueryClientProvider'
import { DbProvider } from '@/features/db/DbProvider'
import { Suspense } from 'react'
import { ActivityIndicator } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { configureReanimatedLogger } from 'react-native-reanimated'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import '../global.css'

export const unstable_settings = {
  initialRouteName: '(mainscreen)',
}

configureReanimatedLogger({
  strict: false,
})

const LayoutInner = () => {
  const { themeColors } = useTheme()

  const [userOnboarded = false] = useUserOnboarded()
  const pathname = usePathname()

  useEffectOnceWhen(() => {
    setTimeout(() => {
      router.push('/welcome')
    }, 0)
  }, !userOnboarded && pathname !== '/welcome')

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

      <Stack.Screen
        name="welcome"
        options={{
          presentation: 'modal',
          gestureEnabled: false,
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="import"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="merge-suggestions"
        options={{
          presentation: 'modal',
          headerTitle: 'Merge Suggestions',
        }}
      />

      <Stack.Screen
        name="merge-conversations"
        options={{
          presentation: 'modal',
          headerTitle: 'Merge Conversations',
        }}
      />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        {/* TODO splashcreen? */}
        <Suspense fallback={<ActivityIndicator size="large" />}>
          <SafeAreaProvider>
            <QueryClientProvider>
              <DbProvider>
                <LayoutInner />
              </DbProvider>
            </QueryClientProvider>
          </SafeAreaProvider>
        </Suspense>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
