import { HelloWave } from '@/components/HelloWave'
import ParallaxScrollView from '@/components/ParallaxScrollView'
import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'
import { Image } from 'expo-image'
import { Button, Platform, ScrollView, StyleSheet } from 'react-native'

import ProcessorBridge, { FileInfo } from '@/modules/processor-bridge'
import { useState } from 'react'

export default function HomeScreen() {
  const [zipFiles, setZipFiles] = useState<FileInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">ZIP Demo</ThemedText>
        <Button title="Pick ZIP and List" onPress={async () => {
          try {
            // Clear previous results
            setZipFiles(null)
            setError(null)
            
            // Get JSON response from native bridge
            const jsonResponse = await ProcessorBridge.pickAndListZip()
            
            // Parse the JSON to get structured file data
            const fileData: FileInfo[] = JSON.parse(jsonResponse)
            setZipFiles(fileData)
          } catch (e) {
            setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
          }
        }} />
        
        {/* Display error if any */}
        {error && (
          <ScrollView style={styles.outputBox} contentContainerStyle={{ padding: 8 }}>
            <ThemedText style={[styles.mono, { color: 'red' }]}>{error}</ThemedText>
          </ScrollView>
        )}
        
        {/* Display structured file data */}
        {zipFiles && zipFiles.length > 0 && (
          <ScrollView style={styles.outputBox} contentContainerStyle={{ padding: 8 }}>
            <ThemedText style={styles.mono}>Found {zipFiles.length} items:</ThemedText>
            {zipFiles.map((file, index) => (
              <ThemedView key={index} style={styles.fileRow}>
                <ThemedText style={[styles.mono, styles.fileName]}>
                  {file.is_directory ? '📁' : '📄'} {file.name}
                </ThemedText>
                <ThemedText style={[styles.mono, styles.fileSize]}>
                  {file.is_directory ? 'Directory' : `${file.size} bytes`}
                </ThemedText>
              </ThemedView>
            ))}
          </ScrollView>
        )}
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try it</ThemedText>
        <ThemedText>
          Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes.
          Press{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </ThemedText>{' '}
          to open developer tools.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 2: Explore</ThemedText>
        <ThemedText>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run `}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  )
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  outputBox: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#6666',
    borderRadius: 8,
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
  },
  fileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  fileName: {
    flex: 1,
    paddingRight: 8,
  },
  fileSize: {
    color: '#666',
    minWidth: 80,
    textAlign: 'right',
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
})
