import {
  EExportBrand,
  EXPORT_BRAND_DETAILS,
  ExportBrandDetails,
} from '@/features/chatapps/constants'
import ProcessorBridgeModule from '@/modules/processor-bridge/src/ProcessorBridgeModule'
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { ImportProgress } from '../types'

export type ImporterContextValue = {
  brand: EExportBrand
  brandDetails: ExportBrandDetails

  importStatus: ImportProgress
  startImport: () => void
  succeedImport: () => void
  failImport: (message: string) => void
}

const ImporterContext = createContext<ImporterContextValue | null>(null)

export const ImporterProvider = ({
  children,
  brand,
}: {
  children: ReactNode
  brand: EExportBrand
}) => {
  const [importStatus, setImportStatus] = useState<ImportProgress>({ status: 'idle' })

  useEffect(() => {
    const subscription = ProcessorBridgeModule.addListener(
      'onImportProgress',
      ({ processed, total }) => {
        setImportStatus((prev) => ({ ...prev, processed, total }))
      },
    )

    return () => {
      subscription.remove()
    }
  }, [])

  const startImport = useCallback(() => {
    setImportStatus((prev) => ({ ...prev, status: 'running' }))
  }, [])

  const succeedImport = useCallback(() => {
    setImportStatus((prev) => ({ ...prev, status: 'success' }))
  }, [])

  const failImport = useCallback((message: string) => {
    setImportStatus((prev) => ({ ...prev, status: 'error', message }))
  }, [])

  const brandDetails = EXPORT_BRAND_DETAILS[brand]

  return (
    <ImporterContext.Provider
      value={{
        brand,
        brandDetails,
        importStatus,
        startImport,
        succeedImport,
        failImport,
      }}
    >
      {children}
    </ImporterContext.Provider>
  )
}

export const useImporter = () => {
  const ctx = useContext(ImporterContext)
  if (!ctx) {
    throw new Error('useImporter must be used inside ImporterProvider')
  }
  return ctx
}
