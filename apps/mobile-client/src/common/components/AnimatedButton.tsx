import { cn } from '@/common/helpers/cn'
import { View } from 'react-native'
import Animated, { interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { Button, ButtonProps } from './Button'

export interface AnimatedButtonProps extends Omit<ButtonProps, 'children'> {
  progress: SharedValue<number>
  normalText: string
  finalText: string
  textClassName?: string
  moveDistance?: number
}

export function AnimatedButton({
  progress,
  normalText,
  finalText,
  textClassName,
  moveDistance = 40,
  ...buttonProps
}: AnimatedButtonProps) {
  const normalTextStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 0.5], [0, -moveDistance], 'clamp')
    const opacity = interpolate(progress.value, [0, 0.5], [1, 0], 'clamp')

    return {
      transform: [{ translateX }],
      opacity,
    }
  })

  const finalTextStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0.5, 1], [moveDistance, 0], 'clamp')
    const opacity = interpolate(progress.value, [0.5, 1], [0, 1], 'clamp')

    return {
      transform: [{ translateX }],
      opacity,
    }
  })

  const baseTextClassName = 'text-center font-semibold text-white'

  return (
    <Button size="lg" {...buttonProps}>
      <View className="relative flex-1">
        <Animated.Text className={cn(baseTextClassName, textClassName)} style={normalTextStyle}>
          {normalText}
        </Animated.Text>

        <Animated.Text
          className={cn('absolute top-0 left-0 right-0', baseTextClassName, textClassName)}
          style={finalTextStyle}
        >
          {finalText}
        </Animated.Text>
      </View>
    </Button>
  )
}
