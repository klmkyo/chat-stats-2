import { EStorageKey } from '@/common/constants/storage'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator'
import { deleteDatabaseSync, openDatabaseSync, SQLiteProvider } from 'expo-sqlite'
import { createContext } from 'react'
import { Alert, DevSettings } from 'react-native'
import { useEffectOnceWhen } from 'rooks'
import migrations from '../../../drizzle/migrations'
import { storage } from '../../common/helpers/storage'

export const DATABASE_NAME = 'chats.db'

const resetDbIfRequested = () => {
  const shouldReset = storage.getBoolean(EStorageKey.DB_RESET_PENDING)
  if (!shouldReset) return

  try {
    deleteDatabaseSync(DATABASE_NAME)
  } catch (error) {
    console.warn('Failed to reset chats database during startup', error)
  } finally {
    storage.delete(EStorageKey.DB_RESET_PENDING)
  }
}

resetDbIfRequested()

const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true })
const db = drizzle(expoDb)

export const DbContext = createContext<{ db: typeof db } | null>(null)

const checkDbHealth = async () => {
  try {
    // Fast check first
    const quick = await expoDb.getAllAsync<{ integrity_check: string }>(`PRAGMA quick_check;`)
    const quickMsgs = quick.map((r) => r.integrity_check).filter((m) => m !== 'ok')
    if (quickMsgs.length === 0) return { ok: true }

    const full = await expoDb.getAllAsync<{ integrity_check: string }>(`PRAGMA integrity_check;`)
    const msgs = full.map((r) => r.integrity_check).filter((m) => m !== 'ok')
    return msgs.length === 0 ? { ok: true } : { ok: false, errors: msgs }
  } catch (e: unknown) {
    const msg = String(e instanceof Error ? e.message : e)
    return { ok: false, errors: [msg] }
  }
}

export const DbProvider = ({ children }: { children: React.ReactNode }) => {
  useMigrations(db, migrations)

  useEffectOnceWhen(async () => {
    const { ok, errors } = await checkDbHealth()
    if (!ok) {
      Alert.alert(
        'The messages database is corrupted, you will need to reimport your messages. The app will close now and reset.',
        errors?.join('\n'),
        [
          {
            text: 'Reset',
            onPress: () => {
              storage.set(EStorageKey.DB_RESET_PENDING, true)
              DevSettings.reload()
            },
          },
        ],
      )
    }
  })

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} useSuspense>
      <DbContext.Provider value={{ db }}>{children}</DbContext.Provider>
    </SQLiteProvider>
  )
}
