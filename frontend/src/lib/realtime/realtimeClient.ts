import type { ProjectState } from '../projects/types';

function configuredRelayUrl() {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('md_relay_url') : '';
  return (saved || import.meta.env.VITE_MAP_DADDY_RELAY_URL || '').replace(/\/$/, '');
}

export const RELAY_URL = configuredRelayUrl();

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
  private clientId = `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  private lastSentAt = 0;
  private trailingSendTimer = 0;
  private pendingProject: ProjectState | null = null;
  private presenceTimer = 0;
  private localProjectors = new Map<string, number>();
  private relayProjectorCount = 0;

  private localChannel: BroadcastChannel | null = null;
  private messageStorageKey: string;
  private latestStorageKey: string;

  constructor(projectId: string, role: Role, handlers: RealtimeHandlers = {}) {
    this.projectId = projectId;
    this.role = role;
    this.handlers = handlers;
    this.messageStorageKey = `map-daddy.sync.${projectId}.message`;
    this.latestStorageKey = `map-daddy.sync.${projectId}.latest`;

    if (typeof BroadcastChannel !== 'undefined') {
      this.localChannel = new BroadcastChannel(`map-daddy.project.${this.projectId}`);
      this.localChannel.onmessage = (event) => this.handleLocalMessage(event.data);
    }
    window.addEventListener('storage', this.handleStorageEvent);
  }

  private handleLocalMessage = (message: any) => {
    if (!message || message.clientId === this.clientId) return;

    if (message.type === 'project:update' && message.project) {
      if (this.role === 'projector') {
        this.latestProject = message.project;
        this.handlers.onProject?.(message.project);
        this.handlers.onStatus?.('synced');
      }
    } else if (message.type === 'project:request') {
      if (this.role === 'editor' && this.latestProject) {
        this.sendLocalMessage({ type: 'project:update', project: this.latestProject });
      }
    } else if (message.type === 'projector:online' && this.role === 'editor') {
      this.localProjectors.set(message.clientId, Date.now());
      this.emitPresence();
      this.updateLocalStatus();
      if (this.latestProject) {
        this.sendLocalMessage({ type: 'project:update', project: this.latestProject });
      }
    } else if (message.type === 'projector:offline' && this.role === 'editor') {
      this.localProjectors.delete(message.clientId);
      this.emitPresence();
      this.updateLocalStatus();
    }
  };

  private handleStorageEvent = (event: StorageEvent) => {
    if (event.key === this.messageStorageKey && event.newValue) {
      try {
        const message = JSON.parse(event.newValue);
        this.handleLocalMessage(message);
      } catch {
        // ignore parse error
      }
    }
  };

  private sendLocalMessage(message: any) {
    const payload = { ...message, clientId: this.clientId, _ts: Date.now() };
    if (message.type === 'project:update' && message.project) {
      localStorage.setItem(this.latestStorageKey, JSON.stringify(payload));
    }
    if (this.localChannel) {
      this.localChannel.postMessage(payload);
    } else {
      localStorage.setItem(this.messageStorageKey, JSON.stringify(payload));
    }
  }

  private loadLocalSnapshot() {
    const raw = localStorage.getItem(this.latestStorageKey);
    if (!raw) return;

    try {
      const message = JSON.parse(raw);
      if (message.type === 'project:update' && message.project) {
        this.latestProject = message.project;
        this.handlers.onProject?.(message.project);
        this.handlers.onStatus?.('synced');
      }
    } catch {
      // ignore stale local sync snapshot
    }
  }

  private announceProjectorPresence() {
    if (this.role === 'projector') {
      this.sendLocalMessage({ type: 'projector:online' });
    }
  }

  private pruneLocalPresence() {
    const cutoff = Date.now() - 6500;
    for (const [clientId, lastSeen] of this.localProjectors) {
      if (lastSeen < cutoff) this.localProjectors.delete(clientId);
    }
  }

  private emitPresence() {
    this.pruneLocalPresence();
    this.handlers.onPresence?.({
      editorCount: 0,
      projectorCount: Math.max(this.relayProjectorCount, this.localProjectors.size)
    });
  }

  private updateLocalStatus() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.role === 'editor') {
      this.handlers.onStatus?.(this.localProjectors.size > 0 ? 'synced' : 'local');
    } else {
      this.handlers.onStatus?.(this.latestProject ? 'synced' : 'local');
    }
  }

  connect() {
    this.shouldReconnect = true;
    window.clearInterval(this.presenceTimer);

    if (this.role === 'projector') {
      this.loadLocalSnapshot();
      this.announceProjectorPresence();
      this.sendLocalMessage({ type: 'project:request' });
      this.presenceTimer = window.setInterval(() => this.announceProjectorPresence(), 2500);
    } else {
      this.presenceTimer = window.setInterval(() => {
        this.emitPresence();
        this.updateLocalStatus();
      }, 2500);
    }

    if (!RELAY_URL) {
      this.updateLocalStatus();
      return;
    }

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
          this.relayProjectorCount = Number(message.projectorCount || 0);
          this.emitPresence();
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
      if (this.shouldReconnect) {
        this.updateLocalStatus();
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => this.connect(), 1500);
      } else {
        this.updateLocalStatus();
      }
    };

    this.ws.onerror = () => {
      this.updateLocalStatus();
    };
  }

  sendProject(project: ProjectState, force = false) {
    this.latestProject = project;
    if (this.role !== 'editor') return;

    const now = Date.now();
    const elapsed = now - this.lastSentAt;

    this.sendLocalMessage({ type: 'project:update', project });

    if (!force && elapsed < 80) {
      this.pendingProject = project;
      window.clearTimeout(this.trailingSendTimer);
      this.trailingSendTimer = window.setTimeout(() => {
        const pending = this.pendingProject;
        this.pendingProject = null;
        if (pending) this.sendProject(pending, true);
      }, 80 - elapsed);
      return;
    }

    this.lastSentAt = now;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'project:update', projectId: this.projectId, project }));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    window.clearTimeout(this.reconnectTimer);
    window.clearTimeout(this.trailingSendTimer);
    window.clearInterval(this.presenceTimer);
    if (this.role === 'projector') this.sendLocalMessage({ type: 'projector:offline' });
    this.ws?.close();
    this.ws = null;

    if (this.localChannel) {
      this.localChannel.close();
      this.localChannel = null;
    }
    window.removeEventListener('storage', this.handleStorageEvent);
  }
}
