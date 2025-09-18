import { drizzle } from 'drizzle-orm/expo-sqlite'
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator'
import { openDatabaseSync, SQLiteProvider } from 'expo-sqlite'
import { createContext } from 'react'
import migrations from '../../../drizzle/migrations'

export const DATABASE_NAME = 'chats.db'

const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true })
const db = drizzle(expoDb)

export const DbContext = createContext<{ db: typeof db } | null>(null)

export const DbProvider = ({ children }: { children: React.ReactNode }) => {
  // TODO get errors from here, and show a corrupted db modal if needed, prompting user to reset it.
  useMigrations(db, migrations)

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} useSuspense>
      <DbContext.Provider value={{ db }}>{children}</DbContext.Provider>
    </SQLiteProvider>
  )
}
