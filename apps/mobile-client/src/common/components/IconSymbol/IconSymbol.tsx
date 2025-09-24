// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { ComponentProps } from 'react'
import { cssInterop } from 'react-native-css-interop'
import { IconSymbolProps, SFIconSymbol } from './IconSymbol.types'

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: Record<SFIconSymbol, ComponentProps<typeof MaterialIcons>['name']> = {
  plus: 'add',
  lock: 'lock',
  'chevron.right': 'chevron-right',
  xmark: 'close',
  'chevron.left': 'chevron-left',
  'square.and.arrow.up': 'import-export',
  trash: 'delete',
}

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
