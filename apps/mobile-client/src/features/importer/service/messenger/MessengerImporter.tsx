import { Button } from '@/common/components/Button'
import { ThemedText } from '@/common/components/ThemedText'
import { DATABASE_NAME } from '@/features/db/DbProvider'
import * as DocumentPicker from 'expo-document-picker'
import { openDatabaseSync } from 'expo-sqlite'
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'

import ProcessorBridgeModule from '@/modules/processor-bridge/src/ProcessorBridgeModule'

type ImportProgress = {
  processed: number
  total: number
}

const INITIAL_PROGRESS: ImportProgress = {
  processed: 0,
  total: 0,
}

export const MessengerImporter = () => {
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState<ImportProgress>(INITIAL_PROGRESS)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const subscription = ProcessorBridgeModule.addListener(
      'onImportProgress',
      ({ processed, total }) => {
        setProgress({ processed, total })
      },
    )

    return () => {
      subscription.remove()
    }
  }, [])

  const handleImport = useCallback(async () => {
    try {
      setIsImporting(true)
      setProgress(INITIAL_PROGRESS)
      setStatusMessage(null)
      setErrorMessage(null)

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        multiple: true,
        copyToCacheDirectory: true,
      })

      const assets = 'assets' in result && result.assets ? result.assets : []
      if (result.canceled || assets.length === 0) {
        setStatusMessage('Import cancelled.')
        return
      }

      const filePaths = assets
        .map((asset) => asset.uri)
        .filter((uri) => typeof uri === 'string' && uri.length > 0)
        .map((uri) =>
          uri.startsWith('file://') ? decodeURIComponent(uri.replace('file://', '')) : uri,
        )

      if (filePaths.length === 0) {
        setErrorMessage('Unable to access selected files.')
        return
      }

      const sqliteDb = openDatabaseSync(DATABASE_NAME)
      const dbPath = sqliteDb.databasePath
      sqliteDb.closeSync()

      const importedCount = await ProcessorBridgeModule.importMessengerArchives(filePaths, dbPath)

      setStatusMessage(
        importedCount === 1
          ? 'Imported 1 archive successfully.'
          : `Imported ${importedCount} archives successfully.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const normalized = message.toLowerCase()

      // Treat cancellations as a neutral outcome.
      if (normalized.includes('cancelled') || normalized.includes('canceled')) {
        setStatusMessage('Import cancelled.')
      } else {
        setErrorMessage(message)
      }
    } finally {
      setIsImporting(false)
    }
  }, [])

  const remaining = Math.max(progress.total - progress.processed, 0)

  return (
    <View className="p-4">
      <ThemedText>Import Messenger chats</ThemedText>
      <ThemedText color="secondary">
        Choose your exported Messenger ZIP files to normalise into the local database.
      </ThemedText>

      <View className="mt-4">
        <Button onPress={handleImport} disabled={isImporting}>
          {isImporting ? 'Importing…' : 'Select archives'}
        </Button>
      </View>

      {progress.total > 0 ? (
        <View className="mt-4">
          <ThemedText>
            {progress.processed} / {progress.total} JSON files processed
          </ThemedText>
          <ThemedText color="secondary">{remaining} remaining</ThemedText>
        </View>
      ) : null}

      {statusMessage ? (
        <View className="mt-4">
          <ThemedText>{statusMessage}</ThemedText>
        </View>
      ) : null}

      {errorMessage ? (
        <View className="mt-4">
          <ThemedText color="destructive">{errorMessage}</ThemedText>
        </View>
      ) : null}
    </View>
  )
}
