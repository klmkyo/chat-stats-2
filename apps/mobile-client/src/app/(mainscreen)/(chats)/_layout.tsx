import { Stack } from 'expo-router'

const ChatsLayout = () => {
  return (
    <Stack>
      <Stack.Screen
        name="import"
        // TODO maybe half open sheet
        options={{ presentation: 'modal', headerShown: false }}
        getId={() => 'import'}
      />
    </Stack>
  )
}

export default ChatsLayout
