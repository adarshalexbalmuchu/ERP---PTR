export interface Coords {
  lat: number;
  lng: number;
}

// Never throws or blocks the caller — a guard's field update should still
// succeed if location permission is denied, GPS is unavailable, or it times out.
export function getCurrentPosition(timeoutMs = 5000): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
