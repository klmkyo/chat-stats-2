import { requireNativeView } from 'expo'
import * as React from 'react'

import { ProcessorBridgeViewProps } from './ProcessorBridge.types'

const NativeView: React.ComponentType<ProcessorBridgeViewProps> =
  requireNativeView('ProcessorBridge')

export default function ProcessorBridgeView(props: ProcessorBridgeViewProps) {
  return <NativeView {...props} />
}
