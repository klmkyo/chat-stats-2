import { cn } from '@/common/helpers/cn'
import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'
import { Text, TouchableOpacity, TouchableOpacityProps, View } from 'react-native'
import { ThemedText } from './ThemedText'

const buttonVariants = cva(
  'flex gap-2 flex-row items-center justify-center rounded-full active:scale-95 transition-all duration-150 relative',
  {
    variants: {
      variant: {
        primary: 'bg-primary',
        secondary: 'bg-card',
        outline: 'border-2 border-border bg-transparent',
        ghost: 'bg-transparent',
        destructive: 'bg-notification',
      },
      size: {
        sm: 'px-3 py-2 min-h-[32px]',
        md: 'px-4 py-3 min-h-[44px]',
        lg: 'px-6 py-4 min-h-[52px]',
      },
      disabled: {
        true: 'opacity-50',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      disabled: false,
    },
  },
)

const buttonTextVariants = cva('font-medium text-center', {
  variants: {
    variant: {
      primary: 'text-white',
      secondary: 'text-text',
      outline: 'text-text',
      ghost: 'text-primary',
      destructive: 'text-white',
    },
    size: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

export interface ButtonProps
  extends Omit<TouchableOpacityProps, 'disabled'>,
    VariantProps<typeof buttonVariants> {
  className?: string
  textClassName?: string
  children?: React.ReactNode
  disabled?: boolean
  isLoading?: boolean
}

// Separate ButtonText component for rendering button text with correct styles
interface ButtonTextProps extends VariantProps<typeof buttonTextVariants> {
  className?: string
  children: React.ReactNode
}

export function ButtonText({ variant, size, className, children }: ButtonTextProps) {
  return (
    <ThemedText className={cn(buttonTextVariants({ variant, size }), className)}>
      {children}
    </ThemedText>
  )
}

export function Button({
  variant,
  size,
  disabled = false,
  className,
  textClassName,
  children,
  style,
  isLoading = false,
  ...props
}: ButtonProps) {
  return (
    <TouchableOpacity
      className={cn(buttonVariants({ variant, size, disabled }), className)}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
      style={[{ borderCurve: 'continuous' }, style]}
      {...props}
    >
      {isLoading && (
        <View className="absolute inset-0 items-center justify-center z-10">
          <Text className="text-blue-500 font-extrabold bg-black">Loabing :)</Text>
        </View>
      )}

      {typeof children === 'string' ? (
        <ButtonText variant={variant} size={size} className={textClassName}>
          {children}
        </ButtonText>
      ) : (
        children
      )}
    </TouchableOpacity>
  )
}
