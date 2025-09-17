import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * A helper that merges Tailwind classes together
 *
 * @example className={cn('text-white bg-primary', isDisabled && 'bg-primary-600')}
 * @see https://www.npmjs.com/package/clsx
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
