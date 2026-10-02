import React, { useEffect, useRef, useState } from 'react';
import {
  cancelJob,
  createScript,
  getJob,
  getSavedStoryboard,
  getStoryboard,
  listProviders,
  listStoryboards,
  pauseJob,
  resumeJob,
  saveStoryboard,
  searchScene,
  setMediaStatus
} from './api';
import { IssuesDrawer } from './components/IssuesDrawer';
import { ProgressRail } from './components/ProgressRail';
import { SceneCard } from './components/SceneCard';
import { StatusBar } from './components/StatusBar';
import { Toast } from './components/Toasts';
import type { JobProgress, MediaAsset, SavedStoryboardMeta, Scene, Storyboard } from './types';
import { boardCounts, collectIssues, matchFilter, type Issue, type SceneFilter } from './lib/board';

const SAMPLE = `Artificial intelligence is transforming modern cities. Robots and neural networks power new services every day.\n\nThe ocean remains mysterious and vast. Coral reefs shelter thousands of colorful fish beneath the waves.\n\nTravel opens new horizons. Airplanes cross continents while travelers discover food, culture, and adventure.`;

export default function App(): React.ReactElement {
  const [title, setTitle] = useState('My YouTube Script');
  const [text, setText] = useState(SAMPLE);
  const [board, setBoard] = useState<Storyboard | null>(null);
  const [job, setJob] = useState<JobProgress | null>(null);
  const [starting, setStarting] = useState(false);
  const [saved, setSaved] = useState<SavedStoryboardMeta[]>([]);
  const [backendDown, setBackendDown] = useState(false);
  const [jobGone, setJobGone] = useState(false);
  const failCount = useRef(0);
  const [searching, setSearching] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<SceneFilter>('all');
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [providers, setProviders] = useState<{ name: string; configured: boolean }[]>([]);

  useEffect(() => {
    listProviders().then((p) => setProviders(p.providers)).catch(() => undefined);
    listStoryboards().then((s) => setSaved(s.storyboards)).catch(() => undefined);
  }, []);

  // Toasts auto-dismiss after 6s.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 6000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const missing = providers.filter((p) => !p.configured).map((p) => p.name);

  const jobId = job?.job_id ?? null;
  const jobFinished =
    job === null || job.status === 'done' || job.status === 'error' || job.status === 'cancelled';
  const jobActive = job !== null && (job.status === 'queued' || job.status === 'running');
  // While generation is still active, only show scenes the worker has finished —
  // pending scenes would just say "no media found". Once the job is terminal
  // (done/cancelled/dismissed), show everything so empty scenes stay searchable.
  const doneIndexes =
    jobActive && job ? new Set(job.scenes.filter((s) => s.status === 'done').map((s) => s.index)) : null;
  const visibleScenes = board
    ? (doneIndexes ? board.scenes.filter((s) => doneIndexes.has(s.index)) : board.scenes).filter((s) =>
        matchFilter(s, filter)
      )
    : [];
  const hiddenCount = board ? board.scenes.length - visibleScenes.length : 0;
  const counts = board ? boardCounts(board.scenes) : null;
  const issues: Issue[] = collectIssues(board, providers, job);

  async function pollJob(id: string): Promise<void> {
    try {
      const j = await getJob(id);
      failCount.current = 0;
      if (backendDown) setBackendDown(false);
      if (j.status === 'done' && j.script_id !== null) {
        const sb = await getStoryboard(j.script_id);
        setBoard(sb);
        setProviders(sb.providers ?? []);
        setNotice(`Storyboard ready — ${sb.scenes.length} scenes, ${j.media_found} assets.`);
        setJob(null);
        return;
      }
      setJob(j);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Job poll failed';
      if (/not found/i.test(msg)) {
        // Backend restarted and lost the in-memory job — stop polling.
        setJobGone(true);
        return;
      }
      failCount.current += 1;
      if (failCount.current >= 5) setBackendDown(true);
    }
  }

  useEffect(() => {
    if (jobId === null || jobFinished || backendDown || jobGone) return;
    const t = setInterval(() => void pollJob(jobId), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, jobFinished, backendDown, jobGone]);

  async function handleGenerate(): Promise<void> {
    if (jobActive || starting) return; // guard against double-clicks
    setStarting(true); // disable the button synchronously, before the first await
    setError('');
    setNotice('');
    setBackendDown(false);
    setJobGone(false);
    failCount.current = 0;
    try {
      const { job_id } = await createScript(title.trim() || 'Untitled', text);
      setJob(await getJob(job_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setStarting(false);
    }
  }

  async function handleCancel(): Promise<void> {
    if (!job) return;
    try {
      setJob(await cancelJob(job.job_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    }
  }

  async function handlePause(): Promise<void> {
    if (!job) return;
    try {
      setJob(await pauseJob(job.job_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pause failed');
    }
  }

  async function handleResume(): Promise<void> {
    if (!job) return;
    try {
      setJob(await resumeJob(job.job_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resume failed');
    }
  }

  async function handleRetry(): Promise<void> {
    if (!job) return;
    failCount.current = 0;
    setBackendDown(false);
    await pollJob(job.job_id);
  }

  function dismissJob(): void {
    setJob(null);
    setJobGone(false);
    setBackendDown(false);
    failCount.current = 0;
  }
  async function handlePartialView(): Promise<void> {
    if (!job?.script_id) return;
    try {
      const sb = await getStoryboard(job.script_id);
      setBoard(sb);
      setProviders(sb.providers ?? []);
      if (job.status === 'cancelled' || job.status === 'error') {
        setJob(null); // terminal — nothing left to track
      } else {
        setNotice(
          `Showing ${sb.scenes.length} finished scene(s) — generation is still ${job.paused ? 'paused' : 'running'}.`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }

  function handleRestore(sceneId: number, asset: MediaAsset): void {
    // No backend endpoint resets status to candidate, so restore is session-local.
    patchScene(sceneId, (s) => ({
      ...s,
      media: s.media.map((m) => (m.id === asset.id ? { ...m, status: 'candidate' } : m))
    }));
  }

  function patchScene(sceneId: number, fn: (s: Scene) => Scene): void {
    setBoard((b) => (b ? { ...b, scenes: b.scenes.map((s) => (s.id === sceneId ? fn(s) : s)) } : b));
  }

  async function handleStatus(sceneId: number, asset: MediaAsset, action: 'select' | 'reject'): Promise<void> {
    try {
      const { asset: updated } = await setMediaStatus(sceneId, asset.id, action);
      patchScene(sceneId, (s) => ({ ...s, media: s.media.map((m) => (m.id === updated.id ? updated : m)) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function handleManualSearch(sceneId: number, q: string): Promise<void> {
    setSearching((s) => ({ ...s, [sceneId]: true }));
    try {
      const { media } = await searchScene(sceneId, q);
      patchScene(sceneId, (s) => {
        const known = new Set(s.media.map((m) => `${m.provider}:${m.provider_id}`));
        const fresh = media.filter((m) => !known.has(`${m.provider}:${m.provider_id}`));
        return { ...s, media: [...fresh, ...s.media].sort((a, b) => b.score - a.score).slice(0, 24) };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching((s) => ({ ...s, [sceneId]: false }));
    }
  }

  function handleSimilar(scene: Scene, asset: MediaAsset): void {
    void handleManualSearch(scene.id, asset.title || scene.narration.slice(0, 60));
  }

  async function handleSave(): Promise<void> {
    if (!board) return;
    try {
      await saveStoryboard(board.id, board);
      setSaved(await listStoryboards().then((s) => s.storyboards));
      setLastSavedAt(new Date().toISOString());
      setNotice(`Storyboard saved — see it under Saved storyboards below.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function handleLoadSaved(id: number): Promise<void> {
    setError('');
    try {
      const { state } = await getSavedStoryboard(id);
      setBoard(state);
      setProviders(state.providers ?? []);
      setNotice(`Loaded saved storyboard “${state.title}”.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }

  function handleExport(): void {
    if (!board) return;
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `storyboard-${board.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-10 text-gray-900">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <h1 className="text-lg font-extrabold tracking-tight">
          🎬 Script<span className="text-blue-600">2</span>Stock
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => void handleSave()}
            disabled={!board}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-blue-700"
          >
            Save Storyboard
          </button>
          <button
            onClick={handleExport}
            disabled={!board}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Export JSON
          </button>
        </div>
      </header>

      {missing.length > 0 && (
        <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          ⚠️ Missing API keys for: {missing.join(', ')}. Continuing with {providers.filter((p) => p.configured).map((p) => p.name).join(', ') || 'no'} providers. Wikimedia works without keys.
        </div>
      )}
      {error || notice ? (
        <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-80 flex-col gap-2">
          {error && <Toast kind="error" text={error} onDismiss={() => setError('')} />}
          {notice && <Toast kind="notice" text={notice} onDismiss={() => setNotice('')} />}
        </div>
      ) : null}

      <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[340px_1fr]">
        <aside className="h-fit rounded-xl border bg-white p-4 shadow-sm lg:sticky lg:top-16">
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">YouTube script</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => void handleGenerate()}
            disabled={jobActive || starting || !text.trim()}
            className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40 hover:bg-blue-700"
          >
            {starting ? 'Starting…' : jobActive && job ? (job.paused ? 'Paused…' : 'Generating…') : 'Generate Scenes'}
          </button>
          <p className="mt-2 text-[11px] text-gray-400">
            Scenes split on sentences (1–3 per scene, ~15–40 words). Paragraph breaks force boundaries.
          </p>
          <div className="mt-4 border-t pt-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Saved storyboards</h3>
            {saved.length === 0 ? (
              <p className="text-xs text-gray-400">Nothing saved yet — use “Save Storyboard” up top.</p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                {saved.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-gray-700" title={s.title}>
                        {s.title}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {s.scene_count} scenes · {new Date(s.created_at).toLocaleString()}
                      </span>
                    </span>
                    <button
                      onClick={() => void handleLoadSaved(s.id)}
                      className="shrink-0 rounded bg-blue-100 px-2 py-1 font-semibold text-blue-700 hover:bg-blue-200"
                    >
                      Load
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="space-y-4">
          {!board && !job && (
            <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-400">
              Paste a script on the left and click <b>Generate Scenes</b>.
            </div>
          )}
          {job && (
            <ProgressRail
              job={job}
              offline={backendDown}
              gone={jobGone}
              onPause={() => void handlePause()}
              onResume={() => void handleResume()}
              onCancel={() => void handleCancel()}
              onPartial={() => void handlePartialView()}
              onRetry={() => void handleRetry()}
              onDismiss={() => dismissJob()}
            />
          )}
          {visibleScenes.map((s) => (
            <SceneCard
              key={s.id}
              scene={s}
              searching={!!searching[s.id]}
              onStatus={(sid, a, act) => void handleStatus(sid, a, act)}
              onManualSearch={handleManualSearch}
              onSimilar={handleSimilar}
              onRestore={handleRestore}
            />
          ))}
          {hiddenCount > 0 && (
            <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-gray-400">
              ⏳ {hiddenCount} more scene{hiddenCount === 1 ? '' : 's'} still generating…
            </div>
          )}
        </section>
      </main>
      <StatusBar
        counts={counts}
        issues={issues}
        lastSavedAt={lastSavedAt}
        generating={jobActive}
        onNeedsPicks={() => setFilter('needs-pick')}
        onShowIssues={() => setIssuesOpen(true)}
      />
      <IssuesDrawer open={issuesOpen} issues={issues} onClose={() => setIssuesOpen(false)} />
    </div>
  );
}
