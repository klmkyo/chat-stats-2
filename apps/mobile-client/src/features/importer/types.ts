import { EExportBrand } from '@/features/chatapps/constants'

export type ImporterStackParamList = {
  slides: undefined
  filePicker: undefined
  importProgress: undefined
}

export type ManualStackParamList = {
  index: undefined
} & {
  [key in `${EExportBrand}`]: undefined
}

export type ImportProgress = {
  status: 'idle' | 'running' | 'success' | 'error'
  processed?: number
  total?: number
  message?: string
}

