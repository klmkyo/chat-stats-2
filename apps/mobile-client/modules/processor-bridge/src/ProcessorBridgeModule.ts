import { NativeModule, requireNativeModule } from 'expo';

import { ProcessorBridgeModuleEvents } from './ProcessorBridge.types';

declare class ProcessorBridgeModule extends NativeModule<ProcessorBridgeModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
  rustAdd(a: number, b: number): Promise<number>;
}


// This call loads the native module object from the JSI.
export default requireNativeModule<ProcessorBridgeModule>('ProcessorBridge');
