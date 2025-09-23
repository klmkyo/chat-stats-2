import { Button, ButtonText } from '@/common/components/Button'
import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { ThemedText } from '@/common/components/ThemedText'
import { useHeaderHeight } from '@react-navigation/elements'
import { useRouter } from 'expo-router'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export const ChatsPageContents = () => {
  const router = useRouter()
  const headerHeight = useHeaderHeight()

  const isEmpty = true

  if (isEmpty) {
    return (
      <SafeAreaView
        style={{ marginTop: headerHeight }}
        className="p-6 flex-1 flex-col items-stretch justify-center mb-28 gap-3"
      >
        <View className="mt-6">
          <ThemedText variant="title" color="secondary">
            No chats imported (yet).
          </ThemedText>

          <ThemedText color="secondary" className="mt-1">
            Add your conversations from WhatsApp, Messenger, Telegram, or other messaging apps to
            get started.
          </ThemedText>
        </View>

        <Button onPress={() => router.push('/import')}>
          <IconSymbol name="plus" size={20} color="white" />
          <ButtonText className="font-semibold">Import Chats</ButtonText>
        </Button>

        <View className="flex-row items-center justify-center gap-1.5">
          <IconSymbol name="lock" size={16} colorClassName="text-text/50" />
          <ThemedText className="text-sm text-text/50">
            Your chats stay on your device - we keep things private.
          </ThemedText>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <ThemedText color="secondary">chatz</ThemedText>
    </ScrollView>
  )
}
