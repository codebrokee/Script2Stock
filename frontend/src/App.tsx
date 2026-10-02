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
import { CommandBar, type ViewMode } from './components/CommandBar';
import { CommandPalette, type PaletteAction } from './components/CommandPalette';
import { ContextRail, type SavedSort } from './components/ContextRail';
import { EditorPanel } from './components/EditorPanel';
import { Inspector } from './components/Inspector';
import { LibraryGrid } from './components/LibraryGrid';
import { SceneCard } from './components/SceneCard';
import { StatusBar } from './components/StatusBar';
import { Toast } from './components/Toasts';
import type { JobProgress, MediaAsset, SavedStoryboardMeta, Scene, Storyboard } from './types';
import { boardCounts, collectIssues, matchFilter, type Issue, type SceneFilter } from './lib/board';

function viewFromHash(): ViewMode {
  const h = window.location.hash.replace('#', '');
  return h === 'storyboard' || h === 'library' ? h : 'editor';
}

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
  const [viewMode, setViewMode] = useState<ViewMode>(() => viewFromHash());
  const [dirty, setDirty] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focus, setFocus] = useState<{ sceneId: number; assetId: number } | null>(null);
  const [compactAll, setCompactAll] = useState(false);
  const [savedQuery, setSavedQuery] = useState('');
  const [savedSort, setSavedSort] = useState<SavedSort>('newest');
  const [railCollapsed, setRailCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('s2s-rail-collapsed') === '1';
    } catch {
      return false;
    }
  });
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
  const focusScene = focus ? (board?.scenes.find((s) => s.id === focus.sceneId) ?? null) : null;
  const focusAsset = focusScene?.media.find((m) => m.id === focus?.assetId) ?? null;

  async function pollJob(id: string): Promise<void> {
    try {
      const j = await getJob(id);
      failCount.current = 0;
      if (backendDown) setBackendDown(false);
      if (j.status === 'done' && j.script_id !== null) {
        const sb = await getStoryboard(j.script_id);
        setBoard(sb);
        setProviders(sb.providers ?? []);
        setDirty(false);
        setViewMode('storyboard');
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
    setDirty(false);
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
      setDirty(false);
      setViewMode('storyboard');
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

  function toggleRail(): void {
    setRailCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem('s2s-rail-collapsed', next ? '1' : '0');
      } catch {
        /* private mode */
      }
      return next;
    });
  }

  function jumpToScene(sceneId: number): void {
    document.getElementById(`scene-${sceneId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // viewMode <-> location.hash (refresh preserves the view).
  useEffect(() => {
    if (window.location.hash !== `#${viewMode}`) window.location.hash = viewMode;
  }, [viewMode]);

  useEffect(() => {
    const onHash = () => setViewMode(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Global ⌘K / Ctrl+K toggles the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Board navigation shortcuts: j/k scenes, arrows media, Enter/X/S actions, Esc unfocus.
  // Re-registered every render so closures stay fresh; skipped while typing or paletting.
  useEffect(() => {
    function focusCard(sceneId: number, assetId: number): void {
      setFocus({ sceneId, assetId });
      document.getElementById(`media-${assetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function onKey(e: KeyboardEvent): void {
      if (paletteOpen) return;
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (e.key === 'Escape') {
        if (typing) t?.blur();
        setFocus(null);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return; // let focused controls behave natively
      const withCands = visibleScenes.filter((s) => s.media.some((m) => m.status !== 'rejected'));
      const cands = (s: Scene) => s.media.filter((m) => m.status !== 'rejected');
      const focusScene = focus ? (board?.scenes.find((s) => s.id === focus.sceneId) ?? null) : null;
      const focusAsset = focusScene?.media.find((m) => m.id === focus?.assetId) ?? null;

      if (e.key === 'j' || e.key === 'k' || e.key === 'J' || e.key === 'K') {
        if (withCands.length === 0) return;
        e.preventDefault();
        const at = focus ? withCands.findIndex((s) => s.id === focus.sceneId) : -1;
        const idx =
          e.key === 'j' || e.key === 'J'
            ? Math.min(withCands.length - 1, at + 1)
            : at <= 0
              ? withCands.length - 1
              : at - 1;
        const sc = withCands[idx];
        const first = cands(sc)[0];
        if (first) {
          document.getElementById(`scene-${sc.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          focusCard(sc.id, first.id);
        }
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && focus && focusScene) {
        const list = cands(focusScene);
        const i = list.findIndex((m) => m.id === focus.assetId);
        const n = e.key === 'ArrowRight' ? Math.min(list.length - 1, i + 1) : Math.max(0, i - 1);
        e.preventDefault();
        if (list[n]) focusCard(focusScene.id, list[n].id);
      } else if (e.key === 'Enter' && focus && focusAsset) {
        e.preventDefault();
        void handleStatus(focus.sceneId, focusAsset, 'select');
      } else if ((e.key === 'x' || e.key === 'X') && focus && focusAsset) {
        void handleStatus(focus.sceneId, focusAsset, 'reject');
      } else if ((e.key === 's' || e.key === 'S') && focus && focusScene && focusAsset) {
        handleSimilar(focusScene, focusAsset);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function patchScene(sceneId: number, fn: (s: Scene) => Scene): void {
    setBoard((b) => (b ? { ...b, scenes: b.scenes.map((s) => (s.id === sceneId ? fn(s) : s)) } : b));
    setDirty(true);
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
      setDirty(false);
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
      setDirty(false);
      setViewMode('storyboard');
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

  const actions: PaletteAction[] = [
    { id: 'go-editor', label: 'Go to Editor', run: () => setViewMode('editor') },
    { id: 'go-board', label: 'Go to Storyboard', run: () => setViewMode('storyboard') },
    { id: 'go-library', label: 'Go to Library', run: () => setViewMode('library') },
    ...(!jobActive && !starting
      ? [{ id: 'gen', label: 'Generate scenes', hint: 'from editor text', run: () => void handleGenerate() }]
      : []),
    ...(board
      ? [
          { id: 'save', label: 'Save storyboard', run: () => void handleSave() },
          { id: 'export', label: 'Export JSON', run: () => handleExport() }
        ]
      : []),
    ...(jobActive && job
      ? [
          ...(job.paused
            ? [{ id: 'resume', label: 'Resume job', run: () => void handleResume() }]
            : [{ id: 'pause', label: 'Pause job', run: () => void handlePause() }]),
          { id: 'cancel', label: 'Cancel job', run: () => void handleCancel() }
        ]
      : []),
    ...saved.slice(0, 6).map((s) => ({
      id: `load-${s.id}`,
      label: `Load “${s.title}”`,
      hint: `${s.scene_count} scenes`,
      run: () => void handleLoadSaved(s.id)
    }))
  ];

  return (
    <div className="min-h-screen bg-gray-100 pb-10 text-gray-900">
      <CommandBar
        view={viewMode}
        onView={setViewMode}
        dirty={dirty}
        canSave={board !== null}
        onSave={() => void handleSave()}
        onExport={handleExport}
        onPalette={() => setPaletteOpen(true)}
      />
      <CommandPalette open={paletteOpen} actions={actions} onClose={() => setPaletteOpen(false)} />

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

      <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[auto_1fr]">
        <aside className="h-fit lg:sticky lg:top-16">
          <ContextRail
            collapsed={railCollapsed}
            onToggleCollapse={toggleRail}
            mode={viewMode === 'storyboard' ? 'board' : viewMode}
            onMode={(m) => setViewMode(m === 'board' ? 'storyboard' : m)}
            title={title}
            text={text}
            onTitle={setTitle}
            onText={setText}
            generateDisabled={jobActive || starting || !text.trim()}
            generateLabel={
              starting ? 'Starting…' : jobActive && job ? (job.paused ? 'Paused…' : 'Generating…') : 'Generate Scenes'
            }
            onGenerate={() => void handleGenerate()}
            scenes={board?.scenes ?? []}
            filter={filter}
            onFilter={setFilter}
            compactAll={compactAll}
            onCompactAll={setCompactAll}
            onJumpScene={jumpToScene}
            saved={saved}
            savedQuery={savedQuery}
            onSavedQuery={setSavedQuery}
            savedSort={savedSort}
            onSavedSort={setSavedSort}
            onLoadSaved={(id) => void handleLoadSaved(id)}
          />
        </aside>

        <section className="space-y-4">
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
          {viewMode === 'editor' && (
            <EditorPanel
              title={title}
              text={text}
              onTitle={setTitle}
              onText={setText}
              generateDisabled={jobActive || starting || !text.trim()}
              generateLabel={
                starting
                  ? 'Starting…'
                  : jobActive && job
                    ? job.paused
                      ? 'Paused…'
                      : 'Generating…'
                    : 'Generate Scenes'
              }
              onGenerate={() => void handleGenerate()}
              rows={20}
            />
          )}
          {viewMode === 'storyboard' && (
            <>
              {filter !== 'all' && board && (
            <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs text-accent-strong">
              <span>
                Filter: <b>{filter}</b> — showing {visibleScenes.length}/{board.scenes.length} scenes
              </span>
              <span className="flex-1" />
              <button onClick={() => setFilter('all')} className="font-semibold hover:underline">
                Clear ✕
              </button>
            </div>
          )}
          {!board && !job && (
            <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-400">
              Paste a script on the left and click <b>Generate Scenes</b>.
            </div>
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
              compact={compactAll}
              focusedAssetId={focus?.sceneId === s.id ? (focus?.assetId ?? null) : null}
              onFocusAsset={(sid, a) => setFocus({ sceneId: sid, assetId: a.id })}
            />
          ))}
          {hiddenCount > 0 && (
            <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-gray-400">
              ⏳ {hiddenCount} more scene{hiddenCount === 1 ? '' : 's'} still generating…
            </div>
          )}
            </>
          )}
          {viewMode === 'library' && (
            <LibraryGrid saved={saved} onOpen={(id) => void handleLoadSaved(id)} />
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
      {focusScene && focusAsset && (
        <Inspector
          asset={focusAsset}
          sceneIndex={focusScene.index}
          onClose={() => setFocus(null)}
          onUse={() => void handleStatus(focusScene.id, focusAsset, 'select')}
          onReject={() => void handleStatus(focusScene.id, focusAsset, 'reject')}
          onSimilar={() => handleSimilar(focusScene, focusAsset)}
        />
      )}
    </div>
  );
}
