import { ReactNode } from 'react'
import { Button } from '@/common/components/Button'
import { useUserOnboarded } from '@/common/hooks/useUserOnboarded'
import { EStorageKey } from '@/common/constants/storage'
import { storage } from '@/common/helpers/storage'
import { Alert, DevSettings, ScrollView } from 'react-native'

type DebugPageContentsProps = {
  children?: ReactNode
}

export const DebugPageContents = ({ children }: DebugPageContentsProps) => {
  const [, setUserOnboarded] = useUserOnboarded()

  const handleResetOnboarding = () => {
    setUserOnboarded(false)
    DevSettings.reload()
  }

  const handleResetDatabase = () => {
    Alert.alert(
      'Reset chats database?',
      'This removes every imported chat and restarts the app. You can import again afterwards.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            storage.set(EStorageKey.DB_RESET_PENDING, true)
            DevSettings.reload()
          },
        },
      ],
    )
  }

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <Button variant="secondary" onPress={handleResetOnboarding}>
        Reset onboarding state
      </Button>
      <Button variant="secondary" onPress={handleResetDatabase}>
        Reset chats database
      </Button>
      {children}
    </ScrollView>
  )
}
