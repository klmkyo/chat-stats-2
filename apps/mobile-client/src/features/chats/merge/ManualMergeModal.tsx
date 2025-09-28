import { Button, ButtonText } from '@/common/components/Button'
import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { ThemedText } from '@/common/components/ThemedText'
import { useTheme } from '@/common/providers/ThemeProvider'
import { ChatSourceIcons } from '@/features/chats/components/ChatSourceIcons'
import { useChats, type Chat } from '@/features/chats/hooks/useChats'
import {
  formatCompactNumber,
  formatTimestamp,
  getChatDisplayName,
} from '@/features/chats/merge/utils'
import { useCleanupCanonicalConversations } from '@/features/db/hooks/useCleanupCanonicalConversations'
import { useDb } from '@/features/db/hooks/useDb'
import { canonicalConversations, conversations, EConversationType } from '@/features/db/schema'
import { useMutation } from '@tanstack/react-query'
import { eq, inArray, notExists, sql } from 'drizzle-orm'
import { router, useLocalSearchParams } from 'expo-router'
import Fuse from 'fuse.js'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, TextInput, View } from 'react-native'
import Animated, { LinearTransition } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

// TODO too easy to accidentally dismiss this modal
// Also TODO ability to break up canonical conversations into separate canonical conversations

const SelectableConversationRow = ({
  chat,
  selected,
  onPress,
}: {
  chat: Chat
  selected: boolean
  onPress: () => void
}) => {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between gap-3 rounded-3xl bg-card p-4"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-1 gap-1 pr-3">
        <View className="flex-row items-center gap-2">
          <ChatSourceIcons sources={chat.sources} iconSize={16} />
          <ThemedText variant="body" className="font-semibold" numberOfLines={1}>
            {getChatDisplayName(chat)}
          </ThemedText>
        </View>

        <ThemedText variant="caption" color="secondary" numberOfLines={1}>
          {formatCompactNumber(chat.messageCount)} messages ·{' '}
          {formatCompactNumber(chat.participantCount)} people · Latest{' '}
          {formatTimestamp(chat.lastMessageAt)}
        </ThemedText>
      </View>

      <IconSymbol
        name={selected ? 'checkmark.circle.fill' : 'circle'}
        size={24}
        colorClassName={selected ? 'text-primary' : 'text-border'}
      />
    </Pressable>
  )
}

export const ManualMergeModal = () => {
  const { chats } = useChats()
  const db = useDb()
  const { themeColors } = useTheme()
  const { initialId } = useLocalSearchParams<{ initialId?: string }>()
  const cleanupMutation = useCleanupCanonicalConversations()

  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    initialId ? [Number(initialId)] : [],
  )

  const flatListRef = useRef<Animated.FlatList<Chat> | null>(null)

  const deferredSearch = useDeferredValue(search)
  const normalizedSearch = deferredSearch.trim().toLowerCase()

  const dmChats = useMemo(() => chats.filter((chat) => chat.type === EConversationType.DM), [chats])

  const firstSelectedId = useMemo(() => {
    return selectedIds.length > 0 ? selectedIds[0] : null
  }, [selectedIds])

  const orderedChats = useMemo(() => {
    const unselectedChats = dmChats.filter((c) => !selectedIds.includes(c.id))

    // Sort selected chats: maintain selection order, with first selected at top
    const selectedChats = selectedIds
      .map((id) => dmChats.find((c) => c.id === id))
      .filter((c): c is Chat => c !== undefined)

    // Sort unselected chats based on search state
    let sortedUnselected: Chat[]
    if (!normalizedSearch) {
      const firstSelectedChat = selectedChats[0]
      if (firstSelectedChat) {
        const firstSelectedChatDisplayName = getChatDisplayName(
          firstSelectedChat || unselectedChats[0],
        )

        const items = unselectedChats.map((c) => ({ chat: c, query: getChatDisplayName(c) }))
        const fuse = new Fuse(items, {
          threshold: 0.6,
          ignoreLocation: true,
          keys: ['query'],
        })
        const fuzzyMatches = fuse.search(firstSelectedChatDisplayName).map((r) => r.item.chat)
        const remaining = unselectedChats.filter((c) => !fuzzyMatches.includes(c))

        sortedUnselected = [
          ...fuzzyMatches,
          ...remaining.sort((a, b) => b.messageCount - a.messageCount),
        ]
      } else {
        sortedUnselected = unselectedChats.sort((a, b) => b.messageCount - a.messageCount)
      }
    } else {
      // Fuzzy search based on the user search term
      const items = unselectedChats.map((c) => ({ chat: c, query: getChatDisplayName(c) }))
      const fuse = new Fuse(items, {
        threshold: 0.6,
        ignoreLocation: true,
        keys: ['query'],
      })
      const fuzzyMatches = fuse.search(normalizedSearch).map((r) => r.item.chat)
      const remaining = unselectedChats.filter((c) => !fuzzyMatches.includes(c))

      sortedUnselected = [
        ...fuzzyMatches,
        ...remaining.sort((a, b) => b.messageCount - a.messageCount),
      ]
    }

    return [...selectedChats, ...sortedUnselected]
  }, [dmChats, selectedIds, normalizedSearch])

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((selectedId) => selectedId !== id)
      }
      return [...prev, id]
    })

    flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
  }

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (selectedIds.length < 2) {
        throw new Error('Select at least two chats to merge.')
      }
      const targetIdLocal = firstSelectedId
      if (targetIdLocal == null) {
        throw new Error('Select at least two chats to merge.')
      }
      const otherIds = selectedIds.filter((id) => id !== targetIdLocal)

      await db.transaction(async (tx) => {
        await tx
          .update(conversations)
          .set({ canonicalConversationId: targetIdLocal })
          .where(inArray(conversations.canonicalConversationId, otherIds))

        await tx.delete(canonicalConversations).where(inArray(canonicalConversations.id, otherIds))

        const convExists = db
          .select({ one: sql`1` })
          .from(conversations)
          .where(eq(conversations.canonicalConversationId, canonicalConversations.id))

        await tx.delete(canonicalConversations).where(notExists(convExists))
      })
    },
    onSuccess: () => {
      router.back()
      cleanupMutation.mutate()
    },
    onError: (error: unknown) => {
      Alert.alert(
        'We couldn’t merge these chats',
        String(error instanceof Error ? error.message : error),
      )
    },
  })

  const canMerge = selectedIds.length >= 2 && !mergeMutation.isPending

  if (dmChats.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <ThemedText color="secondary" className="text-center">
          Import direct messages from another source to combine chats.
        </ThemedText>
      </View>
    )
  }

  return (
    <View className="flex-1">
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View className="rounded-3xl bg-card p-3" style={{ borderCurve: 'continuous' }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={'Search your chats'}
            placeholderTextColor={`${themeColors.text}66`}
            className="text-base text-text"
          />
        </View>
      </View>

      <Animated.FlatList
        data={orderedChats}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 140, gap: 12 }}
        renderItem={({ item }) => (
          <SelectableConversationRow
            chat={item}
            selected={selectedIds.includes(item.id)}
            onPress={() => toggleSelected(item.id)}
          />
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View className="items-center justify-center p-6">
            <ThemedText color="secondary">No direct messages match your search.</ThemedText>
          </View>
        )}
        itemLayoutAnimation={LinearTransition}
        ref={flatListRef}
      />

      <SafeAreaView className="border-t border-border bg-background p-4">
        <Button disabled={!canMerge} onPress={() => mergeMutation.mutate()} className="w-full">
          {mergeMutation.isPending ? (
            <ButtonText>Merging chats…</ButtonText>
          ) : (
            <>
              <IconSymbol name="arrow.merge" size={18} colorClassName="text-white" />
              <ButtonText className="font-semibold">
                {`Merge ${selectedIds.length} selected chat${selectedIds.length === 1 ? '' : 's'}`}
              </ButtonText>
            </>
          )}
        </Button>
      </SafeAreaView>
    </View>
  )
}
