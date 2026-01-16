import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tryMatchMusicMetadata } from './musicbrainz';
import * as fingerprint from './fingerprint.js';
import fs from 'node:fs/promises';

vi.mock('./fingerprint.js', () => ({
  getChromaprintFingerprint: vi.fn()
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn()
  }
}));

describe('musicbrainz metadata matching', () => {
  const mockFp = { duration: 300, fingerprint: 'mock-fingerprint' };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DROPCRATE_ACOUSTID_KEY = 'mock-key';
    
    // Default mock for fetch
    global.fetch = vi.fn();
    
    // Default mock for fingerprint
    vi.mocked(fingerprint.getChromaprintFingerprint).mockResolvedValue(mockFp);
    
    // Default mock for cache (not found)
    vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
  });

  it('should return null if no acoustid key is set', async () => {
    delete process.env.DROPCRATE_ACOUSTID_KEY;
    const result = await tryMatchMusicMetadata({
      audioPath: 'fake.mp3',
      fallback: { artist: 'Artist', title: 'Title', version: null },
      titleHadSeparator: true
    });
    expect(result).toBeNull();
  });

  it('should return null if no match is found in acoustid', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ status: 'ok', results: [] })
    } as any);

    const result = await tryMatchMusicMetadata({
      audioPath: 'fake.mp3',
      fallback: { artist: 'Artist', title: 'Title', version: null },
      titleHadSeparator: true
    });
    expect(result).toBeNull();
  });

  it('should successfully match metadata from musicbrainz', async () => {
    // 1. Acoustid lookup response
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        status: 'ok',
        results: [{ score: 0.99, recordings: [{ id: 'recording-mbid' }] }]
      })
    } as any);

    // 2. MusicBrainz lookup response
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        title: 'Losing It',
        'artist-credit': [{ name: 'Fisher' }],
        releases: [{ title: 'Losing It', status: 'Official', date: '2018-07-13', 'label-info': [{ label: { name: 'Catch & Release' } }] }]
      })
    } as any);

    const result = await tryMatchMusicMetadata({
      audioPath: 'fake.mp3',
      fallback: { artist: 'Fisher', title: 'Losing It', version: null },
      titleHadSeparator: true
    });

    expect(result).not.toBeNull();
    expect(result?.artist).toBe('Fisher');
    expect(result?.title).toBe('Losing It');
    expect(result?.label).toBe('Catch & Release');
    expect(result?.year).toBe('2018');
  });
});
