import { ManualMergeModal } from '@/features/chats/merge/ManualMergeModal'
import { Stack } from 'expo-router'

export default function ManualMergeScreen() {
  return (
    <>
      <Stack.Screen options={{ headerLargeTitle: false }} />
      <ManualMergeModal />
    </>
  )
}
