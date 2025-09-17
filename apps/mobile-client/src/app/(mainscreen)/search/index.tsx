import { useDebugEnabled } from '@/common/hooks/useDebugEnabled'
import { SearchPageContents } from '@/features/search/SearchPageContents'
import { Stack } from 'expo-router'
import { useCallback, useRef } from 'react'
import { NativeSyntheticEvent, TextInputChangeEventData } from 'react-native'

const SearchPage = () => {
  const [, toggleDebugEnabled] = useDebugEnabled()

  const handledDebugToggleRef = useRef(false)

  const handleSecretCode = useCallback(
    (event: NativeSyntheticEvent<TextInputChangeEventData>) => {
      const query = event.nativeEvent.text ?? ''
      const normalized = query.trim().toLowerCase()

      if (normalized.includes('skibididebug')) {
        if (handledDebugToggleRef.current) return
        handledDebugToggleRef.current = true

        toggleDebugEnabled()
      }
    },
    [toggleDebugEnabled],
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: 'Search',
          headerSearchBarOptions: {
            placement: 'integratedCentered',
            placeholder: 'Search',
            autoFocus: true,
            onChangeText: handleSecretCode,
            onBlur: () => (handledDebugToggleRef.current = false),
          },
        }}
      />

      <SearchPageContents />
    </>
  )
}

export default SearchPage
