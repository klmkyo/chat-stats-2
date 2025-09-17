import { SearchPageContents } from '@/features/search/SearchPageContents'
import { Stack } from 'expo-router'

const SettingsPage = () => {
  return (
    <>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: 'Search',
          headerSearchBarOptions: {
            placement: 'automatic',
            placeholder: 'Search',
          },
        }}
      />

      <SearchPageContents />
    </>
  )
}

export default SettingsPage
