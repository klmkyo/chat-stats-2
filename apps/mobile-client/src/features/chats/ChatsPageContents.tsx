import { Button, ButtonText } from '@/common/components/Button'
import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { ThemedText } from '@/common/components/ThemedText'
import { cn } from '@/common/helpers/cn'
import { useAutoMergeSuggestions } from '@/features/chats/hooks/useAutoMergeSuggestions'
import { useIgnoredSuggestionKeys } from '@/features/chats/hooks/useIgnoredSuggestionKeys'
import { EConversationType } from '@/features/db/schema'
import { Link, router } from 'expo-router'
import { ComponentProps, useCallback, useMemo } from 'react'
import { FlatList, View } from 'react-native'
import ContextMenu from 'react-native-context-menu-view'
import { ChatListItem } from './ChatListItem'
import { useChats } from './hooks/useChats'

const MergeActions = ({
  showAutoMerge,
  autoMergeCount,
}: {
  showAutoMerge: boolean
  autoMergeCount: number
}) => {
  return (
    <View className="mb-4 gap-3">
      {showAutoMerge && (
        <Button
          className="w-full bg-primary shadow-lg shadow-primary/40"
          onPress={() => router.push('/merge-suggestions')}
          isLoading
        >
          <IconSymbol name="wand.and.stars" size={18} colorClassName="text-white" />
          <ButtonText className="font-semibold">
            Merge chats from different sources ({autoMergeCount})
          </ButtonText>
        </Button>
      )}

      <Button
        variant="secondary"
        className="w-full"
        onPress={() => router.push('/merge-conversations')}
      >
        <IconSymbol name="person.2.circle" size={18} colorClassName="text-primary" />
        <ButtonText variant="secondary" className="font-semibold">
          Merge chats manually
        </ButtonText>
      </Button>
    </View>
  )
}

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
        <Button className="shadow-lg shadow-primary/40">
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
  const { data: autoSuggestions = [] } = useAutoMergeSuggestions()
  const { keys: ignoredKeys } = useIgnoredSuggestionKeys()
  const ignoredSet = useMemo(() => new Set(ignoredKeys), [ignoredKeys])
  const visibleAutoSuggestions = useMemo(() => {
    return autoSuggestions.filter((suggestion) => !ignoredSet.has(suggestion.id))
  }, [autoSuggestions, ignoredSet])
  const showAutoMerge = visibleAutoSuggestions.length > 0

  const openManualMerge = useCallback((initialId?: number) => {
    router.push(
      initialId
        ? { pathname: '/merge-conversations', params: { initialId: initialId.toString() } }
        : '/merge-conversations',
    )
  }, [])

  if (isEmpty) {
    return <EmptyChatsCTA className="flex-1 p-6" />
  }

  // TODO sorting by last message, message count, alphabetically... Also needs to support filtering by source(s), and by conversation type (DM, group).
  return (
    <FlatList
      contentInsetAdjustmentBehavior="always"
      data={chats}
      renderItem={({ item }) => {
        const isDm = item.type === EConversationType.DM
        return (
          <ContextMenu
            actions={[
              {
                title: 'Merge with other chats',
                systemIcon: 'arrow.merge',
                disabled: !isDm,
                subtitle: isDm ? undefined : 'Only direct messages can be merged',
              },
            ]}
            onPress={(event) => {
              if (event.nativeEvent.index === 0 && isDm) {
                openManualMerge(item.id)
              }
            }}
          >
            <ChatListItem chat={item} />
          </ContextMenu>
        )
      }}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={() => (
        <MergeActions
          showAutoMerge={showAutoMerge}
          autoMergeCount={visibleAutoSuggestions.length}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      showsVerticalScrollIndicator={false}
    />
  )
}
