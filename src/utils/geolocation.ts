export interface Coords {
  lat: number;
  lng: number;
}

// Never throws or blocks the caller — a guard's field update should still
// succeed if location permission is denied, GPS is unavailable, or it times
// out. Defaults tuned for a ONE-OFF capture (incident report, task update
// note) rather than continuous tracking: enableHighAccuracy asks for a real
// GPS fix instead of a fast-but-coarse network/WiFi estimate, and a 15s
// timeout gives a cold GPS lock (first request of the session, indoors,
// under canopy) time to complete — 5s was cutting it off before most
// devices could get a fix at all, which is why reports were frequently
// landing with "No GPS location captured".
export function getCurrentPosition(timeoutMs = 15_000): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 60_000, enableHighAccuracy: true },
    );
  });
}
