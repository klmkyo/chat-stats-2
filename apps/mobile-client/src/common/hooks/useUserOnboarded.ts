import { useMMKVBoolean } from 'react-native-mmkv'
import { EStorageKey } from '../constants/storage'

export const useUserOnboarded = () => {
  const [userOnboarded = false, setUserOnboarded] = useMMKVBoolean(EStorageKey.USER_ONBOARDED)

  return [userOnboarded, setUserOnboarded] as const
}
