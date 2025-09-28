import { buildAutoMergeSuggestions } from '@/features/chats/merge/utils'
import { useQuery } from '@tanstack/react-query'
import { useChats } from './useChats'

export const useAutoMergeSuggestions = () => {
  const { chats } = useChats()

  return useQuery({
    queryKey: ['auto-merge-suggestions', chats],
    queryFn: () => {
      console.log('Building auto merge suggestions')
      return buildAutoMergeSuggestions(chats)
    },
  })
}
