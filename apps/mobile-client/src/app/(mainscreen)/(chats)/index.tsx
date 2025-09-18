import { ChatsPageContents } from '@/features/chats/ChatsPageContents'
import { Stack } from 'expo-router'

export default function Index() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Chats',
          headerLargeTitle: true,
          headerTransparent: true,
        }}
      />

      <ChatsPageContents />
    </>
  )
}
