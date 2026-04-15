import { z } from 'zod';
import {
  ibanSchema,
  nameSchema,
  idParamSchema,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_PATTERN_LENGTH,
} from './common.js';

/**
 * Create address book entry request body
 * POST /api/addressbook
 */
export const createAddressBookEntrySchema = z.object({
  iban: ibanSchema,
  name: nameSchema,
  description: z
    .string()
    .trim()
    .max(
      MAX_DESCRIPTION_LENGTH,
      `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`
    )
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(MAX_NOTES_LENGTH, `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`)
    .optional()
    .nullable(),
  originalName: z
    .string()
    .trim()
    .max(
      MAX_NAME_LENGTH,
      `Original name cannot exceed ${MAX_NAME_LENGTH} characters`
    )
    .optional()
    .nullable(),
});

/**
 * Update address book entry request body
 * PATCH /api/addressbook/:id
 */
export const updateAddressBookEntrySchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
      .optional(),
    description: z
      .string()
      .trim()
      .max(
        MAX_DESCRIPTION_LENGTH,
        `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`
      )
      .optional()
      .nullable(),
    notes: z
      .string()
      .trim()
      .max(
        MAX_NOTES_LENGTH,
        `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`
      )
      .optional()
      .nullable(),
    ibans: z.array(ibanSchema).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

/**
 * Address book entry ID parameter
 */
export const addressBookIdParamSchema = z.object({
  id: idParamSchema,
});

/**
 * Add IBAN to contact request body
 * POST /api/addressbook/:id/ibans
 */
export const addIbanToContactSchema = z.object({
  iban: ibanSchema,
});

/**
 * Lookup address book entry by IBAN
 * POST /api/addressbook/by-iban
 */
export const lookupByIbanSchema = z.object({
  iban: ibanSchema,
});

/**
 * Cleanup rule schema
 * POST /api/addressbook/cleanup-rules
 */
export const createCleanupRuleSchema = z.object({
  pattern: z
    .string()
    .trim()
    .min(1, 'Pattern is required')
    .max(
      MAX_PATTERN_LENGTH,
      `Pattern cannot exceed ${MAX_PATTERN_LENGTH} characters`
    ),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update cleanup rule request body
 * PATCH /api/addressbook/cleanup-rules/:id
 */
export const updateCleanupRuleSchema = z
  .object({
    pattern: z
      .string()
      .trim()
      .max(
        MAX_PATTERN_LENGTH,
        `Pattern cannot exceed ${MAX_PATTERN_LENGTH} characters`
      )
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

/**
 * Merge contacts request body
 * POST /api/addressbook/merge
 */
export const mergeContactsSchema = z.object({
  contactIds: z
    .array(z.coerce.number().int())
    .min(2, 'At least 2 contact IDs are required'),
  name: z
    .string()
    .trim()
    .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
    .optional(),
});

/**
 * Merge duplicates request body (auto-merge)
 * POST /api/addressbook/merge-duplicates
 */
export const mergeDuplicatesSchema = z
  .object({
    autoMerge: z.boolean().optional().default(false),
  })
  .optional();

/**
 * Split contact request body
 * POST /api/addressbook/split
 */
export const splitContactSchema = z.object({
  contactId: z.coerce.number().int().positive(),
  mappings: z
    .array(
      z.object({
        iban: ibanSchema,
        name: nameSchema,
      })
    )
    .min(1, 'At least one mapping is required'),
});

/**
 * Shared IBAN request body
 * POST /api/addressbook/shared-ibans
 */
export const createSharedIbanSchema = z.object({
  iban: ibanSchema,
});

/**
 * Payment provider request body
 * POST /api/addressbook/payment-providers
 */
export const createPaymentProviderSchema = z.object({
  iban: ibanSchema,
  name: nameSchema,
  isAutoDetected: z.boolean().optional().default(false),
});

/**
 * Payment provider rule request body
 * POST /api/addressbook/payment-provider-rules
 */
export const createPaymentProviderRuleSchema = z.object({
  name: nameSchema,
  patterns: z
    .string()
    .trim()
    .min(1, 'Patterns are required')
    .max(
      MAX_PATTERN_LENGTH * 5,
      `Patterns cannot exceed ${MAX_PATTERN_LENGTH * 5} characters`
    ),
});

/**
 * Update payment provider rule request body
 * PATCH /api/addressbook/payment-provider-rules/:id
 */
export const updatePaymentProviderRuleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
      .optional(),
    patterns: z
      .string()
      .trim()
      .max(
        MAX_PATTERN_LENGTH * 5,
        `Patterns cannot exceed ${MAX_PATTERN_LENGTH * 5} characters`
      )
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

// Type exports
export type CreateAddressBookEntryInput = z.infer<
  typeof createAddressBookEntrySchema
>;
export type UpdateAddressBookEntryInput = z.infer<
  typeof updateAddressBookEntrySchema
>;
export type AddIbanToContactInput = z.infer<typeof addIbanToContactSchema>;
export type CreateCleanupRuleInput = z.infer<typeof createCleanupRuleSchema>;
export type UpdateCleanupRuleInput = z.infer<typeof updateCleanupRuleSchema>;
export type MergeContactsInput = z.infer<typeof mergeContactsSchema>;
export type SplitContactInput = z.infer<typeof splitContactSchema>;
export type CreateSharedIbanInput = z.infer<typeof createSharedIbanSchema>;
export type CreatePaymentProviderInput = z.infer<
  typeof createPaymentProviderSchema
>;
export type CreatePaymentProviderRuleInput = z.infer<
  typeof createPaymentProviderRuleSchema
>;
export type UpdatePaymentProviderRuleInput = z.infer<
  typeof updatePaymentProviderRuleSchema
>;
