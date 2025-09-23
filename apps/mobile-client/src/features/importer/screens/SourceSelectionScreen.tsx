import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { ThemedText } from '@/common/components/ThemedText'
import { cn } from '@/common/helpers/cn'
import { mixColors } from '@/common/helpers/colors'
import { getValues } from '@/common/helpers/object'
import { useTheme } from '@/common/providers/ThemeProvider'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Stack } from 'expo-router'
import { Image, Pressable, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { EXPORT_BRAND_DETAILS, ExportBrandDetails } from '../../chatapps/constants'
import { ManualStackParamList } from '../types'

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
      // opacity: withTiming(interpolate(pressed.value, [0, 1], [1, 0.5]), { duration: 100 }),
      // shadowOffset: {
      //   width: 0,
      //   height: withTiming(interpolate(pressed.value, [0, 1], [2, 0]), transition),
      // },
      // shadowRadius: withTiming(
      //   interpolate(pressed.value, [0, 1], theme === 'dark' ? [6, 3] : [4, 2]),
      //   transition,
      // ),
      // shadowOpacity: withTiming(
      //   interpolate(pressed.value, [0, 1], theme === 'dark' ? [0.7, 0.9] : [0.4, 0.5]),
      //   transition,
      // ),
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

          // backgroundColor: themeColors.background,
          // shadowColor: brand.color,
          // shadowColor: brand.color,
          // shadowOpacity: 0.4,
          // shadowRadius: 4,
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

export const SourceSelectionScreen = ({
  navigation,
}: {
  navigation: NativeStackNavigationProp<ManualStackParamList>
}) => {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Import Chats',
          headerShown: true,
          headerRight: () => (
            <Pressable
              onPress={() => navigation.goBack()}
              className="size-10 flex items-center justify-center"
            >
              <IconSymbol name="xmark" weight="semibold" />
            </Pressable>
          ),
        }}
      />

      <View className="p-8 flex flex-col items-stretch justify-center grow">
        <View className="flex flex-col items-start justify-start self-stretch mb-8 gap-1">
          <ThemedText variant="title">Select Source</ThemedText>

          <ThemedText variant="body" color="secondary" className="text-lg">
            Select the chat app from which you will want to analyze your chats. Don&apos;t worry,
            you can always import from other apps later.
          </ThemedText>
        </View>
        {/* 
        <View className="flex flex-col gap-3 py-4">
          <Pressable onPress={() => navigation.navigate('messenger')}>
            <ThemedText>Messenger</ThemedText>
          </Pressable>
        </View> */}

        <View className="flex flex-col gap-3 px-6">
          {getValues(EXPORT_BRAND_DETAILS).map((brand) => (
            <BrandPressable
              key={brand.name}
              brand={brand}
              onPress={() => navigation.navigate(brand.brand)}
            />
          ))}
        </View>
      </View>
    </>
  )
}
