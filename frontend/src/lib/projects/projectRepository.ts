import { DEFAULT_VIDEO_PLAYBACK_SETTINGS, createDefaultProject, normalizeProject } from './defaultProject';
import type { ProjectMedia, ProjectState, ProjectSummary } from './types';
import { saveLocalMedia, getLocalMediaBlob, deleteLocalMedia } from './localMediaStore';

const DEV_BACKEND_URL = '';
export const API_URL = (localStorage.getItem('md_api_url') || import.meta.env.VITE_MAP_DADDY_API_URL || DEV_BACKEND_URL || '').replace(/\/$/, '');
export const PUBLIC_BACKEND_URL = (import.meta.env.VITE_MAP_DADDY_PUBLIC_BACKEND_URL || API_URL || '').replace(/\/$/, '');

const PROJECT_INDEX_KEY = 'map-daddy.projects';
const projectKey = (projectId: string) => `map-daddy.project.${projectId}`;

function absoluteMediaUrl(url: string) {
  if (!url || !PUBLIC_BACKEND_URL || !url.startsWith('/media/')) return url;
  return `${PUBLIC_BACKEND_URL}${url}`;
}

function localMediaId(media: ProjectMedia): string | null {
  if (media.url.startsWith('local://')) return media.url.replace('local://', '');
  if (media.id.startsWith('local_media_')) return media.id;
  return null;
}

function storedMedia(media: ProjectMedia): ProjectMedia {
  const id = localMediaId(media);
  if (id) return { ...media, id, url: `local://${id}` };
  if (media.url.startsWith('session://')) return media;
  if (media.id.startsWith('session_media_')) return { ...media, url: `session://${media.id}` };
  return media;
}

function createMediaObjectUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}

export function releaseProjectMediaObjectUrls(project: ProjectState | null): void {
  for (const media of project?.media || []) {
    if (media.url.startsWith('blob:')) {
      URL.revokeObjectURL(media.url);
    }
  }
}

function localList(): ProjectSummary[] {
  const ids = JSON.parse(localStorage.getItem(PROJECT_INDEX_KEY) || '[]') as string[];
  return ids
    .map((id) => {
      const raw = localStorage.getItem(projectKey(id));
      if (!raw) return null;
      const project = normalizeProject(JSON.parse(raw));
      return {
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt,
        surfaceCount: project.surfaces.length,
        mediaCount: project.media.length
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b!.updatedAt || '').localeCompare(a!.updatedAt || '')) as ProjectSummary[];
}

function localSave(project: ProjectState) {
  const normalized = normalizeProject({ ...project, updatedAt: new Date().toISOString() });

  const toSave = {
    ...normalized,
    media: normalized.media.map(storedMedia)
  };

  localStorage.setItem(projectKey(normalized.id), JSON.stringify(toSave));
  const ids = new Set(JSON.parse(localStorage.getItem(PROJECT_INDEX_KEY) || '[]') as string[]);
  ids.add(normalized.id);
  localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify([...ids]));
  return normalized;
}

function localDelete(projectId: string) {
  localStorage.removeItem(projectKey(projectId));
  const ids = new Set(JSON.parse(localStorage.getItem(PROJECT_INDEX_KEY) || '[]') as string[]);
  ids.delete(projectId);
  localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify([...ids]));
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error('No API URL configured');
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

export async function listProjects(): Promise<ProjectSummary[]> {
  try {
    return await requestJson<ProjectSummary[]>('/api/projects');
  } catch {
    return localList();
  }
}

export async function getProject(projectId: string): Promise<ProjectState> {
  let project: ProjectState;
  try {
    const apiProject = await requestJson<ProjectState>(`/api/projects/${encodeURIComponent(projectId)}`);
    project = normalizeProject({
      ...apiProject,
      media: apiProject.media.map((item) => ({ ...item, url: absoluteMediaUrl(item.url) }))
    });
  } catch {
    const raw = localStorage.getItem(projectKey(projectId));
    if (raw) {
      project = normalizeProject(JSON.parse(raw));
    } else {
      project = createDefaultProject('Map Daddy Project');
      project.id = projectId;
      project = localSave(project);
    }
  }

  // Resolve local media URLs
  for (const m of project.media) {
    const id = localMediaId(m);
    if (id) {
      const blob = await getLocalMediaBlob(id);
      if (blob) {
        m.id = id;
        m.url = createMediaObjectUrl(blob);
      } else {
        m.url = '';
      }
    } else if (m.id.startsWith('session_media_') || m.url.startsWith('session://')) {
      m.url = '';
    }
  }

  return project;
}

export async function saveProject(project: ProjectState): Promise<ProjectState> {
  const normalized = normalizeProject({ ...project, updatedAt: new Date().toISOString() });
  localSave(normalized);
  try {
    const toSave = {
      ...normalized,
      media: normalized.media.map(storedMedia)
    };
    return await requestJson<ProjectState>(`/api/projects/${encodeURIComponent(normalized.id)}`, {
      method: 'PUT',
      body: JSON.stringify(toSave)
    });
  } catch {
    return normalized;
  }
}

export async function renameProject(projectId: string, name: string): Promise<ProjectState> {
  const project = await getProject(projectId);
  return saveProject({ ...project, name: name.trim() || 'Untitled Project' });
}

export async function deleteProject(projectId: string): Promise<void> {
  const raw = localStorage.getItem(projectKey(projectId));
  if (raw) {
    try {
      const project = JSON.parse(raw) as ProjectState;
      for (const m of project.media || []) {
        const id = localMediaId(m);
        if (id) {
          await deleteLocalMedia(id);
        }
      }
    } catch {
      // Ignore parse errors during cleanup
    }
  }

  localDelete(projectId);
  try {
    await requestJson<{ status: string }>(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE'
    });
  } catch {
    // Local deletion is still useful when the API is unavailable.
  }
}

export async function createProject(name: string): Promise<ProjectState> {
  try {
    const project = await requestJson<ProjectState>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    localSave(project);
    return normalizeProject(project);
  } catch {
    return localSave(createDefaultProject(name));
  }
}

export async function uploadMedia(file: File, options: { onSessionOnlyMedia?: (message: string) => void } = {}): Promise<ProjectMedia> {
  if (API_URL) {
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await requestJson<{ url: string; filename: string }>('/api/media/upload', { method: 'POST', body });
      return {
        id: `media_${Date.now().toString(36)}`,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        url: absoluteMediaUrl(result.url),
        name: file.name,
        ...(file.type.startsWith('video/') ? { videoSettings: { ...DEFAULT_VIDEO_PLAYBACK_SETTINGS } } : {})
      };
    } catch {
      // Fall through to local mode if backend fails
    }
  }

  const isVideo = file.type.startsWith('video/');
  if (isVideo) {
    options.onSessionOnlyMedia?.('Videos are session-only in local mode and will not persist after refresh.');
    return {
      id: `session_media_${Date.now().toString(36)}`,
      type: 'video',
      url: createMediaObjectUrl(file),
      name: file.name,
      videoSettings: { ...DEFAULT_VIDEO_PLAYBACK_SETTINGS }
    };
  }

  const id = `local_media_${Date.now().toString(36)}`;
  await saveLocalMedia(id, file);
  return {
    id,
    type: 'image',
    url: createMediaObjectUrl(file),
    name: file.name
  };
}
