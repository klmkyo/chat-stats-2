import { ImageSourcePropType } from 'react-native'

export enum EExportBrand {
  MESSENGER = 'messenger',
  WHATSAPP = 'whatsapp',
}

export enum EExportSource {
  MESSENGER_FB = 'messenger:facebook',
  MESSENGER_E2E = 'messenger:e2e',
  WHATSAPP = 'whatsapp',
}

export interface ExportBrandDetails {
  brand: EExportBrand
  name: string
  icon: ImageSourcePropType
  color: string
}

export const EXPORT_BRAND_DETAILS: Record<EExportBrand, ExportBrandDetails> = {
  [EExportBrand.MESSENGER]: {
    brand: EExportBrand.MESSENGER,
    name: 'Messenger',
    icon: require('./assets/logos/messenger.png'),
    color: '#0B67FF',
  },
  [EExportBrand.WHATSAPP]: {
    brand: EExportBrand.WHATSAPP,
    name: 'WhatsApp',
    icon: require('./assets/logos/whatsapp.png'),
    color: '#26D366',
  },
}
