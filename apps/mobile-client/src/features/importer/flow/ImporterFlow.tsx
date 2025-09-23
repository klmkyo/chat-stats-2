import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import { isElementOfType } from '@/common/helpers/react-helpers'
import { EExportBrand, EXPORT_BRAND_DETAILS } from '@/features/chatapps/constants'
import ProcessorBridgeModule from '@/modules/processor-bridge/src/ProcessorBridgeModule'
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack'
import { Stack, useRouter } from 'expo-router'
import { Children, JSX, ReactNode, useCallback, useEffect, useState } from 'react'
import { Pressable } from 'react-native'
import { ImporterStackParamList, ImportProgress } from '../types'
import { ImporterContext } from './ImporterContext'
import { ImporterProgress } from './ImporterProgress'
import { ImporterSlides } from './ImporterSlides'

const ImporterFlowStack = createNativeStackNavigator<ImporterStackParamList>()

export const ImporterFlow = ({
  children,
  brand,
  importer,
}: {
  children: ReactNode
  brand: EExportBrand
  importer: (props: ImporterFlowImporterProps) => JSX.Element
}) => {
  const router = useRouter()

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

  const slides: ReactNode[] = []

  Children.forEach(children, (child) => {
    if (isElementOfType(child, ImporterFlowSlide)) {
      slides.push(child)
    }
  })

  const brandDetails = EXPORT_BRAND_DETAILS[brand]

  return (
    <>
      <Stack.Screen
        options={{
          title: `Import from ${brandDetails.name}`,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              className="size-10 flex items-center justify-center"
            >
              <IconSymbol name="chevron.left" weight="semibold" color={brandDetails.color} />
            </Pressable>
          ),
        }}
      />

      <ImporterContext.Provider
        value={{
          components: { slides },
          brand,
          brandDetails,
          importStatus,
          setImportStatus,
          startImport,
          succeedImport,
          failImport,
        }}
      >
        <ImporterFlowStack.Navigator screenOptions={{ headerShown: false }}>
          <ImporterFlowStack.Screen name="index" component={ImporterSlides} />
          <ImporterFlowStack.Screen name="filePicker" component={importer} />
          <ImporterFlowStack.Screen name="importProgress" component={ImporterProgress} />
        </ImporterFlowStack.Navigator>
      </ImporterContext.Provider>
    </>
  )
}

export type ImporterFlowSlideProps = {
  title: string
  subtitle: string
  children: ReactNode
}

const ImporterFlowSlide = (props: ImporterFlowSlideProps) => {
  return props.children
}
ImporterFlowSlide.displayName = 'ImporterFlowSlide'

ImporterFlow.Slide = ImporterFlowSlide

export type ImporterFlowImporterProps = {
  navigation: NativeStackScreenProps<ImporterStackParamList, 'filePicker'>
}
