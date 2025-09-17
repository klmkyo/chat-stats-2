import { ThemedText } from '@/common/components/ThemedText'
import { range } from '@/common/helpers/range'
import { ScrollView } from 'react-native'

export const ChatsPageContents = () => {
  return (
    <ScrollView contentContainerClassName="">
      {range(200).map((item) => (
        <ThemedText key={item}>{item}</ThemedText>
      ))}
    </ScrollView>
  )
}
