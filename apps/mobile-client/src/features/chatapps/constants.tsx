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

export interface ExportSourceDetails {
  name: string
  brand: EExportBrand
}

export const EXPORT_SOURCE_DETAILS: Record<EExportSource, ExportSourceDetails> = {
  [EExportSource.MESSENGER_FB]: {
    name: 'Facebook Archive',
    brand: EExportBrand.MESSENGER,
  },
  [EExportSource.MESSENGER_E2E]: {
    name: 'End-to-End Archive',
    brand: EExportBrand.MESSENGER,
  },
  [EExportSource.WHATSAPP]: {
    name: 'WhatsApp',
    brand: EExportBrand.WHATSAPP,
  },
}

export const getExportBrandFromSource = (source: EExportSource): EExportBrand => {
  return EXPORT_SOURCE_DETAILS[source]?.brand ?? EExportBrand.MESSENGER
}

export const getExportSourceLabel = (source: EExportSource): string => {
  return EXPORT_SOURCE_DETAILS[source]?.name ?? source
}
