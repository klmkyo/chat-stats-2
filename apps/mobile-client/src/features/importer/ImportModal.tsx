import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { ThemedText } from '@/common/components/ThemedText'
import { cn } from '@/common/helpers/cn'
import { getValues } from '@/common/helpers/object'
import { useTheme } from '@/common/providers/ThemeProvider'
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack'
import { Stack } from 'expo-router'
import { Image, Pressable, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { EExportBrand, EXPORT_BRAND_DETAILS, ExportBrandDetails } from '../chatapps/constants'
import { MessengerImportFlow } from './service/messenger/MessengerImportFlow'

export type ManualStackParamList = {
  index: undefined
} & {
  [key in `${EExportBrand}`]: undefined
}

const ImportModalStack = createNativeStackNavigator<ManualStackParamList>()

export const ImportModal = () => {
  return (
    <ImportModalStack.Navigator
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <ImportModalStack.Screen name="index" component={SelectSourceScreen} />
      <ImportModalStack.Screen name="messenger" component={MessengerImportFlow} />
      <ImportModalStack.Screen name="whatsapp" component={() => <></>} />
    </ImportModalStack.Navigator>
  )
}

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
      shadowOffset: {
        width: 0,
        height: withTiming(interpolate(pressed.value, [0, 1], [2, 0]), transition),
      },
      shadowRadius: withTiming(interpolate(pressed.value, [0, 1], [4, 2]), transition),
      shadowOpacity: withTiming(interpolate(pressed.value, [0, 1], [0.4, 0.5]), transition),
      transform: [{ scale: withTiming(interpolate(pressed.value, [0, 1], [1, 0.99]), transition) }],
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
          backgroundColor: themeColors.background,
          shadowColor: brand.color,
          // shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 4,
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

const SelectSourceScreen = ({
  navigation,
}: {
  navigation: NativeStackNavigationProp<ManualStackParamList>
}) => {
  const { themeColors } = useTheme()

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
