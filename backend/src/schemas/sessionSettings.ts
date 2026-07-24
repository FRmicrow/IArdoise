import { z } from 'zod';
import type { SessionSettings } from '../session/types.js';

export const ROUND_DURATION_OPTIONS = [30, 60, 90, 120] as const;
export const MAX_ROUNDS_OPTIONS = [3, 5, 10] as const;
export const MAX_PLAYERS_OPTIONS = [4, 8, 12, 16] as const;

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  roundDurationSec: 60,
  maxRounds: 3,
  maxPlayers: 8,
  pointsEnabled: true,
};

function oneOf<T extends readonly number[]>(options: T) {
  return z.number().refine((value): value is T[number] => (options as readonly number[]).includes(value), {
    message: `Value must be one of: ${options.join(', ')}`,
  });
}

/** Body schema for POST /api/sessions — settings fields are optional; missing ones fall back to defaults (FR-004). */
export const createSessionBodySchema = z.object({
  initialPhrase: z.string().optional(),
  roundDurationSec: oneOf(ROUND_DURATION_OPTIONS).optional(),
  maxRounds: oneOf(MAX_ROUNDS_OPTIONS).optional(),
  maxPlayers: oneOf(MAX_PLAYERS_OPTIONS).optional(),
  pointsEnabled: z.boolean().optional(),
});

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;

export function resolveSessionSettings(body: CreateSessionBody): SessionSettings {
  return {
    roundDurationSec: body.roundDurationSec ?? DEFAULT_SESSION_SETTINGS.roundDurationSec,
    maxRounds: body.maxRounds ?? DEFAULT_SESSION_SETTINGS.maxRounds,
    maxPlayers: body.maxPlayers ?? DEFAULT_SESSION_SETTINGS.maxPlayers,
    pointsEnabled: body.pointsEnabled ?? DEFAULT_SESSION_SETTINGS.pointsEnabled,
  };
}
