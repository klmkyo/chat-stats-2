import { Stack } from 'expo-router'

const ChatsLayout = () => {
  return (
    <Stack>
      <Stack.Screen name="import" options={{ presentation: 'modal' }} />
    </Stack>
  )
}

export default ChatsLayout
