import { Button } from '@/common/components/Button'
import { ThemedText } from '@/common/components/ThemedText'
import { ComponentProps, ReactNode } from 'react'
import { View } from 'react-native'

const ImporterImporterContainer = ({ children }: { children: ReactNode }) => {
  return <View className="flex-1 flex-col items-stretch p-6 justify-center gap-4">{children}</View>
}

const ImporterImporterHeader = ({ children }: { children: ReactNode }) => {
  return <ThemedText variant="title">{children}</ThemedText>
}

const ImporterImporterDescription = ({ children }: { children: ReactNode }) => {
  return <View>{children}</View>
}

const ImporterImporterButton = ({ children, ...props }: ComponentProps<typeof Button>) => {
  return <Button {...props}>{children}</Button>
}

export const ImporterImporter = {
  Container: ImporterImporterContainer,
  Header: ImporterImporterHeader,
  Description: ImporterImporterDescription,
  Button: ImporterImporterButton,
}
