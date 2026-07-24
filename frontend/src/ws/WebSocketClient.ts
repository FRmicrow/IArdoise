type SessionSettingsPayload = {
  roundDurationSec: number;
  maxRounds: number;
  maxPlayers: number;
  pointsEnabled: boolean;
};

type SessionStatePayload = {
  sessionId: string;
  status: 'lobby' | 'active' | 'ended';
  currentPhrase: string;
  roundIndex: number;
  players: Array<{
    playerId: string;
    name: string;
    connectionStatus: 'connected' | 'disconnected';
    finishedCurrentRound: boolean;
  }>;
  settings: SessionSettingsPayload;
  cumulativeScores: Record<string, number>;
};

type PlayerResultPayload = {
  playerId: string;
  name: string;
  totalPoints: number;
  rank: number;
};

type EventMap = {
  AUTH_OK: { role: 'host' | 'player' };
  AUTH_ERROR: { message: string };
  SESSION_STATE: SessionStatePayload;
  PLAYER_JOINED: { playerId: string; name: string };
  PLAYER_DISCONNECTED: { playerId: string };
  PLAYER_RECONNECTED: { playerId: string };
  PLAYER_FINISHED: { playerId: string };
  SCORES_UPDATED: { roundIndex: number; totals: Record<string, number> };
  GAME_STARTED: { sessionId: string; currentPhrase: string };
  PROMPT_UPDATED: { text: string; roundIndex: number };
  QUESTION_ADVANCED: { roundIndex: number; maxRounds: number };
  GAME_ENDED: { pointsEnabled: boolean; results: PlayerResultPayload[] };
  HOST_DISCONNECTED: Record<string, never>;
  PONG: Record<string, never>;
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

// A player sitting on the waiting screen can end up on a socket that reports
// OPEN but is actually unreachable (NAT/mobile idle-drop, no close/error
// event on either end). Browsers don't expose the native WS ping/pong
// control frames to JS, so this application-level probe is the only way for
// the client to independently detect that condition, regardless of tab
// visibility.
const HEARTBEAT_INTERVAL_MS = 20000;
const HEARTBEAT_REPLY_TIMEOUT_MS = 8000;

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private manuallyClosed = false;
  private visibilityListenerAdded = false;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private pongTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly events = new TypedEventEmitter();

  constructor(private readonly authPayload: AuthPayload) {
    this.on('PONG', () => this.clearPongTimeout());
  }

  connect(): void {
    this.manuallyClosed = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.send('AUTH', this.authPayload);
      this.startHeartbeat();
    });

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data) as { type: EventType; payload: EventMap[EventType] };
      this.events.emit(message.type, message.payload as never);
    });

    socket.addEventListener('close', () => {
      // A stale socket we force-replaced (e.g. from visibilitychange) is no
      // longer this.socket by the time its close event fires — ignore it so
      // we don't schedule a second reconnect on top of the replacement.
      if (this.manuallyClosed || this.socket !== socket) {
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
        if (document.visibilityState === 'visible' && !this.manuallyClosed) {
          this.socket?.close();
          this.connect();
        }
      });
    }
  }

  close(): void {
    this.manuallyClosed = true;
    this.clearHeartbeat();
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

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatIntervalId = window.setInterval(() => {
      this.send('PING', {});
      this.pongTimeoutId = window.setTimeout(() => {
        // No PONG within the reply window — treat the connection as dead,
        // exactly like the visibilitychange handler does for a socket found
        // stale on foregrounding.
        this.socket?.close();
        this.connect();
      }, HEARTBEAT_REPLY_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearPongTimeout(): void {
    if (this.pongTimeoutId !== null) {
      window.clearTimeout(this.pongTimeoutId);
      this.pongTimeoutId = null;
    }
  }

  private clearHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) {
      window.clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    this.clearPongTimeout();
  }
}
