import { z } from 'zod';
import {
  dateSchema,
  amountSchema,
  idParamSchema,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_PAYMENT_METHOD_LENGTH,
} from './common.js';

/**
 * Transaction type enum
 */
export const transactionTypeSchema = z.enum(['income', 'expense', 'transfer'], {
  error: 'Type must be income, expense, or transfer',
});

/**
 * Create transaction request body
 * POST /api/transactions
 */
export const createTransactionSchema = z.object({
  date: dateSchema,
  amount: amountSchema,
  type: transactionTypeSchema,
  description: z
    .string()
    .trim()
    .max(
      MAX_DESCRIPTION_LENGTH,
      `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`
    )
    .optional()
    .default(''),
  accountId: z.coerce
    .number()
    .int('Account ID must be an integer')
    .positive('Account ID must be positive'),
  merchantName: z
    .string()
    .trim()
    .max(
      MAX_NAME_LENGTH,
      `Merchant name cannot exceed ${MAX_NAME_LENGTH} characters`
    )
    .optional()
    .nullable(),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  notes: z
    .string()
    .trim()
    .max(MAX_NOTES_LENGTH, `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`)
    .optional()
    .nullable(),
});

/**
 * Update transaction request body
 * PATCH /api/transactions/:id
 */
export const updateTransactionSchema = z
  .object({
    type: transactionTypeSchema.optional(),
    categoryId: z.coerce.number().int().positive().optional().nullable(),
    notes: z
      .string()
      .trim()
      .max(
        MAX_NOTES_LENGTH,
        `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`
      )
      .optional()
      .nullable(),
    merchantName: z
      .string()
      .trim()
      .max(
        MAX_NAME_LENGTH,
        `Merchant name cannot exceed ${MAX_NAME_LENGTH} characters`
      )
      .optional()
      .nullable(),
    paymentMethod: z
      .string()
      .trim()
      .max(
        MAX_PAYMENT_METHOD_LENGTH,
        `Payment method cannot exceed ${MAX_PAYMENT_METHOD_LENGTH} characters`
      )
      .optional()
      .nullable(),
    addressBookId: z.coerce.number().int().positive().optional().nullable(),
    paymentProvider: z
      .string()
      .trim()
      .max(
        MAX_NAME_LENGTH,
        `Payment provider cannot exceed ${MAX_NAME_LENGTH} characters`
      )
      .optional()
      .nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

/**
 * Transaction ID parameter
 */
export const transactionIdParamSchema = z.object({
  id: idParamSchema,
});

/**
 * Bulk categorize transactions request body
 * POST /api/transactions/bulk-categorize
 */
export const bulkCategorizeSchema = z.object({
  transactionIds: z
    .array(z.coerce.number().int().positive())
    .min(1, 'At least one transaction ID is required'),
  categoryId: z.coerce.number().int().positive(),
});

/**
 * Categorize by counterparty request body
 * POST /api/transactions/categorize-by-counterparty
 */
export const categorizeByCounterpartySchema = z.object({
  counterpartyIban: z.string().trim().min(1, 'Counterparty IBAN is required'),
  categoryId: z.coerce.number().int().positive(),
});

/**
 * Rename by counterparty request body
 * POST /api/transactions/rename-by-counterparty
 */
export const renameByCounterpartySchema = z.object({
  counterpartyIban: z.string().trim().min(1, 'Counterparty IBAN is required'),
  newMerchantName: z
    .string()
    .trim()
    .min(1, 'New merchant name is required')
    .max(
      MAX_NAME_LENGTH,
      `Merchant name cannot exceed ${MAX_NAME_LENGTH} characters`
    ),
});

// Type exports
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type BulkCategorizeInput = z.infer<typeof bulkCategorizeSchema>;
export type CategorizeByCounterpartyInput = z.infer<
  typeof categorizeByCounterpartySchema
>;
export type RenameByCounterpartyInput = z.infer<
  typeof renameByCounterpartySchema
>;
