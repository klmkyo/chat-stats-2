import { useDb } from '@/features/db/hooks/useDb'
import { canonicalConversations, conversations } from '@/features/db/schema'
import { useMutation } from '@tanstack/react-query'
import { eq, notExists, sql } from 'drizzle-orm'

export const useCleanupCanonicalConversations = () => {
  const db = useDb()

  return useMutation({
    mutationFn: async () => {
      // Remove canonical conversations with no conversations
      const convExists = db
        .select({ one: sql`1` })
        .from(conversations)
        .where(eq(conversations.canonicalConversationId, canonicalConversations.id))

      await db.delete(canonicalConversations).where(notExists(convExists))
    },
  })
}
