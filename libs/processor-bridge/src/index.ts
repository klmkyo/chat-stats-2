// Reexport the native module. On web, it will be resolved to ProcessorBridgeModule.web.ts
// and on native platforms to ProcessorBridgeModule.ts
export { default } from './ProcessorBridgeModule';
export { default as ProcessorBridgeView } from './ProcessorBridgeView';
export * from  './ProcessorBridge.types';
