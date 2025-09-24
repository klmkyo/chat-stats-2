import { Button, ButtonText } from '@/common/components/Button'
import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { ThemedText } from '@/common/components/ThemedText'
import { cn } from '@/common/helpers/cn'
import { Link } from 'expo-router'
import { ComponentProps } from 'react'
import { FlatList, View } from 'react-native'
import { ChatListItem } from './ChatListItem'
import { useChats } from './hooks/useChats'

export const EmptyChatsCTA = ({ className, ...props }: ComponentProps<typeof View>) => {
  return (
    <View
      {...props}
      className={cn('flex-1 flex-col items-stretch justify-center gap-3', className)}
    >
      <View className="mt-6">
        <ThemedText variant="title" color="secondary">
          No chats imported (yet).
        </ThemedText>

        <ThemedText color="secondary" className="mt-1">
          Add your conversations from WhatsApp, Messenger, Telegram, or other messaging apps to get
          started.
        </ThemedText>
      </View>

      <Link href="/import" asChild className="mt-3">
        <Button>
          <IconSymbol name="plus" size={20} color="white" />
          <ButtonText className="font-semibold">Import Chats</ButtonText>
        </Button>
      </Link>

      <View className="flex-row items-center justify-center gap-1.5">
        <IconSymbol name="lock" size={16} colorClassName="text-text/50" />
        <ThemedText className="text-sm text-text/50">
          Your chats stay on your device - we keep things private.
        </ThemedText>
      </View>
    </View>
  )
}

export const ChatsPageContents = () => {
  const { chats, isEmpty } = useChats()

  if (isEmpty) {
    return <EmptyChatsCTA className="flex-1 p-6" />
  }

  // TODO sorting by last message, message count, alphabetically...
  // TODO merging multiple conversations to be part of the same canonical conversation
  return (
    <FlatList
      contentInsetAdjustmentBehavior="always"
      data={chats}
      renderItem={({ item }) => <ChatListItem chat={item} />}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={{ padding: 16 }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      showsVerticalScrollIndicator={false}
    />
  )
}
