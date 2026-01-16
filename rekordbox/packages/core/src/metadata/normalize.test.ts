import { describe, it, expect } from 'vitest';
import { normalizeFromYouTubeTitle } from './normalize';

describe('normalize utility', () => {
  it('should normalize basic artist - title', () => {
    const result = normalizeFromYouTubeTitle({ rawTitle: 'FISHER - Losing It' });
    expect(result.artist).toBe('Fisher');
    expect(result.title).toBe('Losing It');
  });

  it('should extract version from parentheses', () => {
    const result = normalizeFromYouTubeTitle({ rawTitle: 'Fisher - Losing It (Extended Mix)' });
    expect(result.artist).toBe('Fisher');
    expect(result.title).toBe('Losing It (Extended Mix)');
    expect(result.version).toBe('Extended Mix');
  });

  it('should handle junk in title', () => {
    const result = normalizeFromYouTubeTitle({ 
      rawTitle: 'FISHER - Losing It (Official Music Video) [4K]' 
    });
    expect(result.artist).toBe('Fisher');
    expect(result.title).toBe('Losing It');
  });

  it('should handle DJ and other special artist cases', () => {
    const result = normalizeFromYouTubeTitle({ rawTitle: 'd.j. koze - Pick Up' });
    expect(result.artist).toBe('DJ Koze');
    expect(result.title).toBe('Pick Up');
  });

  it('should use uploader if no separator found', () => {
    const result = normalizeFromYouTubeTitle({ 
      rawTitle: 'Losing It', 
      uploader: 'Fisher' 
    });
    expect(result.artist).toBe('Fisher');
    expect(result.title).toBe('Losing It');
  });

  it('should handle feat. and ft.', () => {
    const result = normalizeFromYouTubeTitle({ 
      rawTitle: 'Fisher feat. Kita Alexander - Atmosphere' 
    });
    expect(result.artist).toBe('Fisher feat. Kita Alexander');
    expect(result.title).toBe('Atmosphere');
  });
});
