import { IconSymbol } from '@/common/components/IconSymbol/IconSymbol'
import {
  EExportBrand,
  EXPORT_BRAND_DETAILS,
  ExportBrandDetails,
} from '@/features/chatapps/constants'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Stack, useRouter } from 'expo-router'
import { Children, createContext, isValidElement, ReactNode, useContext } from 'react'
import { Pressable } from 'react-native'
import { ImporterSlides } from './ImporterSlides'

type ImportProgressIdle = {
  status: 'idle'
}

type ImportProgressRunning = {
  status: 'running'
  processed: number
  total: number
}

type ImportProgressSuccess = {
  status: 'success'
}

type ImportProgressError = {
  status: 'error'
  message: string
}

export type ImportProgress =
  | ImportProgressIdle
  | ImportProgressRunning
  | ImportProgressSuccess
  | ImportProgressError

type ImporterContextValue = {
  components: {
    slides: ReactNode[]
    importer: ReactNode | null
  }
  brand: EExportBrand
  brandDetails: ExportBrandDetails
}

const ImporterContext = createContext<ImporterContextValue | null>(null)

export const useImporter = () => {
  const ctx = useContext(ImporterContext)
  if (!ctx) {
    throw new Error('useImporter must be used inside ImporterFlow')
  }
  return ctx
}

export type ImporterStackParamList = {
  // slides
  index: undefined
  importer: undefined
}

const ImporterFlowStack = createNativeStackNavigator<ImporterStackParamList>()

export const ImporterFlow = ({ children, brand }: { children: ReactNode; brand: EExportBrand }) => {
  const router = useRouter()

  const slides: ReactNode[] = []
  let importer: ReactNode | null = null

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return

    if (child.type === ImporterFlowSlide) {
      slides.push(child)
    } else if (child.type === ImporterFlowImporter) {
      importer = child
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

      <ImporterContext.Provider value={{ components: { slides, importer }, brand, brandDetails }}>
        <ImporterFlowStack.Navigator screenOptions={{ headerShown: false }}>
          <ImporterFlowStack.Screen name="index" component={ImporterSlides} />
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

ImporterFlow.Slide = ImporterFlowSlide

const ImporterFlowImporter = (props: { children: ReactNode }) => {
  return null
}

ImporterFlow.Importer = ImporterFlowImporter
