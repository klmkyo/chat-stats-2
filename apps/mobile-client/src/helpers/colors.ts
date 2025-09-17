export const hexToRgb = (hex: string) => {
  const [r, g, b] = hex.match(/\w\w/g)?.map(c => parseInt(c, 16)) ?? [];
  return `${r} ${g} ${b}`;
}
