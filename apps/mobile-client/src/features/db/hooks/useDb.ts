import { ExpoSQLiteDatabase, useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { atom, useAtom } from 'jotai'
import { useCallback, useContext } from 'react'
import { DbContext } from '../DbProvider'

export const useDb = () => {
  const context = useContext(DbContext)
  if (!context) {
    throw new Error('useDb must be used within a DbProvider')
  }

  return context.db
}

type LiveQueryParam = Parameters<typeof useLiveQuery>[0]

const dbVersionAtom = atom(0)

export const useInvalidateDb = () => {
  const [, setDbVersion] = useAtom(dbVersionAtom)

  return useCallback(() => {
    setDbVersion((prev) => prev + 1)
  }, [setDbVersion])
}

export const useDbQuery = <T extends LiveQueryParam>(query: (db: ExpoSQLiteDatabase) => T, dependencies: unknown[] = []) => {
  const [dbVersion] = useAtom(dbVersionAtom)
  const db = useDb()
  return useLiveQuery(query(db), [...dependencies, dbVersion])
}
