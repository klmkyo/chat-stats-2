import { Dimensions, View } from 'react-native'

import { AnimatedButton } from '@/common/components/AnimatedButton'
import { Dots } from '@/common/components/Dots'
import { ThemedText } from '@/common/components/ThemedText'
import { ReactNode } from 'react'
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

export type SlideInfo = {
  title: string
  subtitle: string
  content: ReactNode
}

type MultiStepSlidesProps = {
  slides: SlideInfo[]
  brandDetails: { color: string }
  onComplete: () => void
}

const Step = ({ index, x, slide }: { index: number; x: SharedValue<number>; slide: SlideInfo }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const progress = x.value / width
    const translateX = interpolate(progress, [index - 1, index, index + 1], [50, 0, -50], 'clamp')
    return {
      transform: [{ translateX }],
    }
  })

  const { title, subtitle, content } = slide

  return (
    <View className="flex-1 items-center p-8" style={{ width }}>
      <View className="flex flex-col items-start justify-start self-stretch mb-8 gap-1 h-32">
        <ThemedText variant="title">{title}</ThemedText>
        <ThemedText variant="body" color="muted" className="text-lg">
          {subtitle}
        </ThemedText>
      </View>

      <Animated.View
        style={[animatedStyle]}
        className="flex grow justify-center items-stretch self-stretch"
      >
        {content}
      </Animated.View>
    </View>
  )
}

export const MultiStepSlides = ({ slides, brandDetails, onComplete }: MultiStepSlidesProps) => {
  const totalSteps = slides.length

  const x = useSharedValue(0)

  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const driverX = useSharedValue(0)

  const stepsProgress = useDerivedValue(() => {
    return x.value / width
  })

  const buttonProgress = useDerivedValue(() => {
    return interpolate(stepsProgress.value, [totalSteps - 2, totalSteps - 1], [0, 1], 'clamp')
  })

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
    const isFinalStep = step === totalSteps - 1
    if (isFinalStep) {
      onComplete()
    } else {
      changeStep(step + 1)
    }
  }

  const buttonOverscrollStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(stepsProgress.value, [totalSteps - 1, totalSteps], [1, 1.2], 'clamp'),
        },
      ],
    }
  })

  return (
    <SafeAreaView className="flex-1">
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        ref={scrollRef}
        className="relative pt-8"
      >
        {slides.map((slide, index) => (
          <Step key={index} index={index} x={x} slide={slide} />
        ))}
      </Animated.ScrollView>

      <Dots
        progress={dotsProgress}
        count={totalSteps}
        onDotPress={changeStep}
        className="mt-12 mb-8"
      />

      <Animated.View className="px-10 shrink-0 pb-8" style={[buttonOverscrollStyle]}>
        <AnimatedButton
          progress={buttonProgress}
          normalText="Next"
          finalText="Analyze Messages"
          onPress={handleButtonPress}
          style={{ backgroundColor: brandDetails.color }}
        />
      </Animated.View>
    </SafeAreaView>
  )
}
