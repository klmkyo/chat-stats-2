// Reexport the native module. On web, it will be resolved to ProcessorBridgeModule.web.ts
// and on native platforms to ProcessorBridgeModule.ts
export * from './src/ProcessorBridge.types';
export { default } from './src/ProcessorBridgeModule';
export type { FileInfo } from './src/ProcessorBridgeModule';
export { default as ProcessorBridgeView } from './src/ProcessorBridgeView';

