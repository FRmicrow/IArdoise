export type SessionStatus = 'lobby' | 'active' | 'ended';
export type ConnectionStatus = 'connected' | 'disconnected';

export interface SessionSettings {
  roundDurationSec: number;
  maxRounds: number;
  maxPlayers: number;
  pointsEnabled: boolean;
}

export interface Session {
  id: string;
  status: SessionStatus;
  joinUrl: string;
  currentPhrase: string;
  roundIndex: number;
  players: Map<string, Player>;
  phrases: Phrase[];
  createdAt: Date;
  settings: SessionSettings;
  /** roundIndex -> (playerId -> points), only rounds the host actually scored are present */
  roundScores: Map<number, Map<string, number>>;
}

export interface Player {
  id: string;
  sessionId: string;
  name: string;
  connectionStatus: ConnectionStatus;
  isHost: boolean;
  wsClientId: string | null;
  registeredAt: Date;
  finishedCurrentRound: boolean;
}

export interface Phrase {
  index: number;
  text: string;
  setAt: Date;
}
