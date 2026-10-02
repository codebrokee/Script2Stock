import type { Scene, Storyboard } from '../types';

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

export type SceneFilter = 'all' | 'needs-pick' | 'done' | 'rejected';

export function matchFilter(scene: Scene, filter: SceneFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'rejected') return scene.media.some((m) => m.status === 'rejected');
  return sceneStatus(scene) === filter;
}

export interface Issue {
  kind: 'warning' | 'error';
  text: string;
}

export function collectIssues(
  board: Storyboard | null,
  providers: Array<{ name: string; configured: boolean }>,
  job: { status: string; error: string } | null
): Issue[] {
  const issues: Issue[] = [];
  if (providers.length > 0) {
    const missing = providers.filter((p) => !p.configured);
    if (missing.length > 0) {
      issues.push({
        kind: 'warning',
        text: `Missing API keys: ${missing.map((p) => p.name).join(', ')} — continuing with available providers.`
      });
    }
  }
  if (job && job.status === 'error' && job.error) {
    issues.push({ kind: 'error', text: `Generation failed: ${job.error}` });
  }
  for (const s of board?.scenes ?? []) {
    const st = sceneStatus(s);
    if (st === 'error') {
      issues.push({
        kind: 'error',
        text: `Scene ${s.index + 1}: all candidates rejected — pick manually or run Find Similar.`
      });
    } else if (st === 'pending') {
      issues.push({ kind: 'warning', text: `Scene ${s.index + 1} has no media yet.` });
    }
  }
  return issues;
}
