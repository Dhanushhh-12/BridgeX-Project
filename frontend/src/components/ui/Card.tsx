import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type CardVariant = 'default' | 'sand' | 'ivory'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: ReactNode
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'bg-surface border-border-neutral',
  sand: 'bg-sand/65 border-border-neutral',
  ivory: 'bg-ivory border-border-neutral',
}

const PADDING_CLASSES = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
}

export function Card({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <section
      className={cn(
        'rounded-sm border',
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-border-neutral pb-3.5', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardTitle({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('bx-heading-card', className)} {...rest}>
      {children}
    </h3>
  )
}

export function CardDescription({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-1 text-xs text-charcoal/75', className)} {...rest}>
      {children}
    </p>
  )
}

export function CardContent({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('pt-4', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardFooter({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border-neutral pt-3.5', className)}
      {...rest}
    >
      {children}
    </div>
  )
}
