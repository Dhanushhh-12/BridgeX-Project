/**
 * Join conditional CSS class names cleanly without external runtime overhead.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
