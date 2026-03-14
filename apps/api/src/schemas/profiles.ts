import { z } from 'zod';
import { MAX_NAME_LENGTH } from './common.js';

/**
 * Profile types
 */
export const profileTypeSchema = z.enum(
  ['personal', 'business', 'shared', 'savings'],
  {
    error: 'Type must be personal, business, shared, or savings',
  }
);

/**
 * Create profile request body
 * POST /api/profiles
 */
export const createProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`),
  type: profileTypeSchema,
  avatarUrl: z.string().url('Invalid URL').optional().nullable(),
});

/**
 * Update profile request body
 * PATCH /api/profiles/:id
 */
export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name cannot be empty')
      .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
      .optional(),
    type: profileTypeSchema.optional(),
    avatarUrl: z.string().url('Invalid URL').optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

// Type exports
export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
