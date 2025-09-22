import { cn } from '@/common/helpers/cn'
import { range } from '@/common/helpers/range'
import { Pressable, View } from 'react-native'
import Animated, { interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated'

interface DotProps {
  index: number
  progress: SharedValue<number>
  onPress: () => void
  className?: string
}

const Dot = ({ index, progress, onPress, className }: DotProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    const step = progress.value
    const scale = interpolate(step, [index - 1, index, index + 1], [0.8, 1.4, 0.8], 'clamp')
    const opacity = interpolate(step, [index - 1, index, index + 1], [0.5, 1, 0.5], 'clamp')

    return {
      transform: [{ scale }],
      opacity,
    }
  })

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        className={cn('size-2.5 rounded-full mx-2 bg-black/70 dark:bg-white', className)}
        style={[animatedStyle]}
      />
    </Pressable>
  )
}

export interface DotsProps {
  /** Normalized progress from 0 to count-1 */
  progress: SharedValue<number>
  /** Total number of dots */
  count: number
  /** Callback when a dot is pressed */
  onDotPress: (index: number) => void
  /** Additional className for the container */
  className?: string
  /** Additional className for individual dots */
  dotClassName?: string
}

export const Dots = ({ progress, count, onDotPress, className, dotClassName }: DotsProps) => {
  return (
    <View className={cn('flex-row justify-center', className)}>
      {range(count).map((_, i) => (
        <Dot
          key={i}
          index={i}
          progress={progress}
          onPress={() => onDotPress(i)}
          className={dotClassName}
        />
      ))}
    </View>
  )
}
