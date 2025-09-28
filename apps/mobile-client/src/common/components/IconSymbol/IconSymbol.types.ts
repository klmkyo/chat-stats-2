import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { SymbolView, SymbolWeight } from 'expo-symbols'
import { ComponentProps } from 'react'
import { OpaqueColorValue, StyleProp, TextStyle, ViewStyle } from 'react-native'

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
export const MAPPING = {
  plus: 'add',
  lock: 'lock',
  'chevron.right': 'chevron-right',
  xmark: 'close',
  'chevron.left': 'chevron-left',
  'square.and.arrow.up': 'import-export',
  trash: 'delete',
  message: 'message',
  'message.fill': 'message',
  person: 'person',
  'person.3': 'person-3',
  'person.3.fill': 'person-3',
  'person.fill': 'person',
  'lock.fill': 'lock',
  'wand.and.stars': 'auto-fix-high',
  'person.2.circle': 'groups',
  circle: 'circle',
  'checkmark.circle.fill': 'check-circle',
  'arrow.uturn.left': 'undo',
  'arrow.down': 'arrow-downward',
  'arrow.merge': 'call-merge',
} as const satisfies Partial<
  Record<ComponentProps<typeof SymbolView>['name'], ComponentProps<typeof MaterialIcons>['name']>
>

export type SFIconSymbol = keyof typeof MAPPING

export interface IconSymbolProps {
  name: SFIconSymbol
  size?: number
  color?: string | OpaqueColorValue
  style?: StyleProp<ViewStyle & TextStyle>
  weight?: SymbolWeight
  className?: string
  colorClassName?: string
}
