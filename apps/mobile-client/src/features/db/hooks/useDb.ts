import { is } from 'drizzle-orm'
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { SQL } from 'drizzle-orm/sql'
import { SQLiteTable, SQLiteView, getTableConfig, getViewConfig } from 'drizzle-orm/sqlite-core'
import { SQLiteRelationalQuery } from 'drizzle-orm/sqlite-core/query-builders/query'
import type { AnySQLiteSelect } from 'drizzle-orm/sqlite-core/query-builders/select.types'
import { Subquery } from 'drizzle-orm/subquery'
import { addDatabaseChangeListener } from 'expo-sqlite'
import { atom, useAtom } from 'jotai'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DbContext } from '../DbProvider'

export const useDb = () => {
  const context = useContext(DbContext)
  if (!context) {
    throw new Error('useDb must be used within a DbProvider')
  }

  return context.db
}

type LiveQueryParam = Pick<AnySQLiteSelect, '_' | 'then'> | SQLiteRelationalQuery<'sync', unknown>

const dbVersionAtom = atom(0)

export const useInvalidateDb = () => {
  const [, setDbVersion] = useAtom(dbVersionAtom)

  return useCallback(() => {
    setDbVersion((prev) => prev + 1)
  }, [setDbVersion])
}

const baseNameSymbol = Symbol.for('drizzle:BaseName')

const asRelationalInternals = (query: SQLiteRelationalQuery<'sync', unknown>) => {
  return query as unknown as {
    mode?: 'first' | 'many'
    table: unknown
    config?: { with?: Record<string, unknown>; joins?: { table: unknown }[] }
    tableConfig?: { relations?: Record<string, { referencedTableName: string }> }
  }
}

const asSelectInternals = (select: Pick<AnySQLiteSelect, '_' | 'then'>) => {
  return select as unknown as {
    config?: { table?: unknown; joins?: { table: unknown }[] }
  }
}

const collectJoinTableNames = (joins: { table: unknown }[] | undefined) => {
  if (!Array.isArray(joins)) return []

  return joins
    .map(({ table }) => {
      if (is(table, SQLiteTable)) {
        return getTableConfig(table).name
      }

      if (is(table, SQLiteView)) {
        return getViewConfig(table).name
      }

      if (table && typeof table === 'object') {
        const maybeName = (table as Record<symbol | string, unknown>)[baseNameSymbol]
        if (typeof maybeName === 'string') {
          return maybeName
        }
      }

      return undefined
    })
    .filter((name): name is string => typeof name === 'string')
}

const collectRelationalTableNames = (query: SQLiteRelationalQuery<'sync', unknown>) => {
  const { config, tableConfig } = asRelationalInternals(query)

  const relationTableNames =
    config?.with && tableConfig?.relations
      ? Object.keys(config.with)
          .map((relationKey) => tableConfig.relations?.[relationKey]?.referencedTableName)
          .filter((name): name is string => typeof name === 'string')
      : []

  const joinTableNames = collectJoinTableNames(config?.joins)

  return [...relationTableNames, ...joinTableNames]
}

const collectSelectTableNames = (select: Pick<AnySQLiteSelect, '_' | 'then'>) => {
  const { config } = asSelectInternals(select)
  return collectJoinTableNames(config?.joins)
}

const useMultiTableLiveQuery = <T extends LiveQueryParam>(query: T) => {
  const [data, setData] = useState<Awaited<T>>(() => {
    if (is(query, SQLiteRelationalQuery)) {
      const { mode } = asRelationalInternals(query)
      return (mode === 'first' ? undefined : []) as Awaited<T>
    }

    return [] as Awaited<T>
  })
  const [error, setError] = useState<Error>()
  const [isLoading, setIsLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date>()

  useEffect(() => {
    const relationalInternals = is(query, SQLiteRelationalQuery)
      ? asRelationalInternals(query)
      : null
    const selectInternals = relationalInternals
      ? null
      : asSelectInternals(query as Pick<AnySQLiteSelect, '_' | 'then'>)
    const entity =
      (relationalInternals ? relationalInternals.table : selectInternals?.config?.table) ?? null

    if (is(entity, Subquery) || is(entity, SQL)) {
      setError(new Error('Selecting from subqueries and SQL are not supported in useLiveQuery'))
      return
    }

    let listener: ReturnType<typeof addDatabaseChangeListener> | undefined

    const executeQuery = () => {
      setIsLoading(true)
      ;(query as unknown as Promise<Awaited<T>>)
        .then((result) => {
          setData(result)
          setUpdatedAt(new Date())
        })
        .catch((err) => {
          setError(err instanceof Error ? err : new Error(String(err)))
        })
        .finally(() => {
          setIsLoading(false)
        })
    }

    executeQuery()

    if (is(entity, SQLiteTable) || is(entity, SQLiteView)) {
      const config = is(entity, SQLiteTable) ? getTableConfig(entity) : getViewConfig(entity)
      const watchingTables = new Set<string>([config.name])

      if (relationalInternals) {
        collectRelationalTableNames(query as SQLiteRelationalQuery<'sync', unknown>).forEach(
          (name) => watchingTables.add(name),
        )
      } else {
        collectSelectTableNames(query as Pick<AnySQLiteSelect, '_' | 'then'>).forEach((name) =>
          watchingTables.add(name),
        )
      }

      listener = addDatabaseChangeListener(({ tableName }) => {
        if (tableName && watchingTables.has(tableName)) {
          executeQuery()
        }
      })
    }

    return () => {
      listener?.remove()
    }
  }, [query])

  return {
    data,
    error,
    updatedAt,
    isLoading,
  } as const
}

export const useDbQuery = <T extends LiveQueryParam>(
  query: (db: ExpoSQLiteDatabase) => T,
  dependencies: unknown[] = [],
) => {
  const [dbVersion] = useAtom(dbVersionAtom)
  const db = useDb()

  const builtQuery = useMemo(() => {
    void dbVersion
    void dependencies
    return query(db)
    // Query can be unstable. We should rely on `dependencies` to rerun query if necessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, dbVersion, ...dependencies])
  return useMultiTableLiveQuery(builtQuery)
}
