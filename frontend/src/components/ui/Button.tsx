import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children?: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Deep Editorial Blue text on Coral Orange clears WCAG AA contrast while preserving 10% accent identity
  primary:
    'bg-coral text-editorial-blue border border-coral hover:bg-coral-hover hover:border-coral-hover font-semibold',
  secondary:
    'bg-editorial-blue text-surface border border-editorial-blue hover:bg-editorial-blue-hover hover:border-editorial-blue-hover font-medium',
  outline:
    'bg-surface text-editorial-blue border border-border-neutral hover:bg-sand/60 hover:border-editorial-blue/40 font-medium',
  ghost:
    'bg-transparent text-editorial-blue border border-transparent hover:bg-sand/70 font-medium',
  danger:
    'bg-surface text-editorial-blue border border-coral hover:bg-coral/15 font-semibold',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled || isLoading)

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.1 }}
      className={cn(
        'inline-flex items-center justify-center rounded-sm transition-colors duration-150 select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-editorial-blue',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
      ) : (
        leftIcon && <span className="shrink-0" aria-hidden="true">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && (
        <span className="shrink-0" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </motion.button>
  )
}
