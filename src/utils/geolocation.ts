export interface Coords {
  lat: number;
  lng: number;
}

// Distinguishes *why* a capture failed so callers can tell a user "location
// is blocked, enable it in settings" (permanent, needs user action) apart
// from a transient GPS timeout (worth just retrying).
export type GeolocationFailureReason = 'unsupported' | 'permission_denied' | 'position_unavailable' | 'timeout';

export interface GeolocationResult {
  coords: Coords | null;
  failureReason: GeolocationFailureReason | null;
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
export function getCurrentPosition(timeoutMs = 15_000): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ coords: null, failureReason: 'unsupported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, failureReason: null }),
      (err) => {
        const failureReason: GeolocationFailureReason =
          err.code === err.PERMISSION_DENIED ? 'permission_denied'
          : err.code === err.TIMEOUT ? 'timeout'
          : 'position_unavailable';
        resolve({ coords: null, failureReason });
      },
      { timeout: timeoutMs, maximumAge: 60_000, enableHighAccuracy: true },
    );
  });
}

// Shared copy so callers that require a location (e.g. incident reports)
// give the reporter the same explanation regardless of where it's shown.
export function describeGeolocationFailure(reason: GeolocationFailureReason): string {
  switch (reason) {
    case 'permission_denied':
      return 'Location access is blocked for this app. Enable location for this site in your browser/phone settings, then try again.';
    case 'timeout':
      return 'Could not get a GPS fix in time — try moving to open sky or near a window and submit again.';
    case 'position_unavailable':
      return 'Your device could not determine a location. Check that GPS/location services are turned on and try again.';
    case 'unsupported':
      return 'This device or browser does not support location, which is required to submit a report.';
  }
}
