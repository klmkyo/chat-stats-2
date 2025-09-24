import { Stack } from 'expo-router'

const SettingsLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerLargeTitle: true,
        headerTransparent: true,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="exports" />
    </Stack>
  )
}

export default SettingsLayout
