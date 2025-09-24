// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { cssInterop } from 'react-native-css-interop'
import { IconSymbolProps, MAPPING } from './IconSymbol.types'

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({ name, size = 24, color, style, ...props }: IconSymbolProps) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} {...props} />
}

cssInterop(MaterialIcons, {
  colorClassName: {
    target: false,
    nativeStyleToProp: {
      color: 'color',
    },
  },
})
