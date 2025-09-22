import { useCallback, useEffect } from 'react'

import ProcessorBridgeModule from '@/modules/processor-bridge/src/ProcessorBridgeModule'

import { useImporter } from './ImporterFlow'

export const useImporterProgress = () => {
  const { lock, unlock, setProgress } = useImporter()

  useEffect(() => {
    const subscription = ProcessorBridgeModule.addListener('onImportProgress', ({ processed, total }) => {
      setProgress(() => ({
        status: 'running',
        processed,
        total,
      }))
    })

    return () => {
      subscription.remove()
    }
  }, [setProgress])

  const begin = useCallback(() => {
    lock()
    setProgress(() => ({ status: 'running', processed: 0, total: 0 }))
  }, [lock, setProgress])

  const succeed = useCallback(
    (message?: string) => {
      unlock()
      setProgress((prev) => {
        if (prev.status === 'running' || prev.status === 'success') {
          return { status: 'success', processed: prev.processed, total: prev.total, message }
        }
        return { status: 'success', processed: 0, total: 0, message }
      })
    },
    [setProgress, unlock],
  )

  const fail = useCallback(
    (message: string) => {
      unlock()
      setProgress((prev) => {
        if (prev.status === 'running' || prev.status === 'success') {
          return { status: 'error', processed: prev.processed, total: prev.total, message }
        }
        return { status: 'error', message }
      })
    },
    [setProgress, unlock],
  )

  return { begin, succeed, fail }
}
