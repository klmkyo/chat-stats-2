import type { StyleProp, ViewStyle } from 'react-native'

export type OnLoadEventPayload = {
  url: string
}

export type ProcessorBridgeModuleEvents = {
  onChange: (params: ChangeEventPayload) => void
  onImportProgress: (params: ImportProgressEventPayload) => void
}

export type ChangeEventPayload = {
  value: string
}

export type ImportProgressEventPayload = {
  processed: number
  total: number
}

export type ProcessorBridgeViewProps = {
  url: string
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void
  style?: StyleProp<ViewStyle>
}
