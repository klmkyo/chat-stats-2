export const hexToRgb = (hex: string) => {
  const [r, g, b] = hex.match(/\w\w/g)?.map((c) => parseInt(c, 16)) ?? []
  return `${r} ${g} ${b}`
}

export const hexToHexNumber = (hex: string) => {
  return parseInt(hex, 16)
}


// mixes 2 colors with a given ratio
export const mixColors = (baseColor: string, mixColor: string, ratio: number) => {
  const baseColorRgb = hexToHexNumber(baseColor.replace('#', ''))
  const mixColorRgb = hexToHexNumber(mixColor.replace('#', ''))

  const baseRed = baseColorRgb >> 16
  const baseGreen = (baseColorRgb >> 8) & 0xFF
  const baseBlue = baseColorRgb & 0xFF

  const mixRed = mixColorRgb >> 16
  const mixGreen = (mixColorRgb >> 8) & 0xFF
  const mixBlue = mixColorRgb & 0xFF
  
  const mixedRed = Math.round(mixRed * ratio + baseRed * (1 - ratio))
  const mixedGreen = Math.round(mixGreen * ratio + baseGreen * (1 - ratio))
  const mixedBlue = Math.round(mixBlue * ratio + baseBlue * (1 - ratio))

  return `#${mixedRed.toString(16)}${mixedGreen.toString(16)}${mixedBlue.toString(16)}`
}