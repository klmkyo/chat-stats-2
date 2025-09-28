import { EStorageKey } from '@/common/constants/storage'
import { useMemo } from 'react'
import { useMMKVObject } from 'react-native-mmkv'

const STORAGE_KEY = EStorageKey.AUTO_MERGE_IGNORED

export const useIgnoredSuggestionKeys = () => {
  const [keys = [], setKeys] = useMMKVObject<string[]>(STORAGE_KEY)
  const keysSet = useMemo(() => new Set(keys), [keys])

  const ignore = (key: string) => {
    setKeys((current) => {
      if (!current) return [key]

      if (current.includes(key)) return current
      return [...current, key]
    })
  }

  const unignore = (key: string) => {
    setKeys((current) => {
      if (!current) return []

      return current.filter((item) => item !== key)
    })
  }

  const toggle = (key: string) => {
    if (keysSet.has(key)) {
      unignore(key)
    } else {
      ignore(key)
    }
  }

  const clear = () => {
    setKeys([])
  }

  return {
    keys,
    keysSet,
    ignore,
    unignore,
    clear,
    toggle,
  } as const
}
