// We whitelist allowed sf symbols here, so that we can later have an easily maintainable map of symbols to material icons.
export const SFIconSymbols = [
  'plus',
  'lock'
] as const

export type SFIconSymbol = (typeof SFIconSymbols)[number]