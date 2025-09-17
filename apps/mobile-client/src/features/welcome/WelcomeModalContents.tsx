import { Button } from '@/common/components/Button'
import { ThemedText } from '@/common/components/ThemedText'
import { range } from '@/common/helpers/range'
import { useUserOnboarded } from '@/common/hooks/useUserOnboarded'
import { router } from 'expo-router'
import { Dimensions, Pressable, View } from 'react-native'
import Animated, {
  interpolate,
  scrollTo,
  SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { runOnUISync } from 'react-native-worklets'

const { width } = Dimensions.get('window')
const TOTAL_STEPS = 3

const Dot = ({
  index,
  x,
  onPress,
}: {
  index: number
  x: SharedValue<number>
  onPress: () => void
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const progress = x.value / width
    const scale = interpolate(progress, [index - 1, index, index + 1], [0.8, 1.4, 0.8], 'clamp')
    const opacity = interpolate(progress, [index - 1, index, index + 1], [0.5, 1, 0.5], 'clamp')

    return {
      transform: [{ scale }],
      opacity,
    }
  })

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        className="size-2.5 rounded-full mx-2 bg-black/70 dark:bg-white"
        style={[animatedStyle]}
      />
    </Pressable>
  )
}

const Step = ({
  children,
  title,
  subtitle,
  style,
  index,
  x,
}: {
  style: { width: number }
  children: React.ReactNode
  title: string
  subtitle: string
  index: number
  x: SharedValue<number>
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const progress = x.value / width
    const translateX = interpolate(progress, [index - 1, index, index + 1], [50, 0, -50], 'clamp')
    return {
      transform: [{ translateX }],
    }
  })

  return (
    <View className="flex-1 justify-center items-center p-8" style={style}>
      <View className="flex flex-col items-start justify-start self-stretch mb-8 gap-1 h-32">
        <ThemedText variant="title">{title}</ThemedText>
        <ThemedText variant="body" color="muted" className="text-lg">
          {subtitle}
        </ThemedText>
      </View>

      <Animated.View style={[animatedStyle]} className="flex items-stretch self-stretch">
        {children}
      </Animated.View>
    </View>
  )
}

// TODO blur the text https://stackoverflow.com/questions/76696750/how-can-i-animate-the-expo-blur-view-intensity-using-react-native-reanimated
// Some glow or expand animation when we get to the let's get started part
export const AnimatedButton = ({
  x,
  onPress,
  totalSteps = 3,
}: {
  x: SharedValue<number>
  onPress: () => void
  totalSteps: number
}) => {
  const finalStepIndex = totalSteps - 1

  const moveByPx = 40

  const normalTextStyle = useAnimatedStyle(() => {
    const progress = x.value / width

    const translateX = interpolate(
      progress,
      [finalStepIndex - 1, finalStepIndex - 0.5],
      [0, -moveByPx],
      'clamp',
    )

    const opacity = interpolate(
      progress,
      [finalStepIndex - 1, finalStepIndex - 0.5],
      [1, 0],
      'clamp',
    )

    return {
      transform: [{ translateX }],
      opacity,
    }
  })

  const finalTextStyle = useAnimatedStyle(() => {
    const progress = x.value / width

    const translateX = interpolate(
      progress,
      [finalStepIndex - 0.5, finalStepIndex],
      [moveByPx, 0],
      'clamp',
    )

    const opacity = interpolate(progress, [finalStepIndex - 0.5, finalStepIndex], [0, 1], 'clamp')

    return {
      transform: [{ translateX }],
      opacity,
    }
  })

  return (
    <View className="relative">
      <Button size="lg" onPress={onPress}>
        <View className="relative flex-1">
          <Animated.Text className="text-center font-semibold text-white" style={normalTextStyle}>
            Next
          </Animated.Text>

          <Animated.Text
            className="absolute top-0 left-0 right-0 text-center font-semibold text-white"
            style={finalTextStyle}
          >
            Let&apos;s get started
          </Animated.Text>
        </View>
      </Button>
    </View>
  )
}

export const WelcomeModalContents = () => {
  const x = useSharedValue(0)

  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const driverX = useSharedValue(0)

  const [, setUserOnboarded] = useUserOnboarded()

  // Keep dots/animations in sync with actual scroll
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      x.value = event.contentOffset.x
    },
  })

  useDerivedValue(() => {
    scrollTo(scrollRef, driverX.value, 0, false)
  })

  const changeStep = (index: number) => {
    runOnUISync(() => {
      driverX.value = x.value
      driverX.value = withSpring(index * width, {
        overshootClamping: true,
      })
    })
  }

  const getActiveStep = () => {
    return Math.round(x.value / width)
  }

  const handleButtonPress = () => {
    const step = getActiveStep()
    const isFinalStep = step === TOTAL_STEPS - 1
    if (isFinalStep) {
      setUserOnboarded(true)
      router.dismiss()
    } else {
      changeStep(step + 1)
    }
  }

  return (
    <View className="flex-1">
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        ref={scrollRef}
        className="relative"
      >
        <Step
          style={{ width }}
          title="Shared with You"
          subtitle="Content shared in Messages can automatically be added to your library"
          index={0}
          x={x}
        >
          <View className="h-96 bg-card rounded-2xl flex items-center justify-center">
            <ThemedText>Step One</ThemedText>
          </View>
        </Step>
        <Step style={{ width }} title="Step Two" subtitle="Some nice subtitle" index={1} x={x}>
          <View className="h-96 bg-card rounded-2xl flex items-center justify-center">
            <ThemedText>Step Two</ThemedText>
          </View>
        </Step>
        <Step style={{ width }} title="Step Three" subtitle="Some nice subtitle" index={2} x={x}>
          <View className="h-96 bg-card rounded-2xl flex items-center justify-center">
            <ThemedText>Step Three</ThemedText>
          </View>
        </Step>
      </Animated.ScrollView>

      <View className="flex-row justify-center mt-12 mb-8">
        {range(TOTAL_STEPS).map((_, i) => (
          <Dot key={i} index={i} x={x} onPress={() => changeStep(i)} />
        ))}
      </View>

      <SafeAreaView>
        <View className="px-10">
          <AnimatedButton x={x} totalSteps={TOTAL_STEPS} onPress={handleButtonPress} />
        </View>
      </SafeAreaView>
    </View>
  )
}
