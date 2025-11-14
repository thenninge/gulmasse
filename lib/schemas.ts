import { z } from 'zod';

export const pinSchema = z
  .string()
  .regex(/^[0-9]{4}$/, 'PIN must be 4 digits');

export const createPinBodySchema = z.object({
  pin: pinSchema.optional(),
  nickname: z.string().trim().min(1).max(50).optional(),
});

export const loginBodySchema = z.object({
  pin: pinSchema,
});

export const voteBodySchema = z.object({
  pin: pinSchema,
  value: z.number().int().min(1).max(6),
  extra: z.number().int().min(1).max(6).optional(),
});


