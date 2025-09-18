import { ReactNode } from 'react'
import { Button } from '@/common/components/Button'
import { useUserOnboarded } from '@/common/hooks/useUserOnboarded'
import { DevSettings, ScrollView } from 'react-native'

type DebugPageContentsProps = {
  children?: ReactNode
}

export const DebugPageContents = ({ children }: DebugPageContentsProps) => {
  const [, setUserOnboarded] = useUserOnboarded()

  const handleResetOnboarding = () => {
    setUserOnboarded(false)
    DevSettings.reload()
  }

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <Button variant="secondary" onPress={handleResetOnboarding}>
        Reset onboarding state
      </Button>
      {children}
    </ScrollView>
  )
}
