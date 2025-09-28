import { EExportSource } from '@/features/chatapps/constants'
import { EConversationType } from '@/features/db/schema'
import { Chat } from '../hooks/useChats'

export const normalizeConversationName = (name: string | null | undefined) => {
  if (!name) return ''
  return name.replace(/\s+/g, ' ').trim().toLowerCase()
}

export const getChatDisplayName = (chat: Chat) => {
  if (chat.name && chat.name.trim().length > 0) {
    return chat.name
  }

  return chat.type === EConversationType.DM ? 'Direct Message' : 'Group Chat'
}

export const formatCompactNumber = (value: number) => {
  if (value < 1000) return `${value}`
  if (value < 1000000) return `${Math.round(value / 100) / 10}k`
  return `${Math.round(value / 100000) / 10}M`
}

export const formatTimestamp = (timestamp: number | null) => {
  if (!timestamp) return 'N/A'

  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export type AutoMergeSuggestion = {
  id: string
  chats: Chat[]
  target: Chat
}

export const buildAutoMergeSuggestions = (chats: readonly Chat[]): AutoMergeSuggestion[] => {
  const chatGroups = new Map<string, Chat[]>()

  for (const chat of chats) {
    if (chat.type !== EConversationType.DM) continue

    const normalized = normalizeConversationName(chat.name)
    if (!normalized) continue

    const chatGroupKey = `${normalized}|${chat.type}`
    const existingChatGroup = chatGroups.get(chatGroupKey)
    if (existingChatGroup) {
      existingChatGroup.push(chat)
    } else {
      chatGroups.set(chatGroupKey, [chat])
    }
  }

  const suggestions: AutoMergeSuggestion[] = []

  for (const [key, groupChats] of chatGroups) {
    if (groupChats.length < 2) continue

    // TODO we should either pick lasat message date as logic, or pick have a list
    // of best candidates. Though we should also allow the user to pick for example
    // the avatar of the user (if there are many candidates), etc.
    const sorted = [...groupChats].sort((a, b) => b.messageCount - a.messageCount)
    const target = sorted[0]

    const sourceCounts = new Map<EExportSource, number>()

    // For cases, where someone is banned, and their username becomes "Facebook User".
    // If there is more than 1 chat from the same source, we consider this an anomaly,
    // and likely it is some deleted account.
    let hasDuplicateSource = false

    for (const chat of sorted) {
      for (const source of chat.sources) {
        const next = (sourceCounts.get(source) ?? 0) + 1
        sourceCounts.set(source, next)

        if (next > 1) {
          hasDuplicateSource = true
        }
      }
    }

    if (hasDuplicateSource) continue

    suggestions.push({
      id: key,
      chats: sorted,
      target,
    })
  }

  return suggestions
}

export type MergedChatSummary = {
  messageCount: number
  participantCount: number
  lastMessageAt: number | null
  sources: EExportSource[]
}

export const buildMergedSummary = (chats: readonly Chat[]): MergedChatSummary => {
  if (chats.length === 0) {
    return {
      messageCount: 0,
      participantCount: 0,
      lastMessageAt: null,
      sources: [],
    }
  }

  const messageCount = chats.reduce((sum, chat) => sum + chat.messageCount, 0)
  const participantCount = chats.reduce((sum, chat) => sum + chat.participantCount, 0)
  const lastMessageAt = chats.reduce<number | null>((latest, chat) => {
    if (chat.lastMessageAt == null) return latest
    if (latest == null) return chat.lastMessageAt
    return Math.max(latest, chat.lastMessageAt)
  }, null)

  const sourceSet = new Set<EExportSource>()
  for (const chat of chats) {
    for (const source of chat.sources) {
      sourceSet.add(source)
    }
  }

  return {
    messageCount,
    participantCount,
    lastMessageAt,
    sources: Array.from(sourceSet),
  }
}
