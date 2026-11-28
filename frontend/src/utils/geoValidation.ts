/**
 * Strict geographic coordinate validation and bounds helpers for AI Bridge X Maps.
 */

export interface GeoPointLike {
  id: string
  latitude?: number | null
  longitude?: number | null
}

export function isValidCoordinate(
  latitude: unknown,
  longitude: unknown,
): latitude is number {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false
  }
  // Reject explicit (0, 0) null-island placeholder coordinates
  if (latitude === 0 && longitude === 0) {
    return false
  }
  return true
}

export function partitionProjectsByCoordinates<T extends GeoPointLike>(items: T[]): {
  valid: Array<T & { latitude: number; longitude: number }>
  invalidOrMissing: T[]
} {
  const valid: Array<T & { latitude: number; longitude: number }> = []
  const invalidOrMissing: T[] = []

  for (const item of items) {
    if (isValidCoordinate(item.latitude, item.longitude)) {
      valid.push({
        ...item,
        latitude: item.latitude as number,
        longitude: item.longitude as number,
      })
    } else {
      invalidOrMissing.push(item)
    }
  }

  return { valid, invalidOrMissing }
}
