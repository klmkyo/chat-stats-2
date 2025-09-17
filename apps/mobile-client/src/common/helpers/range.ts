export const range = (startOrEnd: number, end?: number) => {
  const start = end === undefined ? 0 : startOrEnd
  const stop = end ?? startOrEnd
  const size = stop - start
  return Array.from({ length: size }, (_, i) => i + start)
}
