import type { JobProgress, MediaAsset, SavedStoryboardMeta, Storyboard } from './types';

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    const err = body as { error?: string; detail?: string } | null;
    throw new Error(err?.detail || err?.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function createScript(title: string, text: string): Promise<{ job_id: string; status: string }> {
  const res = await fetch('/api/scripts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, text })
  });
  return parse<{ job_id: string; status: string }>(res);
}

export async function getJob(jobId: string): Promise<JobProgress> {
  return parse<JobProgress>(await fetch(`/api/jobs/${jobId}`));
}

export async function cancelJob(jobId: string): Promise<JobProgress> {
  const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
  return parse<JobProgress>(res);
}

export async function pauseJob(jobId: string): Promise<JobProgress> {
  const res = await fetch(`/api/jobs/${jobId}/pause`, { method: 'POST' });
  return parse<JobProgress>(res);
}

export async function resumeJob(jobId: string): Promise<JobProgress> {
  const res = await fetch(`/api/jobs/${jobId}/resume`, { method: 'POST' });
  return parse<JobProgress>(res);
}

export async function getStoryboard(id: number): Promise<Storyboard> {
  return parse<Storyboard>(await fetch(`/api/scripts/${id}/storyboard`));
}

export async function searchScene(sceneId: number, q: string): Promise<{ media: MediaAsset[]; message?: string }> {
  return parse(await fetch(`/api/scenes/${sceneId}/search?q=${encodeURIComponent(q)}`));
}

export async function setMediaStatus(
  sceneId: number,
  assetId: number,
  action: 'select' | 'reject'
): Promise<{ asset: MediaAsset }> {
  const res = await fetch(`/api/scenes/${sceneId}/media/${assetId}/${action}`, { method: 'POST' });
  return parse(res);
}

export async function saveStoryboard(scriptId: number, state: unknown): Promise<unknown> {
  const res = await fetch('/api/storyboards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script_id: scriptId, state })
  });
  return parse(res);
}

export async function listStoryboards(): Promise<{ storyboards: SavedStoryboardMeta[] }> {
  return parse(await fetch('/api/storyboards'));
}

export async function getSavedStoryboard(id: number): Promise<{ state: Storyboard }> {
  return parse(await fetch(`/api/storyboards/${id}`));
}

export async function listProviders(): Promise<{ providers: { name: string; configured: boolean }[] }> {
  return parse(await fetch('/api/providers'));
}
