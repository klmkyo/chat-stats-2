import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { ThemedText } from '@/common/components/ThemedText'
import { count, desc, eq } from 'drizzle-orm'
import { Stack } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Image, Pressable, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { EExportSource, EXPORT_BRAND_DETAILS, EXPORT_SOURCE_DETAILS } from '../chatapps/constants'
import { EmptyChatsCTA } from '../chats/ChatsPageContents'
import { useDb, useDbQuery } from '../db/hooks/useDb'
import { conversations, exportsTable } from '../db/schema'

const formatImportDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface SwipeableExportCardProps {
  exportItem: {
    id: number
    source: EExportSource
    importedAt: number
    metaJson: string | null
    conversationCount: number
  }
  onDelete: () => void
  onPanStart: (cardId: number) => void
  canAnimate: boolean
}

export function resistAfter(
  value: number,
  leftThreshold: number,
  rightThreshold: number,
  resistanceLength = 120, // higher = softer; lower = harder
) {
  'worklet'

  // Helper: sublinear growth with increasing friction.
  // For small x: ~x (feels natural at the edge).
  // For large x: grows like k*log(1 + x/k), so each extra pixel moves less.
  const compress = (overshoot: number, k: number) => k * Math.log1p(overshoot / k)

  if (value > rightThreshold) {
    const base = rightThreshold
    const overshoot = value - rightThreshold
    return base + compress(overshoot, resistanceLength)
  }

  if (value < -leftThreshold) {
    const base = -leftThreshold
    const overshoot = Math.abs(value + leftThreshold)
    return base - compress(overshoot, resistanceLength)
  }

  return value
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const SwipeableExportCard = ({
  exportItem,
  onDelete,
  onPanStart,
  canAnimate,
}: SwipeableExportCardProps) => {
  const deleteButtonWidth = 90

  const sourceDetails = EXPORT_SOURCE_DETAILS[exportItem.source]
  const brandDetails = EXPORT_BRAND_DETAILS[sourceDetails?.brand]

  const handleDelete = () => {
    Alert.alert(
      'Delete Export',
      `Are you sure you want to delete this export from ${brandDetails?.name}? This will remove all conversations and messages that are associated with this export.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ],
    )
  }

  const padding = 16
  const deleteSnapPosition = -(deleteButtonWidth + padding)

  const translateX = useSharedValue(0)
  const startX = useSharedValue(0)

  // Reset translateX when shouldReset is true
  useEffect(() => {
    if (!canAnimate) {
      translateX.value = withSpring(0, {
        overshootClamping: true,
      })
    }
  }, [canAnimate, translateX])

  const handlePanStart = useCallback(() => {
    onPanStart(exportItem.id)
  }, [exportItem.id, onPanStart])

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value
      scheduleOnRN(handlePanStart)
    })
    .onChange((event) => {
      const raw = startX.value + event.translationX
      translateX.value = resistAfter(raw, -deleteSnapPosition, 0, 20)
    })
    .onEnd(() => {
      const snapPosition = translateX.value <= -deleteButtonWidth / 2 ? deleteSnapPosition : 0
      translateX.value = withSpring(snapPosition, {
        overshootClamping: true,
      })
    })

  const cardAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    }
  })

  const deleteButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(translateX.value, [deleteSnapPosition, 0], [1, 0], 'clamp'),
      transform: [
        { scale: interpolate(translateX.value, [deleteSnapPosition, 0], [1, 0.86], 'clamp') },
      ],
    }
  })

  if (!sourceDetails || !brandDetails) {
    throw new Error('Source details or brand details not found')
  }

  return (
    <Animated.View className="relative" exiting={FadeOut}>
      {/* Delete button background */}
      <AnimatedPressable
        className="absolute right-0 inset-y-0 bg-notification rounded-2xl justify-center items-center gap-2"
        style={[
          { borderCurve: 'continuous' },
          deleteButtonAnimatedStyle,
          { width: deleteButtonWidth },
        ]}
        onPress={handleDelete}
      >
        <IconSymbol name="trash" size={20} color="white" />

        <ThemedText variant="caption" className="text-white font-semibold">
          Delete
        </ThemedText>
      </AnimatedPressable>

      {/* Main card */}
      <GestureDetector gesture={pan}>
        <Animated.View style={cardAnimatedStyle}>
          <View
            className="bg-card rounded-2xl p-4 border border-border/20"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="flex-row items-center gap-3 mb-3">
              <View
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: brandDetails.color + '20' }}
              >
                <Image source={brandDetails.icon} className="w-8 h-8" />
              </View>

              <View className="flex-1">
                <ThemedText variant="heading" className="text-lg">
                  {brandDetails.name}
                </ThemedText>
                <ThemedText variant="caption" color="secondary">
                  {sourceDetails.name}
                </ThemedText>
              </View>
            </View>

            <View className="gap-2">
              <View className="flex-row justify-between items-center">
                <ThemedText variant="caption" color="muted">
                  Conversations
                </ThemedText>
                <ThemedText variant="caption" color="primary">
                  {exportItem.conversationCount}
                </ThemedText>
              </View>

              <View className="flex-row justify-between items-center">
                <ThemedText variant="caption" color="muted">
                  Imported
                </ThemedText>
                <ThemedText variant="caption" color="primary">
                  {formatImportDate(exportItem.importedAt)}
                </ThemedText>
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  )
}

export const ExportsPageContents = () => {
  const db = useDb()
  const [activePanCardId, setActivePanCardId] = useState<number | null>(null)

  // Get exports with conversation counts
  const { data: exports } = useDbQuery((db) =>
    db
      .select({
        id: exportsTable.id,
        source: exportsTable.source,
        importedAt: exportsTable.importedAt,
        metaJson: exportsTable.metaJson,
        conversationCount: count(conversations.id),
      })
      .from(exportsTable)
      .leftJoin(conversations, eq(conversations.exportId, exportsTable.id))
      .groupBy(exportsTable.id)
      .orderBy(desc(exportsTable.importedAt)),
  )

  const handleDeleteExport = async (exportId: number) => {
    try {
      await db.delete(exportsTable).where(eq(exportsTable.id, exportId))
    } catch (error) {
      console.error('Error deleting export:', error)
      Alert.alert('Error', 'Failed to delete export. Please try again.')
    }
  }

  const handlePanStart = (cardId: number) => {
    setActivePanCardId(cardId)
  }

  const resetActivePanCardId = () => {
    setActivePanCardId(null)
  }

  console.log('activePanCardId', activePanCardId)

  const dismissTap = Gesture.Tap()
    .enabled(activePanCardId !== null)
    .maxDistance(8)
    .onEnd(() => {
      scheduleOnRN(resetActivePanCardId)
    })

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: 'Exports',
        }}
      />
      <GestureDetector gesture={dismissTap}>
        <Animated.FlatList
          data={exports}
          className="p-4"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="gap-3"
          renderItem={({ item }) => (
            <SwipeableExportCard
              key={item.id}
              exportItem={item}
              onDelete={() => handleDeleteExport(item.id)}
              onPanStart={handlePanStart}
              canAnimate={activePanCardId === item.id}
            />
          )}
          itemLayoutAnimation={LinearTransition}
          ListEmptyComponent={<EmptyChatsCTA className="flex-1 p-6" />}
        />
      </GestureDetector>
    </>
  )
}
