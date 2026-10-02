import { describe, expect, it } from 'vitest';
import { boardCounts, collectIssues, matchFilter, sceneStatus } from './board';
import type { MediaAsset, Scene, Storyboard } from '../types';

let nextId = 1;

function asset(status: MediaAsset['status']): MediaAsset {
  return {
    id: nextId++,
    scene_id: 1,
    provider: 'wikimedia',
    provider_id: `f${nextId}`,
    title: 't',
    description: '',
    url: '',
    download_url: '',
    thumbnail_url: '',
    cached_thumbnail: '',
    media_type: 'image',
    width: 800,
    height: 600,
    duration: 0,
    license: 'CC0',
    license_url: '',
    creator: '',
    attribution_required: false,
    score: 0.5,
    status
  };
}

function scene(statuses: Array<MediaAsset['status']>): Scene {
  return {
    id: 1,
    script_id: 1,
    index: 0,
    narration: 'hello world',
    start_char: 0,
    end_char: 5,
    queries: [],
    media: statuses.map(asset)
  };
}

describe('sceneStatus', () => {
  it('is pending with no media', () => {
    expect(sceneStatus(scene([]))).toBe('pending');
  });

  it('is done when anything is selected', () => {
    expect(sceneStatus(scene(['candidate', 'selected', 'rejected']))).toBe('done');
  });

  it('is needs-pick with undecided candidates', () => {
    expect(sceneStatus(scene(['candidate', 'candidate']))).toBe('needs-pick');
    expect(sceneStatus(scene(['candidate', 'rejected']))).toBe('needs-pick');
  });

  it('is error when everything is rejected', () => {
    expect(sceneStatus(scene(['rejected', 'rejected']))).toBe('error');
  });
});

describe('boardCounts', () => {
  it('aggregates per-scene states and rejected assets', () => {
    const counts = boardCounts([
      scene(['selected']),
      scene(['candidate']),
      scene([]),
      scene(['rejected'])
    ]);
    expect(counts).toEqual({ total: 4, ready: 1, needPicks: 1, pending: 1, errors: 1, rejected: 1 });
  });
});

describe('matchFilter', () => {
  it('matches by derived state', () => {
    const done = scene(['selected']);
    expect(matchFilter(done, 'all')).toBe(true);
    expect(matchFilter(done, 'done')).toBe(true);
    expect(matchFilter(done, 'needs-pick')).toBe(false);
    expect(matchFilter(scene(['candidate', 'rejected']), 'rejected')).toBe(true);
    expect(matchFilter(scene(['candidate']), 'rejected')).toBe(false);
  });
});

describe('collectIssues', () => {
  it('flags missing providers, failed jobs, and troubled scenes', () => {
    const issues = collectIssues(
      { scenes: [scene([]), scene(['rejected'])] } as Storyboard,
      [
        { name: 'pexels', configured: false },
        { name: 'wikimedia', configured: true }
      ],
      { status: 'error', error: 'boom' }
    );
    const texts = issues.map((i) => i.text);
    expect(texts.some((t) => t.includes('pexels'))).toBe(true);
    expect(texts.some((t) => t.includes('boom'))).toBe(true);
    expect(texts.some((t) => t.includes('Scene 1 has no media'))).toBe(true);
    expect(texts.some((t) => t.includes('all candidates rejected'))).toBe(true);
  });

  it('is empty for a clean board', () => {
    expect(collectIssues(null, [{ name: 'wikimedia', configured: true }], null)).toEqual([]);
  });
});
