import { Alert, Dimensions, View } from 'react-native'

import { AnimatedButton } from '@/common/components/AnimatedButton'
import { Dots } from '@/common/components/Dots'
import { ThemedText } from '@/common/components/ThemedText'
import { isElementOfType } from '@/common/helpers/react-helpers'
import { useHeaderHeight } from '@react-navigation/elements'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
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
import { runOnUISync } from 'react-native-worklets'
import { ImporterFlow, ImporterStackParamList, useImporter } from './ImporterFlow'

const { width } = Dimensions.get('window')

const Step = ({ index, x, slide }: { index: number; x: SharedValue<number>; slide: ReactNode }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const progress = x.value / width
    const translateX = interpolate(progress, [index - 1, index, index + 1], [50, 0, -50], 'clamp')
    return {
      transform: [{ translateX }],
    }
  })

  // assert that slide is a ImporterFlowSlide
  if (!isElementOfType(slide, ImporterFlow.Slide)) {
    throw new Error('slide is not a ImporterFlow.Slide')
  }

  const { title, subtitle, children } = slide.props

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
        {children}
      </Animated.View>
    </View>
  )
}

export const ImporterSlides = ({
  navigation,
}: NativeStackScreenProps<ImporterStackParamList, 'index'>) => {
  const headerHeight = useHeaderHeight()

  const {
    components: { slides },
    brandDetails,
  } = useImporter()

  const totalSteps = slides.length

  const x = useSharedValue(0)

  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const driverX = useSharedValue(0)

  const stepsProgress = useDerivedValue(() => {
    return x.value / width
  })

  // Progress from 0 to 1 for AnimatedButton
  const buttonProgress = useDerivedValue(() => {
    return interpolate(stepsProgress.value, [totalSteps - 2, totalSteps - 1], [0, 1], 'clamp')
  })

  // Normalized progress from 0 to 1 for Dots
  const dotsProgress = useDerivedValue(() => {
    return x.value / width
  })

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
    const isFinalStep = step === totalSteps - 1
    if (isFinalStep) {
      Alert.alert('Analyze Messages')
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
    // TODO the bottom marign is different than welcome screen
    <View className="flex-1" style={{ paddingBottom: headerHeight }}>
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

      {/* This almost certainly seems like a bad idea, but it's the only way to get the safe area to work */}
      <Animated.View className="px-10 shrink-0" style={[buttonOverscrollStyle]}>
        <AnimatedButton
          progress={buttonProgress}
          normalText="Next"
          finalText="Analyze Messages"
          onPress={handleButtonPress}
          style={{ backgroundColor: brandDetails.color }}
        />
      </Animated.View>
    </View>
  )
}
