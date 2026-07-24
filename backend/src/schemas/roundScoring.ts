import { z } from 'zod';

export const markDrawingDoneSchema = z.object({
  sessionId: z.string().min(1),
});

export const awardRoundPointsSchema = z.object({
  sessionId: z.string().min(1),
  roundIndex: z.number().int().min(0),
  points: z.record(z.string().min(1), z.number().int().min(0)).refine((p) => Object.keys(p).length > 0, {
    message: 'points must not be empty',
  }),
});
