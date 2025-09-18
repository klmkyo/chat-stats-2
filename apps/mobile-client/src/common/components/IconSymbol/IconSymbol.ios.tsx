import { SFIconSymbol } from '@/common/constants/sf-icon-symbols'
import { SymbolView, SymbolWeight } from 'expo-symbols'
import { StyleProp, ViewStyle } from 'react-native'
import { cssInterop } from 'react-native-css-interop'

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
  ...props
}: {
  name: SFIconSymbol
  size?: number
  color?: string
  style?: StyleProp<ViewStyle>
  weight?: SymbolWeight
  className?: string
  colorClassName?: string
}) {
  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={name}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
      {...props}
    />
  )
}

cssInterop(SymbolView, {
  colorClassName: {
    target: false,
    nativeStyleToProp: {
      color: 'tintColor',
    },
  },
})
