import { ImportModal } from '@/features/chats/components/ImportModal'
import { Stack } from 'expo-router'

export default function ImportMessengerModalScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: 'Import Chats',
        }}
      />
      <ImportModal />
    </>
  )
}
