import { Host, LinearProgress } from '@expo/ui/swift-ui'
import { ProgressBarProps } from './ProgressBar.types'

export function ProgressBar({ progress, total, color, style, ...props }: ProgressBarProps) {
  return (
    <Host style={style} {...props}>
      <LinearProgress progress={progress} color={color} />
    </Host>
  )
}
