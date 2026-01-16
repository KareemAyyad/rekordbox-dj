import { describe, it, expect } from 'vitest';
import { heuristicClassifyDjTags } from './autoclassify';

describe('heuristic classification', () => {
  it('should classify a track as tech house based on keywords', () => {
    const result = heuristicClassifyDjTags({
      title: 'Awesome Tech House Track',
      uploader: 'Cool DJ',
      tags: ['music', 'techhouse']
    });
    expect(result.kind).toBe('track');
    expect(result.genre).toBe('Tech House');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify a long video as a set', () => {
    const result = heuristicClassifyDjTags({
      title: 'Live Mix at Ibiza',
      duration: 3600,
      tags: ['djset']
    });
    expect(result.kind).toBe('set');
    expect(result.genre).toBe('Other');
  });

  it('should detect Afro House from title', () => {
    const result = heuristicClassifyDjTags({
      title: 'Best Afro House 2024',
      tags: ['music']
    });
    expect(result.genre).toBe('Afro House');
  });

  it('should detect energy and time from keywords', () => {
    const result = heuristicClassifyDjTags({
      title: 'Warmup session',
      description: 'Opening set at the club'
    });
    expect(result.energy).toBe('2/5');
    expect(result.time).toBe('Warmup');
  });

  it('should detect vibes', () => {
    const result = heuristicClassifyDjTags({
      title: 'Deep House',
      description: 'Very vocal and organic track'
    });
    expect(result.vibe).toContain('Vocal');
    expect(result.vibe).toContain('Organic');
  });

  it('should classify tutorials as videos', () => {
    const result = heuristicClassifyDjTags({
      title: 'How to DJ like a pro',
      description: 'Rekordbox tutorial'
    });
    expect(result.kind).toBe('video');
    expect(result.genre).toBeNull();
  });
});
