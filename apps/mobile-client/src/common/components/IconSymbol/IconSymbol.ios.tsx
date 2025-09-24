import { useTheme } from '@/common/providers/ThemeProvider'
import { SymbolView } from 'expo-symbols'
import { cssInterop } from 'react-native-css-interop'
import { IconSymbolProps } from './IconSymbol.types'

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
  ...props
}: IconSymbolProps) {
  const { themeColors } = useTheme()

  return (
    <SymbolView
      weight={weight}
      tintColor={color ?? themeColors.primary}
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
