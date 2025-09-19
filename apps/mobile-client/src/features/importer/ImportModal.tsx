import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { ThemedText } from '@/common/components/ThemedText'
import { cn } from '@/common/helpers/cn'
import { getValues } from '@/common/helpers/object'
import { useHeaderHeight } from '@react-navigation/elements'
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack'
import { Stack } from 'expo-router'
import { Image, Pressable, View } from 'react-native'
import { EExportBrand, EXPORT_BRAND_DETAILS } from '../chatapps/constants'
import { MessengerImporter } from './service/messenger/MessengerImporter'

type ManualStackParamList = {
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
      <ImportModalStack.Screen name="messenger" component={MessengerImporter} />
      <ImportModalStack.Screen name="whatsapp" component={() => <></>} />
    </ImportModalStack.Navigator>
  )
}

const SelectSourceScreen = ({
  navigation,
}: {
  navigation: NativeStackNavigationProp<ManualStackParamList>
}) => {
  const headerHeight = useHeaderHeight()

  return (
    <>
      {/* close button */}
      <Stack.Screen
        options={{
          title: 'Select Source',
          headerShown: true,
          headerRight: () => (
            <Pressable
              onPress={() => navigation.goBack()}
              className="size-10 flex items-center justify-center"
            >
              <IconSymbol name="xmark" weight="semibold" />
            </Pressable>
          ),
          // headerTransparent: true,
        }}
      />

      <View className="p-4">
        <ThemedText variant="body">
          Select the chat app from which you will want to analyze your chats. Don&apos;t worry, you
          can always import from other apps later.
        </ThemedText>
        {/* 
        <View className="flex flex-col gap-3 py-4">
          <Pressable onPress={() => navigation.navigate('messenger')}>
            <ThemedText>Messenger</ThemedText>
          </Pressable>
        </View> */}

        <View className="flex flex-col gap-3 py-4">
          {getValues(EXPORT_BRAND_DETAILS).map((brand) => (
            <Pressable
              android_ripple={{}}
              key={brand.name}
              onPress={() => navigation.navigate(brand.brand)}
              className={cn(
                'flex flex-row items-center gap-4 bg-card h-[70px] px-6 rounded-3xl active:opacity-80',
              )}
              style={{
                borderCurve: 'continuous',
                backgroundColor: `${brand.color}28`,
              }}
            >
              <Image source={brand.icon} className="size-8" />

              <ThemedText className="font-medium grow">{brand.name}</ThemedText>

              <IconSymbol name="chevron.right" size={20} weight="semibold" color={brand.color} />
            </Pressable>
          ))}
        </View>
      </View>
    </>
  )
}
