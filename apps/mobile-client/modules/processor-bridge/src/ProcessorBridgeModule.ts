import { NativeModule, requireNativeModule } from 'expo'

import { ProcessorBridgeModuleEvents } from './ProcessorBridge.types'

// Type for file information returned from Rust
export interface FileInfo {
  name: string
  size: number
  is_directory: boolean
}

declare class ProcessorBridgeModule extends NativeModule<ProcessorBridgeModuleEvents> {
  pickAndListZip(): Promise<string[]>
  ensureDatabaseInitialized(dbPath: string): Promise<string>
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ProcessorBridgeModule>('ProcessorBridge')
