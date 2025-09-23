import { ThemedText } from '@/common/components/ThemedText'
import { DATABASE_NAME } from '@/features/db/DbProvider'
import * as DocumentPicker from 'expo-document-picker'
import { openDatabaseSync } from 'expo-sqlite'
import { View } from 'react-native'
import { useImporter } from '../../flow/ImporterContext'

import ProcessorBridgeModule from '@/modules/processor-bridge/src/ProcessorBridgeModule'
import { ImporterFlowImporterProps } from '../../flow/ImporterFlow'
import { ImporterImporter } from '../../flow/ImporterImporterComponents'

export const MessengerImporter = ({ navigation }: ImporterFlowImporterProps) => {
  const now = new Date()
  const day = now.getDate()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const { startImport, succeedImport, failImport } = useImporter()

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        multiple: true,
        copyToCacheDirectory: true,
      })

      const assets = 'assets' in result && result.assets ? result.assets : []
      if (result.canceled || assets.length === 0) {
        failImport('Import cancelled.')
        return
      }

      const filePaths = assets
        .map((asset) => asset.uri)
        .filter((uri) => typeof uri === 'string' && uri.length > 0)
        .map((uri) =>
          uri.startsWith('file://') ? decodeURIComponent(uri.replace('file://', '')) : uri,
        )

      if (filePaths.length === 0) {
        failImport('Unable to access selected files.')
        return
      }

      const sqliteDb = openDatabaseSync(DATABASE_NAME)
      const dbPath = sqliteDb.databasePath
      sqliteDb.closeSync()

      startImport()
      navigation.navigation.navigate('importProgress')

      await ProcessorBridgeModule.importMessengerArchives(filePaths, dbPath)

      succeedImport()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const normalized = message.toLowerCase()

      // Treat cancellations as a neutral outcome.
      if (normalized.includes('cancelled') || normalized.includes('canceled')) {
        failImport('Import cancelled.')
      } else {
        failImport(message)
      }
    } finally {
      succeedImport()
    }
  }

  return (
    <ImporterImporter.Container>
      <ImporterImporter.Header>Import Messenger chats</ImporterImporter.Header>

      <ImporterImporter.Description>
        <ThemedText>
          Select all the files that were exported. Their names should look like this:
        </ThemedText>
        <View className="pl-3">
          <ThemedText>
            {`\u25CF`} facebook-username-{day}.{month}.{year}-a1B2c3D4.zip
          </ThemedText>
          <ThemedText>{`\u25CF`} messages.zip</ThemedText>
        </View>
      </ImporterImporter.Description>

      <ImporterImporter.Button onPress={handleImport}>Select Files</ImporterImporter.Button>
    </ImporterImporter.Container>
  )
}
