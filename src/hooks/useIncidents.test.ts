import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Incident, IncidentPhoto } from '../types';

const createSignedUrls = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({ createSignedUrls })),
    },
  },
}));

const { resolveIncidentPhotoUrls } = await import('./useIncidents');

function photo(id: string, path: string): IncidentPhoto {
  return { id, path, url: path, size: 1024, type: 'image/jpeg' };
}

function incident(id: string, photos: IncidentPhoto[]): Incident {
  return {
    id,
    type: 'poaching_sign',
    severity: 'Medium',
    status: 'Open',
    description: 'test incident',
    rangeId: 'range-1',
    reportedBy: 'user-1',
    incidentDate: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    photos,
  };
}

beforeEach(() => {
  createSignedUrls.mockReset();
});

describe('resolveIncidentPhotoUrls', () => {
  it('signs multiple photos across multiple incidents and maps each url back to the correct incident/photo', async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'a/1.jpg', signedUrl: 'https://signed/a/1.jpg', error: null },
        { path: 'a/2.jpg', signedUrl: 'https://signed/a/2.jpg', error: null },
        { path: 'b/1.jpg', signedUrl: 'https://signed/b/1.jpg', error: null },
      ],
      error: null,
    });

    const incidents = [
      incident('inc-a', [photo('pa1', 'a/1.jpg'), photo('pa2', 'a/2.jpg')]),
      incident('inc-b', [photo('pb1', 'b/1.jpg')]),
    ];

    const result = await resolveIncidentPhotoUrls(incidents);

    expect(result[0].id).toBe('inc-a');
    expect(result[0].photos.map((p) => p.url)).toEqual(['https://signed/a/1.jpg', 'https://signed/a/2.jpg']);
    expect(result[1].id).toBe('inc-b');
    expect(result[1].photos[0].url).toBe('https://signed/b/1.jpg');
  });

  it('leaves an incident with no photos untouched and does not call the Storage API for it', async () => {
    createSignedUrls.mockResolvedValue({
      data: [{ path: 'a/1.jpg', signedUrl: 'https://signed/a/1.jpg', error: null }],
      error: null,
    });

    const incidents = [
      incident('inc-a', [photo('pa1', 'a/1.jpg')]),
      incident('inc-empty', []),
    ];

    const result = await resolveIncidentPhotoUrls(incidents);

    expect(result[1].photos).toEqual([]);
    // Only inc-a's path was requested — the empty incident contributed nothing.
    expect(createSignedUrls).toHaveBeenCalledWith(['a/1.jpg'], expect.any(Number));
  });

  it('skips the Storage API call entirely when no incident has any photos', async () => {
    const incidents = [incident('inc-a', []), incident('inc-b', [])];
    const result = await resolveIncidentPhotoUrls(incidents);
    expect(result).toEqual(incidents);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it('falls back to the original path for an invalid/missing photo without affecting other photos', async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'a/1.jpg', signedUrl: 'https://signed/a/1.jpg', error: null },
        { path: 'a/missing.jpg', signedUrl: null, error: 'Object not found' },
      ],
      error: null,
    });

    const incidents = [incident('inc-a', [photo('pa1', 'a/1.jpg'), photo('pa2', 'a/missing.jpg')])];
    const result = await resolveIncidentPhotoUrls(incidents);

    expect(result[0].photos[0].url).toBe('https://signed/a/1.jpg');
    // Invalid path: signedUrl is null, so the ?? fallback keeps the original (unsigned) path —
    // an <img> pointed at a bare storage path 404s and renders the browser's broken-image state.
    expect(result[0].photos[1].url).toBe('a/missing.jpg');
  });

  it('handles a mix of valid and invalid paths across multiple incidents correctly', async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'a/1.jpg', signedUrl: 'https://signed/a/1.jpg', error: null },
        { path: 'a/bad.jpg', signedUrl: null, error: 'Object not found' },
        { path: 'b/1.jpg', signedUrl: 'https://signed/b/1.jpg', error: null },
      ],
      error: null,
    });

    const incidents = [
      incident('inc-a', [photo('pa1', 'a/1.jpg'), photo('pa2', 'a/bad.jpg')]),
      incident('inc-b', [photo('pb1', 'b/1.jpg')]),
    ];
    const result = await resolveIncidentPhotoUrls(incidents);

    expect(result[0].photos[0].url).toBe('https://signed/a/1.jpg');
    expect(result[0].photos[1].url).toBe('a/bad.jpg');
    expect(result[1].photos[0].url).toBe('https://signed/b/1.jpg');
  });

  it('issues exactly one Storage API request regardless of how many incidents/photos are present', async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: 'a/1.jpg', signedUrl: 'https://signed/a/1.jpg', error: null },
        { path: 'a/2.jpg', signedUrl: 'https://signed/a/2.jpg', error: null },
        { path: 'b/1.jpg', signedUrl: 'https://signed/b/1.jpg', error: null },
        { path: 'c/1.jpg', signedUrl: 'https://signed/c/1.jpg', error: null },
      ],
      error: null,
    });

    const incidents = [
      incident('inc-a', [photo('pa1', 'a/1.jpg'), photo('pa2', 'a/2.jpg')]),
      incident('inc-b', [photo('pb1', 'b/1.jpg')]),
      incident('inc-c', [photo('pc1', 'c/1.jpg')]),
    ];
    await resolveIncidentPhotoUrls(incidents);

    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(
      ['a/1.jpg', 'a/2.jpg', 'b/1.jpg', 'c/1.jpg'],
      expect.any(Number),
    );
  });
});
