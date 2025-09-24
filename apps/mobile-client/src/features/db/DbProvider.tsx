import { drizzle } from 'drizzle-orm/expo-sqlite'
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator'
import { useRouter } from 'expo-router'
import { deleteDatabaseSync, openDatabaseSync, SQLiteProvider } from 'expo-sqlite'
import { createContext } from 'react'
import { Alert } from 'react-native'
import { useEffectOnceWhen } from 'rooks'
import migrations from '../../../drizzle/migrations'

export const DATABASE_NAME = 'chats.db'

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
  const router = useRouter()
  // TODO get errors from here, and show a corrupted db modal if needed, prompting user to reset it.
  useMigrations(db, migrations)

  useEffectOnceWhen(async () => {
    const { ok, errors } = await checkDbHealth()
    if (!ok) {
      Alert.alert(
        'The messages database is corrupted. You will need to reimport your messages',
        errors?.join('\n'),
      )
      expoDb.closeSync()
      // TODO this does not work
      deleteDatabaseSync(DATABASE_NAME)
      router.reload()
    }
  })

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} useSuspense>
      <DbContext.Provider value={{ db }}>{children}</DbContext.Provider>
    </SQLiteProvider>
  )
}
