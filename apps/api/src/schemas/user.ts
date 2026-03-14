import { z } from 'zod';
import { MAX_NAME_LENGTH } from './common.js';

/**
 * Update user request body
 * PATCH /api/user
 */
export const updateUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name cannot be empty')
      .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
      .optional(),
    avatar: z
      .string()
      .trim()
      .max(500, 'Avatar cannot exceed 500 characters')
      .optional()
      .nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Name or avatar is required',
  });

// Type exports
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
