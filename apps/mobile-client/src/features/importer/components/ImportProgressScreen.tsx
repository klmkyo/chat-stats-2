import { ProgressBar } from '@/common/components/ProgressBar'
import { useImporter } from '@/features/importer/context/ImporterContext'
import ProcessorBridgeModule from '@/modules/processor-bridge'
import { usePreventRemove } from '@react-navigation/native'
import { useNavigation } from 'expo-router'
import { Alert, View } from 'react-native'

export function ImportProgressScreen() {
  const { importStatus, brandDetails } = useImporter()
  const navigation = useNavigation()

  const isRunning = importStatus.status === 'running'
  const processed = importStatus.processed ?? 0
  const total = importStatus.total ?? 0
  const progressValue = total > 0 ? processed : Math.max(processed, 0)
  const totalValue = total > 0 ? total : undefined

  usePreventRemove(isRunning, ({ data }) => {
    Alert.alert(
      'Stop import?',
      `Your ${brandDetails.name} import is still running. Are you sure you want to cancel it?`,
      [
        {
          text: 'Keep importing',
          style: 'cancel',
        },
        {
          text: 'Cancel import',
          style: 'destructive',
          onPress: () => {
            Promise.resolve(ProcessorBridgeModule.cancelImport)
              .catch(() => {
                // Cancellation is best-effort; ignore errors.
              })
              .finally(() => {
                navigation.dispatch(data.action)
              })
          },
        },
      ],
    )
  })

  return (
    <>
      <View className="flex-1 items-center justify-center bg-background">
        <ProgressBar
          progress={progressValue}
          total={totalValue}
          style={{ width: '80%', maxWidth: 320 }}
        />
      </View>
    </>
  )
}
