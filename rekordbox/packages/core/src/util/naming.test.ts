import { describe, it, expect } from 'vitest';
import { guessArtistTitle, makeRekordboxFilename, sanitizeFileComponent } from './naming';

describe('naming utils', () => {
  describe('guessArtistTitle', () => {
    it('should split artist and title by " - "', () => {
      expect(guessArtistTitle('Fisher - Losing It')).toEqual({
        artist: 'Fisher',
        title: 'Losing It'
      });
    });

    it('should handle multiple " - "', () => {
      expect(guessArtistTitle('Fisher - Losing It - Extended Mix')).toEqual({
        artist: 'Fisher',
        title: 'Losing It - Extended Mix'
      });
    });

    it('should use uploader as artist if no separator is found', () => {
      expect(guessArtistTitle('Losing It', 'Fisher')).toEqual({
        artist: 'Fisher',
        title: 'Losing It'
      });
    });

    it('should strip junk patterns', () => {
      expect(guessArtistTitle('Fisher - Losing It (Official Video)')).toEqual({
        artist: 'Fisher',
        title: 'Losing It'
      });
      expect(guessArtistTitle('Fisher - Losing It [HD]')).toEqual({
        artist: 'Fisher',
        title: 'Losing It'
      });
    });
  });

  describe('makeRekordboxFilename', () => {
    it('should format filename with artist, title, and extension', () => {
      expect(makeRekordboxFilename({ artist: 'Fisher', title: 'Losing It', ext: '.mp3' })).toBe('Fisher - Losing It.mp3');
    });

    it('should include BPM and Key if provided', () => {
      expect(makeRekordboxFilename({ 
        artist: 'Fisher', 
        title: 'Losing It', 
        bpm: 124.5, 
        key: '8A', 
        ext: '.mp3' 
      })).toBe('Fisher - Losing It [125 8A].mp3');
    });
  });

  describe('sanitizeFileComponent', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeFileComponent('Artist / Title?')).toBe('Artist Title');
      expect(sanitizeFileComponent('Artist: Title*')).toBe('Artist Title');
    });

    it('should trim and collapse spaces', () => {
      expect(sanitizeFileComponent('  Artist   -   Title  ')).toBe('Artist - Title');
    });
  });
});
