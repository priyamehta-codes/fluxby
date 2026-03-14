import { z } from 'zod';
import {
  nameSchema,
  iconSchema,
  colorSchema,
  prioritySchema,
  idParamSchema,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_PATTERN_LENGTH,
} from './common.js';

/**
 * Create category request body
 * POST /api/categories
 */
export const createCategorySchema = z.object({
  name: nameSchema,
  parentId: z.coerce.number().int().positive().optional().nullable(),
  icon: iconSchema,
  color: colorSchema,
  description: z
    .string()
    .trim()
    .max(
      MAX_DESCRIPTION_LENGTH,
      `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`
    )
    .optional()
    .nullable(),
});

/**
 * Update category request body
 * PATCH /api/categories/:id
 */
export const updateCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
      .optional(),
    parentId: z.coerce.number().int().positive().optional().nullable(),
    icon: iconSchema,
    color: colorSchema,
    description: z
      .string()
      .trim()
      .max(
        MAX_DESCRIPTION_LENGTH,
        `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`
      )
      .optional()
      .nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

/**
 * Regex pattern validation - prevent dangerous patterns
 */
const safePatternSchema = z
  .string()
  .trim()
  .min(1, 'Pattern is required')
  .max(
    MAX_PATTERN_LENGTH,
    `Pattern cannot exceed ${MAX_PATTERN_LENGTH} characters`
  )
  .refine(
    (pattern) => {
      // Block dangerous ReDoS patterns
      const dangerousPatterns = [
        /(\+|\*|\{[0-9]+,\})\s*(\+|\*|\{[0-9]+,\})/, // Nested quantifiers
        /\(\?[^)]*\(/, // Nested groups with modifiers
        /\\1/, // Backreferences
      ];
      return !dangerousPatterns.some((dp) => dp.test(pattern));
    },
    { message: 'Pattern contains potentially dangerous regex constructs' }
  );

/**
 * Create category rule request body
 * POST /api/categories/rules
 */
export const createCategoryRuleSchema = z.object({
  pattern: safePatternSchema,
  categoryId: z.coerce
    .number()
    .int('Category ID must be an integer')
    .positive('Category ID must be positive'),
  priority: prioritySchema,
});

/**
 * Update category rule request body
 * PUT /api/categories/rules/:id
 */
export const updateCategoryRuleSchema = z
  .object({
    pattern: safePatternSchema.optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    priority: prioritySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

/**
 * Category ID parameter
 */
export const categoryIdParamSchema = z.object({
  id: idParamSchema,
});

/**
 * Category seed request body
 * POST /api/categories/seed
 */
export const seedCategoriesSchema = z.object({
  language: z.enum(['nl', 'en']).optional().default('nl'),
});

// Type exports
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateCategoryRuleInput = z.infer<typeof createCategoryRuleSchema>;
export type UpdateCategoryRuleInput = z.infer<typeof updateCategoryRuleSchema>;
export type SeedCategoriesInput = z.infer<typeof seedCategoriesSchema>;
