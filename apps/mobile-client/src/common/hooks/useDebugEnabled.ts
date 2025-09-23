import { useCallback } from 'react'
import { useMMKVBoolean } from 'react-native-mmkv'

import { EStorageKey } from '@/common/constants/storage'

export const useDebugEnabled = () => {
  const [storedDebugEnabled = false, setStoredDebugEnabled] = useMMKVBoolean(
    EStorageKey.DEBUG_ENABLED,
  )

  const toggleDebugEnabled = useCallback(() => {
    setStoredDebugEnabled((prev) => !prev)
  }, [setStoredDebugEnabled])

  const debugEnabled = __DEV__ || storedDebugEnabled

  return [debugEnabled, toggleDebugEnabled] as const
}
