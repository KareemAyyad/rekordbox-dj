import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';

// Mock dependencies BEFORE importing app
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn()
  }
}));

const { mockOpenAICreate } = vi.hoisted(() => ({
  mockOpenAICreate: vi.fn()
}));

vi.mock('openai', () => {
  const OpenAI = vi.fn(function(this: any) {
    this.responses = {
      create: mockOpenAICreate
    };
  });
  return {
    default: OpenAI,
    OpenAI: OpenAI
  };
});

vi.mock('@dropcrate/core', () => ({
  downloadBatch: vi.fn(),
  getVideoInfo: vi.fn().mockResolvedValue({
    title: 'Test Title',
    uploader: 'Test Artist',
    duration: 120
  }),
  heuristicClassifyDjTags: vi.fn(() => ({
    kind: 'track',
    genre: 'House',
    energy: '3/5',
    time: 'Peak',
    vibe: 'Vocal',
    confidence: 0.8,
    notes: 'Heuristic match'
  }))
}));

// Now import app
import { app } from './server';

describe('bridge server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return health status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('should return default settings if file not found', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    const res = await request(app).get('/settings');
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('dj-safe');
  });

  describe('classify', () => {
    it('should classify items using OpenAI when available', async () => {
      // Mock OpenAI success
      mockOpenAICreate.mockResolvedValue({
        output: [
          {
            type: 'function_call',
            name: 'classify_dj_tags',
            arguments: JSON.stringify({
              results: [{
                id: '1',
                kind: 'track',
                genre: 'Tech House',
                energy: '4/5',
                time: 'Peak',
                vibe: 'Driving',
                confidence: 0.9,
                notes: 'OpenAI match'
              }]
            })
          }
        ]
      });

      const res = await request(app)
        .post('/classify')
        .send({ items: [{ id: '1', url: 'https://youtube.com/watch?v=123' }] });
      
      expect(res.status).toBe(200);
      // It will use OpenAI because the mock says so
      expect(res.body.source).toBe('openai');
      expect(res.body.results[0].genre).toBe('Tech House');
    });

    it('should fall back to heuristics if OpenAI fails', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI Error'));

      const res = await request(app)
        .post('/classify')
        .send({ items: [{ id: '1', url: 'https://youtube.com/watch?v=123' }] });
      
      expect(res.status).toBe(200);
      expect(res.body.source).toBe('heuristic');
      expect(res.body.results[0].genre).toBe('House');
    });
  });
});
