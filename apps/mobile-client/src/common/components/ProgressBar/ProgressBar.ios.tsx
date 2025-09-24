import { Host, LinearProgress } from '@expo/ui/swift-ui'
import { ProgressBarProps } from './ProgressBar.types'

export function ProgressBar({ progress, total, color, style, ...props }: ProgressBarProps) {
  const normalized = (() => {
    if (typeof total === 'number' && total > 0) {
      return Math.min(Math.max(progress / total, 0), 1)
    }

    return Math.min(Math.max(progress, 0), 1)
  })()

  return (
    <Host style={style} {...props}>
      <LinearProgress progress={normalized} color={color} />
    </Host>
  )
}
