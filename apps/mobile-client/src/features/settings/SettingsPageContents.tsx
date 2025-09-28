import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { SFIconSymbol } from '@/common/components/IconSymbol/IconSymbol.types'
import { ThemedText } from '@/common/components/ThemedText'
import { Href, Link, Stack } from 'expo-router'
import { ScrollView, View } from 'react-native'

const SettingsLink = ({
  href,
  children,
  icon,
}: {
  href: Href
  children: React.ReactNode
  icon: SFIconSymbol
}) => {
  return (
    <Link href={href} className="w-full active:opacity-50">
      <View className="flex-row items-center gap-2 flex bg-card rounded-full p-4 w-full">
        <IconSymbol name={icon} size={24} />

        <View>
          <ThemedText className="font-medium text-lg">{children}</ThemedText>
        </View>

        <View className="ml-auto mr-1">
          <IconSymbol name="chevron.right" size={18} />
        </View>
      </View>
    </Link>
  )
}

export const SettingsPageContents = () => {
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: 'Settings',
        }}
      />
      <ScrollView contentContainerClassName="gap-3" className="p-4">
        <SettingsLink href="/settings/exports" icon="square.and.arrow.up">
          Exports
        </SettingsLink>

        <SettingsLink href="/merge-suggestions" icon="wand.and.stars">
          Suggested merges
        </SettingsLink>
      </ScrollView>
    </>
  )
}
