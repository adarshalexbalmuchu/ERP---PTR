import { describe, it, expect } from 'vitest';
import { haversineKm, formatDistanceKm, isValidLatLng, isLowAccuracy } from './distance';

// Two real Palamau Tiger Reserve incident coordinates seen in production data.
const pointA = { lat: 23.89189189189189, lng: 84.20654186721457 };
const pointB = { lat: 23.885361743396, lng: 84.1929368050045 };

describe('haversineKm', () => {
  it('computes a small, correct distance between two known nearby points', () => {
    const km = haversineKm(pointA, pointB);
    expect(km).not.toBeNull();
    expect(km!).toBeGreaterThan(1);
    expect(km!).toBeLessThan(2);
  });

  it('is symmetric regardless of argument order', () => {
    expect(haversineKm(pointA, pointB)).toBeCloseTo(haversineKm(pointB, pointA)!, 10);
  });

  it('returns 0 for identical points', () => {
    expect(haversineKm(pointA, pointA)).toBeCloseTo(0, 6);
  });

  it('detects when lat/lng have been swapped (produces a very different distance)', () => {
    const correct = haversineKm(pointA, pointB)!;
    const swapped = haversineKm({ lat: pointA.lng, lng: pointA.lat }, pointB)!;
    expect(Math.abs(swapped - correct)).toBeGreaterThan(100);
  });

  it('returns null for missing coordinates', () => {
    expect(haversineKm(null, pointB)).toBeNull();
    expect(haversineKm(pointA, undefined)).toBeNull();
    expect(haversineKm(undefined, undefined)).toBeNull();
  });

  it('returns null for invalid (out-of-range) coordinates', () => {
    expect(haversineKm({ lat: 200, lng: 84 }, pointB)).toBeNull();
    expect(haversineKm({ lat: 23, lng: -400 }, pointB)).toBeNull();
    expect(haversineKm({ lat: Number.NaN, lng: 84 }, pointB)).toBeNull();
  });

  it('computes a large but correct distance for genuinely distant points', () => {
    // Mumbai to the reserve — a real long-haul case, not a bug.
    const mumbai = { lat: 19.076, lng: 72.8777 };
    const km = haversineKm(mumbai, pointA)!;
    expect(km).toBeGreaterThan(1200);
    expect(km).toBeLessThan(1400);
  });
});

describe('isValidLatLng', () => {
  it('accepts valid coordinates at the boundary', () => {
    expect(isValidLatLng({ lat: 90, lng: 180 })).toBe(true);
    expect(isValidLatLng({ lat: -90, lng: -180 })).toBe(true);
    expect(isValidLatLng({ lat: 0, lng: 0 })).toBe(true);
  });

  it('rejects out-of-range or non-finite values', () => {
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 0, lng: 181 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: Infinity, lng: 0 })).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(isValidLatLng(null)).toBe(false);
    expect(isValidLatLng(undefined)).toBe(false);
  });
});

describe('formatDistanceKm', () => {
  it('formats sub-kilometre distances in metres, rounded to the nearest 10m', () => {
    expect(formatDistanceKm(0.5)).toBe('500m');
    expect(formatDistanceKm(0.234)).toBe('230m');
  });

  it('never reports less than 10m for a nonzero distance', () => {
    expect(formatDistanceKm(0.001)).toBe('10m');
  });

  it('formats 1-99km with one decimal place', () => {
    expect(formatDistanceKm(1.567)).toBe('1.6km');
    expect(formatDistanceKm(45)).toBe('45.0km');
    expect(formatDistanceKm(99.94)).toBe('99.9km');
  });

  it('formats 100km and above as a whole number', () => {
    expect(formatDistanceKm(100)).toBe('100km');
    expect(formatDistanceKm(1288.4)).toBe('1288km');
  });

  it('returns a placeholder for null or invalid input', () => {
    expect(formatDistanceKm(null)).toBe('—');
    expect(formatDistanceKm(Number.NaN)).toBe('—');
    expect(formatDistanceKm(-5)).toBe('—');
  });
});

describe('isLowAccuracy', () => {
  it('treats city-level/IP-based accuracy as low accuracy', () => {
    expect(isLowAccuracy(50_000)).toBe(true);
    expect(isLowAccuracy(10_001)).toBe(true);
  });

  it('treats real GPS/cell accuracy as trustworthy', () => {
    expect(isLowAccuracy(15)).toBe(false);
    expect(isLowAccuracy(2_000)).toBe(false);
    expect(isLowAccuracy(10_000)).toBe(false);
  });

  it('treats a missing accuracy value as trustworthy (nothing to distrust)', () => {
    expect(isLowAccuracy(undefined)).toBe(false);
  });
});
