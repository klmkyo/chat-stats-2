import { EExportBrand, ExportBrandDetails } from '@/features/chatapps/constants'
import { createContext, ReactNode, useContext } from 'react'
import { ImportProgress } from '../types'

export type ImporterContextValue = {
  components: {
    slides: ReactNode[]
  }
  brand: EExportBrand
  brandDetails: ExportBrandDetails

  importStatus: ImportProgress
  setImportStatus: (status: ImportProgress) => void
  startImport: () => void
  succeedImport: () => void
  failImport: (message: string) => void
}

export const ImporterContext = createContext<ImporterContextValue | null>(null)

export const useImporter = () => {
  const ctx = useContext(ImporterContext)
  if (!ctx) {
    throw new Error('useImporter must be used inside ImporterFlow')
  }
  return ctx
}
