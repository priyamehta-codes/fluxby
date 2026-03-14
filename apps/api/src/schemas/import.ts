import { z } from 'zod';

/**
 * Column mapping for generic CSV import
 * Maps CSV column names to transaction fields
 */
export const columnMappingSchema = z
  .object({
    date: z.string().min(1, 'Date column is required'),
    amount: z.string().min(1, 'Amount column is required'),
    description: z.string().min(1, 'Description column is required'),
    // Optional fields
    iban: z.string().optional().nullable(),
    opposingIban: z.string().optional().nullable(),
    opposingName: z.string().optional().nullable(),
    balance: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
    debit: z.string().optional().nullable(),
    credit: z.string().optional().nullable(),
  })
  .refine(
    (data) => data.date && data.amount && data.description,
    'Required columns: date, amount, description'
  );

/**
 * Generic import request body
 * POST /api/import/generic/import
 */
export const genericImportSchema = z.object({
  mapping: z.union([
    columnMappingSchema,
    z.string().transform((str, ctx) => {
      try {
        const parsed = JSON.parse(str);
        const result = columnMappingSchema.safeParse(parsed);
        if (!result.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid column mapping format',
          });
          return z.NEVER;
        }
        return result.data;
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid JSON in mapping field',
        });
        return z.NEVER;
      }
    }),
  ]),
  accountId: z.coerce.number().int().positive().optional(),
});

/**
 * Date format options for import
 */
export const dateFormatSchema = z.enum([
  'YYYY-MM-DD',
  'DD-MM-YYYY',
  'MM-DD-YYYY',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYYMMDD',
]);

/**
 * Import preview request body
 * POST /api/import/preview
 */
export const importPreviewSchema = z.object({
  dateFormat: dateFormatSchema.optional(),
  skipRows: z.coerce.number().int().min(0).optional().default(0),
  hasHeader: z.boolean().optional().default(true),
});

// Type exports
export type ColumnMappingInput = z.infer<typeof columnMappingSchema>;
export type GenericImportInput = z.infer<typeof genericImportSchema>;
export type ImportPreviewInput = z.infer<typeof importPreviewSchema>;
