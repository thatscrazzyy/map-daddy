import { createDefaultProject, normalizeProject } from './defaultProject';
import type { ProjectMedia, ProjectState, ProjectSummary } from './types';

const DEV_BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000');
export const API_URL = (localStorage.getItem('md_api_url') || import.meta.env.VITE_MAP_DADDY_API_URL || DEV_BACKEND_URL || '').replace(/\/$/, '');
export const PUBLIC_BACKEND_URL = (import.meta.env.VITE_MAP_DADDY_PUBLIC_BACKEND_URL || API_URL || '').replace(/\/$/, '');

const PROJECT_INDEX_KEY = 'map-daddy.projects';
const projectKey = (projectId: string) => `map-daddy.project.${projectId}`;

function absoluteMediaUrl(url: string) {
  if (!url || !PUBLIC_BACKEND_URL || !url.startsWith('/media/')) return url;
  return `${PUBLIC_BACKEND_URL}${url}`;
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
  localStorage.setItem(projectKey(normalized.id), JSON.stringify(normalized));
  const ids = new Set(JSON.parse(localStorage.getItem(PROJECT_INDEX_KEY) || '[]') as string[]);
  ids.add(normalized.id);
  localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify([...ids]));
  return normalized;
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
  try {
    const project = await requestJson<ProjectState>(`/api/projects/${encodeURIComponent(projectId)}`);
    return normalizeProject({
      ...project,
      media: project.media.map((item) => ({ ...item, url: absoluteMediaUrl(item.url) }))
    });
  } catch {
    const raw = localStorage.getItem(projectKey(projectId));
    if (raw) return normalizeProject(JSON.parse(raw));
    const project = createDefaultProject('Map Daddy Project');
    project.id = projectId;
    return localSave(project);
  }
}

export async function saveProject(project: ProjectState): Promise<ProjectState> {
  const normalized = normalizeProject({ ...project, updatedAt: new Date().toISOString() });
  localSave(normalized);
  try {
    return await requestJson<ProjectState>(`/api/projects/${encodeURIComponent(normalized.id)}`, {
      method: 'PUT',
      body: JSON.stringify(normalized)
    });
  } catch {
    return normalized;
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

export async function uploadMedia(file: File): Promise<ProjectMedia> {
  if (API_URL) {
    const body = new FormData();
    body.append('file', file);
    const result = await requestJson<{ url: string; filename: string }>('/api/media/upload', { method: 'POST', body });
    return {
      id: `media_${Date.now().toString(36)}`,
      type: file.type.startsWith('video/') ? 'video' : 'image',
      url: absoluteMediaUrl(result.url),
      name: file.name
    };
  }

  return {
    id: `media_${Date.now().toString(36)}`,
    type: file.type.startsWith('video/') ? 'video' : 'image',
    url: URL.createObjectURL(file),
    name: file.name
  };
}
