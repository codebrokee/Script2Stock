export interface MediaAsset {
  id: number;
  scene_id: number;
  provider: string;
  provider_id: string;
  title: string;
  description: string;
  url: string;
  download_url: string;
  thumbnail_url: string;
  cached_thumbnail: string;
  media_type: 'image' | 'video' | string;
  width: number;
  height: number;
  duration: number;
  license: string;
  license_url: string;
  creator: string;
  attribution_required: boolean;
  score: number;
  status: 'candidate' | 'selected' | 'rejected' | string;
}

export interface Scene {
  id: number;
  script_id: number;
  index: number;
  narration: string;
  start_char: number;
  end_char: number;
  queries: string[];
  media: MediaAsset[];
}

export interface Storyboard {
  id: number;
  title: string;
  text: string;
  created_at: string;
  scenes: Scene[];
  providers?: { name: string; configured: boolean }[];
}

export interface ApiError {
  error: string;
  detail: string;
}

export interface JobSceneState {
  index: number;
  status: 'pending' | 'active' | 'done' | string;
  media: number;
}

export interface SavedStoryboardMeta {
  id: number;
  script_id: number;
  title: string;
  scene_count: number;
  created_at: string;
}

export interface JobProgress {
  job_id: string;
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled' | string;
  stage: string;
  script_id: number | null;
  total_scenes: number;
  done_scenes: number;
  media_found: number;
  scenes: JobSceneState[];
  error: string;
  paused: boolean;
  elapsed: number;
}
