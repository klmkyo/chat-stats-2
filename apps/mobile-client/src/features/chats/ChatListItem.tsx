import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { ThemedText } from '@/common/components/ThemedText'
import { cn } from '@/common/helpers/cn'
import { ComponentProps } from 'react'
import { Image, Pressable, View } from 'react-native'
import { EConversationType } from '../db/schema'
import { type Chat } from './hooks/useChats'
import { ChatSourceIcon } from './components/ChatSourceIcons'

interface ChatListItemProps extends ComponentProps<typeof Pressable> {
  chat: Chat
}

const formatMessageCount = (count: number): string => {
  if (count < 1000) return count.toString()
  if (count < 1000000) return `${Math.floor(count / 1000)}k`
  return `${Math.floor(count / 1000000)}M`
}

const formatLastMessageTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  const currentYear = new Date().getFullYear()
  const messageYear = date.getFullYear()

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(messageYear !== currentYear && { year: 'numeric' }),
  })
}

export const ChatListItem = ({ chat, className, ...props }: ChatListItemProps) => {
  const displayName =
    chat.name ?? (chat.type === EConversationType.DM ? 'Direct Message' : 'Group Chat')

  const participantText =
    chat.type === EConversationType.DM
      ? 'One-on-One'
      : `${chat.participantCount} participant${chat.participantCount !== 1 ? 's' : ''}`

  return (
    <Pressable
      {...props}
      className={cn(
        'flex-row items-center gap-4 rounded-3xl bg-card p-4 pr-6 active:bg-card/80',
        className,
      )}
      style={{
        borderCurve: 'continuous',
      }}
    >
      <View className="relative size-[48px] shrink-0">
        {chat.imageUri && (
          <View className="absolute inset-0 z-10 rounded-full bg-muted overflow-hidden">
            <Image source={{ uri: chat.imageUri }} className="h-full w-full" />
          </View>
        )}

        <View className="size-full items-center justify-center rounded-full bg-text/5">
          <IconSymbol
            name={chat.type === EConversationType.DM ? 'person' : 'person.3'}
            size={28}
            color="#9ca3af"
          />
        </View>
      </View>

      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between">
          <ThemedText variant="body" className="flex-1 font-medium" numberOfLines={1}>
            {displayName}
          </ThemedText>

          <View className="flex-row items-center gap-1">
            <IconSymbol name="message.fill" size={14} color="#9ca3af" />
            <ThemedText variant="caption" color="secondary">
              {formatMessageCount(chat.messageCount)}
            </ThemedText>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-2">
            <View className="flex-row items-center gap-1">
              {chat.sources.map((source, index) => (
                <ChatSourceIcon key={`${source}-${index}`} source={source} />
              ))}
            </View>

            {participantText && (
              <ThemedText variant="caption" color="secondary" numberOfLines={1}>
                {participantText}
              </ThemedText>
            )}
          </View>

          <ThemedText variant="caption" color="secondary">
            {chat.lastMessageAt ? formatLastMessageTime(chat.lastMessageAt) : null}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  )
}
