import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { cn } from '@/common/helpers/cn'
import {
  EExportSource,
  EXPORT_BRAND_DETAILS,
  getExportBrandFromSource,
} from '@/features/chatapps/constants'
import { Image, View } from 'react-native'

interface ChatSourceIconProps {
  source: EExportSource
  size?: number
  className?: string
}

export const ChatSourceIcon = ({ source, size = 16, className }: ChatSourceIconProps) => {
  const brand = getExportBrandFromSource(source)
  const brandDetails = EXPORT_BRAND_DETAILS[brand]

  return (
    <View
      className={cn('relative items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <Image
        source={brandDetails.icon}
        style={{ width: size, height: size }}
        className="rounded-full"
      />
      {source === EExportSource.MESSENGER_E2E ? (
        <View className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3">
          <IconSymbol name="lock.fill" size={8} colorClassName="text-[#FFC743]" />
        </View>
      ) : null}
    </View>
  )
}

interface ChatSourceIconsProps {
  sources: EExportSource[]
  iconSize?: number
  className?: string
}

export const ChatSourceIcons = ({ sources, iconSize = 16, className }: ChatSourceIconsProps) => (
  <View className={cn('flex-row items-center gap-1', className)}>
    {sources.map((source, index) => (
      <ChatSourceIcon key={`${source}-${index}`} source={source} size={iconSize} />
    ))}
  </View>
)
