type SessionStatePayload = {
  sessionId: string;
  status: 'lobby' | 'active' | 'ended';
  currentPhrase: string;
  roundIndex: number;
  players: Array<{
    playerId: string;
    name: string;
    connectionStatus: 'connected' | 'disconnected';
  }>;
};

type EventMap = {
  AUTH_OK: { role: 'host' | 'player' };
  AUTH_ERROR: { message: string };
  SESSION_STATE: SessionStatePayload;
  PLAYER_JOINED: { playerId: string; name: string };
  PLAYER_DISCONNECTED: { playerId: string };
  PLAYER_RECONNECTED: { playerId: string };
  GAME_STARTED: { sessionId: string; currentPhrase: string };
  PROMPT_UPDATED: { text: string; roundIndex: number };
  QUESTION_ADVANCED: { roundIndex: number };
  GAME_ENDED: Record<string, never>;
  HOST_DISCONNECTED: Record<string, never>;
  ERROR: { code: string; message: string };
};

type EventType = keyof EventMap;
type Listener<T extends EventType> = (payload: EventMap[T]) => void;

type AuthPayload =
  | { role: 'host'; token: string; sessionId: string }
  | { role: 'player'; playerId: string; sessionId: string };

class TypedEventEmitter {
  private listeners = new Map<EventType, Set<(payload: unknown) => void>>();

  on<T extends EventType>(type: T, listener: Listener<T>): () => void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as (payload: unknown) => void);
    this.listeners.set(type, listeners);

    return () => {
      listeners.delete(listener as (payload: unknown) => void);
    };
  }

  emit<T extends EventType>(type: T, payload: EventMap[T]): void {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(payload);
    }
  }
}

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private manuallyClosed = false;
  private visibilityListenerAdded = false;
  private readonly events = new TypedEventEmitter();

  constructor(private readonly authPayload: AuthPayload) {}

  connect(): void {
    this.manuallyClosed = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    this.socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.send('AUTH', this.authPayload);
    });

    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data) as { type: EventType; payload: EventMap[EventType] };
      this.events.emit(message.type, message.payload as never);
    });

    this.socket.addEventListener('close', () => {
      if (this.manuallyClosed) {
        return;
      }

      const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
      this.reconnectAttempts += 1;
      window.setTimeout(() => this.connect(), delay);
    });

    // A backgrounded mobile tab can have its WebSocket killed by the OS/browser
    // without ever firing 'close' (e.g. screen lock, app switch). Re-check the
    // connection when the page comes back to the foreground so a silently dead
    // socket gets replaced instead of leaving the player stuck.
    if (!this.visibilityListenerAdded) {
      this.visibilityListenerAdded = true;
      document.addEventListener('visibilitychange', () => {
        if (
          document.visibilityState === 'visible' &&
          !this.manuallyClosed &&
          this.socket?.readyState !== WebSocket.OPEN
        ) {
          this.connect();
        }
      });
    }
  }

  close(): void {
    this.manuallyClosed = true;
    this.socket?.close();
    this.socket = null;
  }

  on<T extends EventType>(type: T, listener: Listener<T>): () => void {
    return this.events.on(type, listener);
  }

  send(type: string, payload: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }
}
