import { Button, ButtonText } from '@/common/components/Button'
import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { ThemedText } from '@/common/components/ThemedText'
import { EXPORT_SOURCE_DETAILS } from '@/features/chatapps/constants'
import { ChatSourceIcons } from '@/features/chats/components/ChatSourceIcons'
import { useAutoMergeSuggestions } from '@/features/chats/hooks/useAutoMergeSuggestions'
import { useIgnoredSuggestionKeys } from '@/features/chats/hooks/useIgnoredSuggestionKeys'
import {
  AutoMergeSuggestion,
  formatCompactNumber,
  getChatDisplayName,
} from '@/features/chats/merge/utils'
import { useCleanupCanonicalConversations } from '@/features/db/hooks/useCleanupCanonicalConversations'
import { useDb } from '@/features/db/hooks/useDb'
import { canonicalConversations, conversations } from '@/features/db/schema'
import { useMutation } from '@tanstack/react-query'
import { eq, inArray, notExists, sql } from 'drizzle-orm'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { Alert, FlatList, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const SuggestionCard = ({
  suggestion,
  selected,
  onToggle,
}: {
  suggestion: AutoMergeSuggestion
  selected: boolean
  onToggle: () => void
}) => {
  const suggestionChats = suggestion.chats

  return (
    <Pressable
      onPress={onToggle}
      className="gap-3 rounded-3xl bg-card p-4"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <ThemedText variant="body" className="font-semibold" numberOfLines={1}>
            {getChatDisplayName(suggestion.target)}
          </ThemedText>

          <ThemedText variant="caption" color="secondary">
            {suggestion.chats.length} chats will be combined
          </ThemedText>
        </View>

        <IconSymbol
          name={selected ? 'checkmark.circle.fill' : 'circle'}
          size={24}
          colorClassName={selected ? 'text-primary' : 'text-border'}
        />
      </View>

      <View className="gap-2">
        {suggestionChats.map((chat) => {
          const sourceLabel = chat.sources
            .map((source) => EXPORT_SOURCE_DETAILS[source]?.name ?? source)
            .join(', ')

          return (
            <View key={chat.id} className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 pr-4">
                <ChatSourceIcons sources={chat.sources} iconSize={16} />
                <ThemedText variant="body" className="flex-1" numberOfLines={1}>
                  {getChatDisplayName(chat)}
                </ThemedText>
              </View>

              <View className="items-end">
                <ThemedText variant="caption" color="secondary" numberOfLines={1}>
                  {formatCompactNumber(chat.messageCount)} messages
                </ThemedText>
                {sourceLabel ? (
                  <ThemedText
                    variant="caption"
                    color="secondary"
                    className="text-xs"
                    numberOfLines={1}
                  >
                    {sourceLabel}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>
    </Pressable>
  )
}

export const SuggestedMergesModal = () => {
  const { data: suggestions = [] } = useAutoMergeSuggestions()
  const { keysSet: ignoredSet, toggle } = useIgnoredSuggestionKeys()

  const db = useDb()
  const cleanupMutation = useCleanupCanonicalConversations()

  const mergeableSuggestions = useMemo(
    () => suggestions.filter((suggestion) => !ignoredSet.has(suggestion.id)),
    [suggestions, ignoredSet],
  )

  const mergeMutation = useMutation({
    mutationFn: async () => {
      await db.transaction(async (tx) => {
        for (const suggestion of mergeableSuggestions) {
          const otherIds = suggestion.chats
            .filter((chat) => chat.id !== suggestion.target.id)
            .map((chat) => chat.id)

          if (otherIds.length === 0) continue

          await tx
            .update(conversations)
            .set({ canonicalConversationId: suggestion.target.id })
            .where(inArray(conversations.canonicalConversationId, otherIds))

          await tx
            .delete(canonicalConversations)
            .where(inArray(canonicalConversations.id, otherIds))
        }

        // Remove canonical conversations with no conversations
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

  const handleMerge = () => {
    mergeMutation.mutate()
  }

  const renderSuggestion = ({ item }: { item: AutoMergeSuggestion }) => (
    <SuggestionCard
      suggestion={item}
      selected={!ignoredSet.has(item.id)}
      onToggle={() => toggle(item.id)}
    />
  )

  if (suggestions.length === 0) {
    return (
      <SafeAreaView className="flex-1" edges={['bottom']}>
        <View className="flex-1 items-center justify-center p-6">
          <ThemedText color="secondary" className="text-center">
            No lookalike chats right now. You can still merge chats manually from the list view.
          </ThemedText>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.id}
        renderItem={renderSuggestion}
        contentContainerClassName="p-4"
        className="py-2"
        ItemSeparatorComponent={() => <View className="h-4" />}
      />

      <SafeAreaView edges={['bottom']} className="border-t border-border bg-background p-4">
        <Button
          variant="primary"
          disabled={mergeableSuggestions.length === 0 || mergeMutation.isPending}
          onPress={handleMerge}
          className="w-full"
          isLoading={mergeMutation.isPending}
        >
          <IconSymbol name="arrow.merge" size={18} colorClassName="text-white" />
          <ButtonText className="font-semibold">
            Merge selected chats ({mergeableSuggestions.length})
          </ButtonText>
        </Button>
      </SafeAreaView>
    </SafeAreaView>
  )
}
