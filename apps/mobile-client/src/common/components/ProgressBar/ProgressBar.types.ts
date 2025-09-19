import { StyleProp, ViewStyle } from "react-native"

export interface ProgressBarProps {
  progress: number
  total: number
  color?: string
  style?: StyleProp<ViewStyle>
}