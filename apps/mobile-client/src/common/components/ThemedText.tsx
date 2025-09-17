import { cn } from '@/common/helpers/cn'
import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'
import { Text as RNText, TextProps as RNTextProps } from 'react-native'

const themedTextVariants = cva('font-normal leading-normal', {
  variants: {
    variant: {
      title: 'text-3xl font-bold leading-tight',
      heading: 'text-xl font-semibold leading-relaxed',
      body: 'text-base font-normal leading-normal',
      caption: 'text-sm font-medium leading-tight',
      small: 'text-xs font-normal leading-tight',
    },
    color: {
      primary: 'text-text',
      secondary: 'text-text/70',
      muted: 'text-text/50',
      accent: 'text-primary',
      destructive: 'text-notification',
    },
  },
  defaultVariants: {
    variant: 'body',
    color: 'primary',
  },
})

export interface ThemedTextProps extends RNTextProps, VariantProps<typeof themedTextVariants> {
  className?: string
  children?: React.ReactNode
}

export function ThemedText({ variant, color, className, children, ...props }: ThemedTextProps) {
  return (
    <RNText className={cn(themedTextVariants({ variant, color }), className)} {...props}>
      {children}
    </RNText>
  )
}
