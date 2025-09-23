import { ThemedText } from '@/common/components/ThemedText'
import { EExportBrand, EXPORT_BRAND_DETAILS } from '@/features/chatapps/constants'
import { MultiStepSlides, SlideInfo } from '@/features/importer/components/MultiStepSlides'
import { useRouter } from 'expo-router'
import { View } from 'react-native'

export default function MessengerSlidesScreen() {
  const router = useRouter()
  const brandDetails = EXPORT_BRAND_DETAILS[EExportBrand.MESSENGER]

  const messengerSlides: SlideInfo[] = [
    {
      title: 'Downloading Messages from Messenger',
      subtitle:
        'In order to anlalyze your messages, you need to download them from Messenger first.',
      content: (
        <View className="h-96 bg-card rounded-2xl flex items-center justify-center">
          <ThemedText>Test</ThemedText>
        </View>
      ),
    },
    {
      title: 'Analyzing Messages',
      subtitle: 'We will now analyze your messages to find the most important ones.',
      content: (
        <View className="h-96 bg-card rounded-2xl flex items-center justify-center">
          <ThemedText>Test2</ThemedText>
        </View>
      ),
    },
  ]

  return (
    <MultiStepSlides
      slides={messengerSlides}
      brandDetails={brandDetails}
      onComplete={() => router.push('/import/messenger/file-picker')}
    />
  )
}
