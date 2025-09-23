import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { ThemedText } from '@/common/components/ThemedText'
import { cn } from '@/common/helpers/cn'
import { mixColors } from '@/common/helpers/colors'
import { getValues } from '@/common/helpers/object'
import { useTheme } from '@/common/providers/ThemeProvider'
import { EXPORT_BRAND_DETAILS, ExportBrandDetails } from '@/features/chatapps/constants'
import { useRouter } from 'expo-router'
import { Image, Pressable, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const BrandPressable = ({ brand, onPress }: { brand: ExportBrandDetails; onPress: () => void }) => {
  const { themeColors } = useTheme()

  const pressed = useSharedValue(0)

  const animatedStyles = useAnimatedStyle(() => {
    const transition = {
      duration: 150,
      easing: Easing.out(Easing.ease),
    }
    return {
      transform: [{ scale: withTiming(interpolate(pressed.value, [0, 1], [1, 0.97]), transition) }],
    }
  })

  return (
    <AnimatedPressable
      onPress={onPress}
      className={cn(
        'flex flex-row items-center gap-4 bg-card h-[70px] px-6 rounded-3xl active:opacity-80 max-w-sm self-center',
      )}
      onPressIn={() => (pressed.value = 1)}
      onPressOut={() => (pressed.value = 0)}
      style={[
        {
          borderCurve: 'continuous',
          backgroundColor: mixColors(themeColors.background, brand.color, 0.1),
          shadowOpacity: 0,
        },
        animatedStyles,
      ]}
    >
      <Image source={brand.icon} className="size-8" />

      <ThemedText className="font-medium grow">{brand.name}</ThemedText>

      <IconSymbol name="chevron.right" size={20} weight="semibold" color={brand.color} />
    </AnimatedPressable>
  )
}

export default function SourceSelectionScreen() {
  const router = useRouter()

  return (
    <View className="p-8 flex flex-col items-stretch justify-center grow">
      <View className="flex flex-col items-start justify-start self-stretch mb-8 gap-1">
        <ThemedText variant="title">Select Source</ThemedText>

        <ThemedText variant="body" color="secondary" className="text-lg">
          Select the chat app from which you will want to analyze your chats. Don&apos;t worry, you
          can always import from other apps later.
        </ThemedText>
      </View>

      <View className="flex flex-col gap-3 px-6">
        {getValues(EXPORT_BRAND_DETAILS).map((brand) => (
          <BrandPressable
            key={brand.name}
            brand={brand}
            onPress={() => router.push(`/import/${brand.brand}`)}
          />
        ))}
      </View>
    </View>
  )
}
