import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { Stack, useRouter } from 'expo-router'
import { Pressable } from 'react-native'

export default function ImportModalLayout() {
  const router = useRouter()
  return (
    <Stack screenOptions={{}}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Import Chats',
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              className="size-10 flex items-center justify-center"
            >
              <IconSymbol name="xmark" weight="semibold" />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="messenger" />
    </Stack>
  )
}
