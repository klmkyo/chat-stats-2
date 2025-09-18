import { Redirect, Stack } from 'expo-router'

import { useDebugEnabled } from '@/common/hooks/useDebugEnabled'
import { DebugPageContents } from '@/features/debug/DebugPageContents'

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
