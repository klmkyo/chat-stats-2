import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { EExportBrand, EXPORT_BRAND_DETAILS } from '@/features/chatapps/constants'
import { ImporterProvider } from '@/features/importer/context/ImporterContext'
import { Stack, useRouter } from 'expo-router'
import { Pressable } from 'react-native'

export default function MessengerImportLayout() {
  const router = useRouter()
  const brandDetails = EXPORT_BRAND_DETAILS[EExportBrand.MESSENGER]

  return (
    <>
      <Stack.Screen
        options={{
          title: `Import from ${brandDetails.name}`,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              className="size-10 flex items-center justify-center"
            >
              <IconSymbol name="chevron.left" weight="semibold" color={brandDetails.color} />
            </Pressable>
          ),
        }}
      />

      <ImporterProvider brand={EExportBrand.MESSENGER}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="file-picker" />
          <Stack.Screen name="progress" />
        </Stack>
      </ImporterProvider>
    </>
  )
}
