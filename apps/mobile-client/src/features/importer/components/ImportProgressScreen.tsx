import { ProgressBar } from '@/common/components/ProgressBar'
import { useImporter } from '@/features/importer/context/ImporterContext'
import ProcessorBridgeModule from '@/modules/processor-bridge'
import { useNavigation, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, BackHandler, View } from 'react-native'

export function ImportProgressScreen() {
  const { importStatus, brandDetails } = useImporter()
  const navigation = useNavigation()
  const router = useRouter()
  const [isCancelling, setIsCancelling] = useState(false)
  const allowExitRef = useRef(false)

  const isRunning = importStatus.status === 'running'
  const processed = importStatus.processed ?? 0
  const total = importStatus.total ?? 0
  const progressValue = total > 0 ? processed : Math.max(processed, 0)
  const totalValue = total > 0 ? total : undefined

  useEffect(() => {
    if (isRunning) {
      allowExitRef.current = false
    }
  }, [isRunning])

  const promptCancel = useCallback(
    (onConfirmed: () => void) => {
      if (isCancelling) {
        return
      }

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
              setIsCancelling(true)
              Promise.resolve(ProcessorBridgeModule.cancelImport)
                .catch(() => {
                  // Cancellation is best-effort; ignore errors.
                })
                .finally(() => {
                  allowExitRef.current = true
                  setIsCancelling(false)
                  onConfirmed()
                })
            },
          },
        ],
      )
    },
    [brandDetails.name, isCancelling],
  )

  useEffect(() => {
    if (!isRunning) {
      return
    }

    const subscription = navigation.addListener('beforeRemove', (event) => {
      if (allowExitRef.current) {
        return
      }
      event.preventDefault()
      promptCancel(() => {
        navigation.dispatch(event.data.action)
      })
    })

    return subscription
  }, [navigation, promptCancel, isRunning])

  useEffect(() => {
    if (!isRunning) {
      return
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (allowExitRef.current) {
        return false
      }
      promptCancel(() => {
        allowExitRef.current = true
        router.back()
      })
      return true
    })

    return () => {
      subscription.remove()
    }
  }, [promptCancel, router, isRunning])

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ProgressBar
        progress={progressValue}
        total={totalValue}
        style={{ width: '80%', maxWidth: 320 }}
      />
    </View>
  )
}
