
export function getKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[]
}

export function getValues<T extends object>(obj: T): T[keyof T][] {
  return Object.values(obj) as T[keyof T][]
}

type ObjectEntry<BaseType> = [keyof BaseType, BaseType[keyof BaseType]]
type ObjectEntries<BaseType> = ObjectEntry<BaseType>[]
export type Entries<BaseType> = BaseType extends object ? ObjectEntries<BaseType> : never

export function getEntries<T extends object>(obj: T) {
  return Object.entries(obj) as Entries<T>
}

export const fromEntries = <const T extends readonly (readonly [PropertyKey, unknown])[]>(
  entries: T
): { [K in T[number] as K[0]]: K[1] } => {
  return Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] };
};
