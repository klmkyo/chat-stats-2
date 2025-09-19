import { SFSymbol, SymbolWeight } from "expo-symbols"
import { OpaqueColorValue, StyleProp, TextStyle, ViewStyle } from "react-native"

// We whitelist allowed sf symbols here, so that we can later have an easily maintainable map of symbols to material icons.
export const SFIconSymbols = [
  'plus',
  'lock',
  'chevron.right',
  'xmark',
] as const satisfies SFSymbol[]

export type SFIconSymbol = (typeof SFIconSymbols)[number]

export interface IconSymbolProps {
  name: SFIconSymbol
  size?: number
  color?: string | OpaqueColorValue
  style?: StyleProp<ViewStyle & TextStyle>
  weight?: SymbolWeight
  className?: string
  colorClassName?: string
}