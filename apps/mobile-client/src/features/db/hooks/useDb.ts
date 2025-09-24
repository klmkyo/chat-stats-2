import { ExpoSQLiteDatabase, useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { useContext } from 'react'
import { DbContext } from '../DbProvider'

export const useDb = () => {
  const context = useContext(DbContext)
  if (!context) {
    throw new Error('useDb must be used within a DbProvider')
  }

  return context.db
}

type LiveQueryParam = Parameters<typeof useLiveQuery>[0]

export const useDbQuery = <T extends LiveQueryParam>(query: (db: ExpoSQLiteDatabase) => T) => {
  const db = useDb()
  return useLiveQuery(query(db))
}
