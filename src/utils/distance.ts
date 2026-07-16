export interface LatLng {
  lat: number;
  lng: number;
}

export function isValidLatLng(point: LatLng | null | undefined): point is LatLng {
  if (!point) return false;
  const { lat, lng } = point;
  return (
    typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180
  );
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lng points, in kilometres. Returns
    null rather than a bogus number for invalid/missing coordinates — callers
    must not silently treat that as "0km away". */
export function haversineKm(a: LatLng | null | undefined, b: LatLng | null | undefined): number | null {
  if (!isValidLatLng(a) || !isValidLatLng(b)) return null;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(Math.min(1, s)));
}

/** Distances under 1km read in metres (rounded to the nearest 10m so it
    doesn't look falsely precise), 1-99km to one decimal place, 100km+ as a
    whole number — matches how field staff actually talk about distance. */
export function formatDistanceKm(km: number | null): string {
  if (km === null || !Number.isFinite(km) || km < 0) return '—';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)}m`;
  if (km < 100) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

/** A device fix this coarse (IP/network geolocation resolving to a whole
    city or region rather than an actual GPS/cell position) shouldn't be
    presented as "nearby" — the number would be technically computed
    correctly but operationally misleading in a small rural reserve. */
export const LOW_ACCURACY_METRES = 10_000;

export function isLowAccuracy(accuracyMetres: number | undefined): boolean {
  return typeof accuracyMetres === 'number' && Number.isFinite(accuracyMetres) && accuracyMetres > LOW_ACCURACY_METRES;
}
