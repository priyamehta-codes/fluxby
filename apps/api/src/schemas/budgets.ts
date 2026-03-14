import { z } from 'zod';
import { dateSchema, positiveAmountSchema, idParamSchema } from './common.js';

/**
 * Budget period enum
 */
export const budgetPeriodSchema = z.enum(['monthly', 'yearly'], {
  error: 'Period must be monthly or yearly',
});

/**
 * Create budget request body
 * POST /api/budgets
 */
export const createBudgetSchema = z
  .object({
    categoryId: z.coerce.number().int().positive().optional().nullable(),
    amount: positiveAmountSchema,
    period: budgetPeriodSchema.optional().default('monthly'),
    startDate: dateSchema.optional().nullable(),
    endDate: dateSchema.optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'Start date must be before or equal to end date',
      path: ['endDate'],
    }
  );

/**
 * Update budget request body
 * PATCH /api/budgets/:id
 */
export const updateBudgetSchema = z
  .object({
    categoryId: z.coerce.number().int().positive().optional().nullable(),
    amount: positiveAmountSchema.optional(),
    period: budgetPeriodSchema.optional(),
    startDate: dateSchema.optional().nullable(),
    endDate: dateSchema.optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'Start date must be before or equal to end date',
      path: ['endDate'],
    }
  );

/**
 * Budget ID parameter
 */
export const budgetIdParamSchema = z.object({
  id: idParamSchema,
});

// Type exports
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
