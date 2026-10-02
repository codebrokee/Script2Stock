import type { Scene } from '../types';

export type SceneStatus = 'done' | 'needs-pick' | 'pending' | 'error';

/** Derived per-scene state used for pills, filters, and counts. */
export function sceneStatus(scene: Scene): SceneStatus {
  const media = scene.media ?? [];
  if (media.length === 0) return 'pending';
  if (media.some((m) => m.status === 'selected')) return 'done';
  if (media.every((m) => m.status === 'rejected')) return 'error';
  return 'needs-pick';
}

export interface BoardCounts {
  total: number;
  ready: number;
  needPicks: number;
  pending: number;
  errors: number;
  rejected: number;
}

export function boardCounts(scenes: Scene[]): BoardCounts {
  const counts: BoardCounts = { total: scenes.length, ready: 0, needPicks: 0, pending: 0, errors: 0, rejected: 0 };
  for (const s of scenes) {
    const st = sceneStatus(s);
    if (st === 'done') counts.ready += 1;
    else if (st === 'needs-pick') counts.needPicks += 1;
    else if (st === 'pending') counts.pending += 1;
    else counts.errors += 1;
    counts.rejected += s.media.filter((m) => m.status === 'rejected').length;
  }
  return counts;
}
