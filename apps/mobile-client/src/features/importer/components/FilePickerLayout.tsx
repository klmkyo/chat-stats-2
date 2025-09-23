import { Button } from '@/common/components/Button'
import { ThemedText } from '@/common/components/ThemedText'
import { ComponentProps, ReactNode } from 'react'
import { View } from 'react-native'
import { useImporter } from '../context/ImporterContext'

const FilePickerLayoutContainer = ({ children }: { children: ReactNode }) => {
  return <View className="flex-1 flex-col items-stretch p-6 justify-center gap-4">{children}</View>
}

const FilePickerLayoutHeader = ({ children }: { children: ReactNode }) => {
  return <ThemedText variant="title">{children}</ThemedText>
}

const FilePickerLayoutDescription = ({ children }: { children: ReactNode }) => {
  return <View>{children}</View>
}

const FilePickerLayoutButton = ({ children, style, ...props }: ComponentProps<typeof Button>) => {
  const { brandDetails } = useImporter()

  return (
    <Button style={{ backgroundColor: brandDetails.color }} {...props}>
      {children}
    </Button>
  )
}

export const FilePickerLayout = {
  Container: FilePickerLayoutContainer,
  Header: FilePickerLayoutHeader,
  Description: FilePickerLayoutDescription,
  Button: FilePickerLayoutButton,
}
