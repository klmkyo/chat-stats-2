import { SearchPageContents } from '@/features/search/SearchPageContents'
import { Stack } from 'expo-router'

const SearchPage = () => {
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
          },
        }}
      />

      <SearchPageContents />
    </>
  )
}

export default SearchPage
