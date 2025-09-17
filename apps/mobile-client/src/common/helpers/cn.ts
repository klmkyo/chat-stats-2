import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'

/**
 * A helper that merges Tailwind classes together
 *
 * @example className={cn('text-white bg-primary', isDisabled && 'bg-primary-600')}
 * @see https://www.npmjs.com/package/clsx
 */
export const cn = (...inputs: ClassValue[]) => clsx(inputs)
