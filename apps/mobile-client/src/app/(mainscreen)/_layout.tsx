import { useTheme } from '@/common/providers/ThemeProvider'
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs'

export default function TabLayout() {
  const { themeColors } = useTheme()

  return (
    <NativeTabs backgroundColor={themeColors.background}>
      <NativeTabs.Trigger name="(chats)">
        <Label>Chats</Label>
        <Icon sf="message" drawable="custom_android_drawable" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon sf="gear" drawable="custom_settings_drawable" />
        <Label>Settings</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search" role="search">
        <Label>Search</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
