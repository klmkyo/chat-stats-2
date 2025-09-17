import { SettingsPageContents } from '@/features/settings/SettingsPageContents'
import { Stack } from 'expo-router'

export default function Index() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Settings',
          headerLargeTitle: true,
          headerTransparent: true,
        }}
      />

      <SettingsPageContents />
    </>
  )
}
