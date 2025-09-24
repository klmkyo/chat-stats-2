import { NativeModule, requireNativeModule } from 'expo'

import { ProcessorBridgeModuleEvents } from './ProcessorBridge.types'

// Type for file information returned from Rust
export interface FileInfo {
  name: string
  size: number
  is_directory: boolean
}

export type ImportStatus = 'success' | 'cancelled'

declare class ProcessorBridgeModule extends NativeModule<ProcessorBridgeModuleEvents> {
  importMessengerArchives(filePaths: string[], dbPath: string): Promise<ImportStatus>
  cancelImport(): Promise<void>
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ProcessorBridgeModule>('ProcessorBridge')
