import { ThemedText } from '@/common/components/ThemedText'
import { EExportBrand } from '@/features/chatapps/constants'
import { View } from 'react-native'
import { ImporterFlow } from '../../importers/ImporterFlow'

export const MessengerImportFlow = () => {
  return (
    <ImporterFlow brand={EExportBrand.MESSENGER}>
      <ImporterFlow.Slide
        title="Downloading Messages from Messenger"
        subtitle="In order to anlalyze your messages, you need to download them from Messenger first."
      >
        <View className="h-96 bg-card rounded-2xl flex items-center justify-center">
          <ThemedText>Test</ThemedText>
        </View>
      </ImporterFlow.Slide>

      <ImporterFlow.Slide
        title="Analyzing Messages"
        subtitle="We will now analyze your messages to find the most important ones."
      >
        <View className="h-96 bg-card rounded-2xl flex items-center justify-center">
          <ThemedText>Test2</ThemedText>
        </View>
      </ImporterFlow.Slide>
    </ImporterFlow>
  )
}
