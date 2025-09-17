import { DebugPageContents } from '@/features/debug/DebugPageContents'
import { useDebugEnabled } from '@/common/hooks/useDebugEnabled'
import { Redirect, Stack } from 'expo-router'

export default function DebugIndex() {
  const [debugEnabled] = useDebugEnabled()

  if (!debugEnabled) {
    return <Redirect href="/" />
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Debug',
          headerLargeTitle: true,
          headerTransparent: true,
        }}
      />

      <DebugPageContents />
    </>
  )
}
