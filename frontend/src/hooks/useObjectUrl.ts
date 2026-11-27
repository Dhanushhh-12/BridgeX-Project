import { useEffect, useMemo } from 'react'

/**
 * Safely creates and revokes a browser object URL for an uploaded File without
 * calling setState inside useEffect.
 */
export function useObjectUrl(file: File | null): string | null {
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [objectUrl])

  return objectUrl
}
