import { SuggestedMergesModal } from '@/features/chats/merge/SuggestedMergesModal'
import { Stack } from 'expo-router'

export default function SuggestedMergesScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerLargeTitle: false,
          headerTitle: 'Suggested merges',
        }}
      />
      <SuggestedMergesModal />
    </>
  )
}
