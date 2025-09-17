import { useDebugEnabled } from '@/common/hooks/useDebugEnabled'
import { useTheme } from '@/common/providers/ThemeProvider'
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs'

export default function TabLayout() {
  const { themeColors } = useTheme()
  const [debugEnabled] = useDebugEnabled()

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

      <NativeTabs.Trigger name="debug" hidden={!debugEnabled}>
        <Icon sf="switch.2" drawable="custom_settings_drawable" />
        <Label>Debug</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
