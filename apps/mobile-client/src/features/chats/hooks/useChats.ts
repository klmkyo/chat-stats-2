import { EExportSource } from '@/features/chatapps/constants'
import { useDbQuery } from '@/features/db/hooks/useDb'
import {
  canonicalConversations,
  conversations,
  EConversationType,
  exportsTable,
  messages,
  people,
} from '@/features/db/schema'
import { count, countDistinct, desc, eq, max, min, sql } from 'drizzle-orm'
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { useMemo } from 'react'

export type Chat = {
  id: number
  name: string | null
  type: EConversationType
  imageUri: string | null
  participantCount: number
  messageCount: number
  lastMessageAt: number | null
  sources: EExportSource[]
}

const getChatsBaseQuery = (db: ExpoSQLiteDatabase) =>
  db
    .select({
      id: canonicalConversations.id,
      name: canonicalConversations.name,
      type: canonicalConversations.type,
      // Any non-null image from a grouped set; min() ignores nulls
      imageUri: min(conversations.imageUri).as('imageUri'),
      participantCount: countDistinct(people.canonicalPersonId).as('participantCount'),
      messageCount: count(messages.id).as('messageCount'),
      lastMessageAt: max(messages.sentAt).as('lastMessageAt'),
      // Aggregate distinct export sources as CSV
      sourcesCsv: sql<string>`group_concat(DISTINCT ${exportsTable.source})`.as('sourcesCsv'),
    })
    .from(canonicalConversations)
    .leftJoin(conversations, eq(conversations.canonicalConversationId, canonicalConversations.id))
    .leftJoin(exportsTable, eq(exportsTable.id, conversations.exportId))
    .leftJoin(people, eq(people.conversationId, conversations.id))
    .leftJoin(messages, eq(messages.senderId, people.id))
    .groupBy(canonicalConversations.id, canonicalConversations.name, canonicalConversations.type)
    .orderBy(desc(max(messages.sentAt)))

export const useChats = () => {
  const { data: baseRows = [] } = useDbQuery(getChatsBaseQuery)

  const chats: Chat[] = useMemo(() => baseRows.map(({ sourcesCsv, ...row }) => {
    const sources = (sourcesCsv ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0) as EExportSource[]
      
    return { ...row, sources }
  }), [baseRows])

  return {
    chats,
    isEmpty: chats.length === 0,
  }
}
