import type { ProjectState } from '../projects/types';

const DEV_RELAY_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_MAP_DADDY_RELAY_URL || 'ws://localhost:8080');
export const RELAY_URL = (localStorage.getItem('md_relay_url') || import.meta.env.VITE_MAP_DADDY_RELAY_URL || DEV_RELAY_URL || '').replace(/\/$/, '');

type Role = 'editor' | 'projector';

type RealtimeHandlers = {
  onStatus?: (status: string) => void;
  onPresence?: (presence: { editorCount: number; projectorCount: number }) => void;
  onProject?: (project: ProjectState) => void;
  onError?: (message: string) => void;
};

export class ProjectRealtimeClient {
  private projectId: string;
  private role: Role;
  private handlers: RealtimeHandlers;
  private ws: WebSocket | null = null;
  private reconnectTimer = 0;
  private shouldReconnect = true;
  private latestProject: ProjectState | null = null;
  private lastSentAt = 0;

  constructor(projectId: string, role: Role, handlers: RealtimeHandlers = {}) {
    this.projectId = projectId;
    this.role = role;
    this.handlers = handlers;
  }

  connect() {
    if (!RELAY_URL) {
      this.handlers.onStatus?.('offline');
      return;
    }
    this.shouldReconnect = true;
    this.handlers.onStatus?.('connecting');
    this.ws = new WebSocket(RELAY_URL);

    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({ type: 'project:join', projectId: this.projectId, role: this.role }));
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'project:joined') {
          this.handlers.onStatus?.('connected');
          if (this.role === 'editor' && this.latestProject) this.sendProject(this.latestProject, true);
        } else if (message.type === 'project:presence') {
          this.handlers.onPresence?.({
            editorCount: Number(message.editorCount || 0),
            projectorCount: Number(message.projectorCount || 0)
          });
        } else if (message.type === 'project:update' && message.project) {
          this.handlers.onProject?.(message.project);
        } else if (message.type === 'error') {
          this.handlers.onError?.(message.message || 'Realtime error');
        }
      } catch (error) {
        this.handlers.onError?.('Could not parse realtime message');
      }
    };

    this.ws.onclose = () => {
      this.handlers.onStatus?.('reconnecting');
      if (this.shouldReconnect) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => this.connect(), 1500);
      }
    };

    this.ws.onerror = () => {
      this.handlers.onError?.('WebSocket connection failed');
    };
  }

  sendProject(project: ProjectState, force = false) {
    this.latestProject = project;
    if (this.role !== 'editor') return;
    const now = Date.now();
    if (!force && now - this.lastSentAt < 60) return;
    this.lastSentAt = now;
    if (this.ws?.readyState === WebSocket.OPEN) {
      // The relay keeps the latest state in memory and fans it out to every projector in the project room.
      this.ws.send(JSON.stringify({ type: 'project:update', projectId: this.projectId, project }));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    window.clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
