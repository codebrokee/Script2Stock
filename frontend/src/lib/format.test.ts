import { describe, expect, it } from 'vitest';
import { aspectLabel, formatDuration, timeAgo } from './format';

describe('aspectLabel', () => {
  it('names common frames', () => {
    expect(aspectLabel(1920, 1080)).toBe('16:9');
    expect(aspectLabel(1080, 1920)).toBe('9:16');
    expect(aspectLabel(100, 100)).toBe('1:1');
  });

  it('reduces uncommon ratios and blanks unknown', () => {
    expect(aspectLabel(800, 600)).toBe('4:3');
    expect(aspectLabel(0, 0)).toBe('');
  });
});

describe('formatDuration', () => {
  it('formats m:ss', () => {
    expect(formatDuration(14)).toBe('0:14');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(0)).toBe('');
  });
});

describe('timeAgo', () => {
  it('describes recent timestamps', () => {
    expect(timeAgo(new Date().toISOString())).toBe('just now');
    expect(timeAgo(new Date(Date.now() - 5 * 60000).toISOString())).toBe('5m ago');
    expect(timeAgo('not-a-date')).toBe('');
  });
});
