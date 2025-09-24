import { ThemedText } from '@/common/components/ThemedText'
import { DATABASE_NAME } from '@/features/db/DbProvider'
import { FilePickerLayout } from '@/features/importer/components/FilePickerLayout'
import { useImporter } from '@/features/importer/context/ImporterContext'
import ProcessorBridgeModule from '@/modules/processor-bridge/src/ProcessorBridgeModule'
import * as DocumentPicker from 'expo-document-picker'
import { useRouter } from 'expo-router'
import { openDatabaseSync } from 'expo-sqlite'
import { View } from 'react-native'

export default function MessengerFilePickerScreen() {
  const router = useRouter()
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
      router.push('/import/messenger/progress')

      const status = await ProcessorBridgeModule.importMessengerArchives(filePaths, dbPath)

      if (status === 'success') {
        succeedImport()
        return
      }

      if (status === 'cancelled') {
        failImport('Import cancelled.')
        return
      }

      failImport(`Import finished with unknown status: ${status}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const normalized = message.toLowerCase()

      if (normalized.includes('cancelled') || normalized.includes('canceled')) {
        failImport('Import cancelled.')
      } else {
        failImport(message)
      }
    }
  }

  return (
    <FilePickerLayout.Container>
      <FilePickerLayout.Header>Import Messenger chats</FilePickerLayout.Header>

      <FilePickerLayout.Description>
        <ThemedText>
          Select all the files that were exported. Their names should look like this:
        </ThemedText>
        <View className="pl-3">
          <ThemedText>
            {`\u25CF`} facebook-username-{day}.{month}.{year}-a1B2c3D4.zip
          </ThemedText>
          <ThemedText>{`\u25CF`} messages.zip</ThemedText>
        </View>
      </FilePickerLayout.Description>

      <FilePickerLayout.Button onPress={handleImport}>Select Files</FilePickerLayout.Button>
    </FilePickerLayout.Container>
  )
}
