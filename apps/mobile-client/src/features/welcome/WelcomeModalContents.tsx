import { AnimatedButton } from '@/common/components/AnimatedButton'
import { Dots } from '@/common/components/Dots'
import { ThemedText } from '@/common/components/ThemedText'
import { useUserOnboarded } from '@/common/hooks/useUserOnboarded'
import { router } from 'expo-router'
import { Dimensions, View } from 'react-native'
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

export const WelcomeModalContents = () => {
  const x = useSharedValue(0)

  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const driverX = useSharedValue(0)

  const [, setUserOnboarded] = useUserOnboarded()

  const buttonProgress = useDerivedValue(() => {
    const lastSlideProgress = x.value - (TOTAL_STEPS - 2) * width

    return lastSlideProgress / width
  })

  // Normalized progress from 0 to 1 for Dots
  const dotsProgress = useDerivedValue(() => {
    return x.value / width
  })

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

      <Dots
        progress={dotsProgress}
        count={TOTAL_STEPS}
        onDotPress={changeStep}
        className="mt-12 mb-8"
      />

      <SafeAreaView>
        <View className="px-10">
          <AnimatedButton
            progress={buttonProgress}
            normalText="Next"
            finalText="Let's get started"
            onPress={handleButtonPress}
          />
        </View>
      </SafeAreaView>
    </View>
  )
}
