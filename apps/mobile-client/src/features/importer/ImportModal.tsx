import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SourceSelectionScreen } from './screens/SourceSelectionScreen'
import { MessengerImportFlow } from './sources/messenger/MessengerImportFlow'
import { ManualStackParamList } from './types'

const ImportModalStack = createNativeStackNavigator<ManualStackParamList>()

export const ImportModal = () => {
  return (
    <ImportModalStack.Navigator
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <ImportModalStack.Screen name="index" component={SourceSelectionScreen} />
      <ImportModalStack.Screen name="messenger" component={MessengerImportFlow} />
      <ImportModalStack.Screen name="whatsapp" component={() => <></>} />
    </ImportModalStack.Navigator>
  )
}
