import { z } from 'zod';
import {
  ibanSchema,
  nameSchema,
  idArraySchema,
  idParamSchema,
  MAX_NAME_LENGTH,
} from './common.js';

/**
 * Account type enum
 */
export const accountTypeSchema = z.enum(['checking', 'savings', 'credit'], {
  error: 'Type must be checking, savings, or credit',
});

/**
 * Create account request body
 * POST /api/accounts
 */
export const createAccountSchema = z.object({
  iban: ibanSchema,
  name: nameSchema,
  type: accountTypeSchema.optional().default('checking'),
});

/**
 * Update account request body
 * PATCH /api/accounts/:id
 */
export const updateAccountSchema = z
  .object({
    iban: ibanSchema.optional(),
    name: z
      .string()
      .trim()
      .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
      .optional(),
    type: accountTypeSchema.optional(),
    currentBalance: z.number().optional(),
    initialBalance: z.number().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

/**
 * Update account order request body
 * PATCH /api/accounts/order
 */
export const updateAccountOrderSchema = z.object({
  accountIds: idArraySchema,
});

/**
 * Account ID parameter
 */
export const accountIdParamSchema = z.object({
  id: idParamSchema,
});

// Type exports
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type UpdateAccountOrderInput = z.infer<typeof updateAccountOrderSchema>;
