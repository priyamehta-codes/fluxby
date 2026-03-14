import { z } from 'zod';

/**
 * Common validation patterns and utilities
 */

// Maximum string lengths to prevent abuse
export const MAX_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_NOTES_LENGTH = 5000;
export const MAX_PATTERN_LENGTH = 500;
export const MAX_ICON_LENGTH = 50;
export const MAX_COLOR_LENGTH = 20;
export const MAX_IBAN_LENGTH = 34;
export const MAX_PAYMENT_METHOD_LENGTH = 50;

/**
 * ISO 8601 date format (YYYY-MM-DD)
 */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((date) => !isNaN(Date.parse(date)), 'Invalid date');

/**
 * ISO 8601 datetime format (YYYY-MM-DDTHH:mm:ss or with timezone)
 */
export const dateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/,
    'Invalid datetime format'
  )
  .refine((date) => !isNaN(Date.parse(date)), 'Invalid datetime');

/**
 * Basic IBAN validation (format only, not checksum)
 * IBANs are 15-34 alphanumeric characters, starting with 2 letters (country code)
 */
export const ibanSchema = z
  .string()
  .trim()
  .min(15, 'IBAN must be at least 15 characters')
  .max(MAX_IBAN_LENGTH, `IBAN cannot exceed ${MAX_IBAN_LENGTH} characters`)
  .regex(/^[A-Z]{2}[A-Z0-9]+$/i, 'Invalid IBAN format')
  .transform((val) => val.toUpperCase());

/**
 * ID parameter (positive integer as string or number)
 */
export const idParamSchema = z.coerce
  .number()
  .int('ID must be an integer')
  .positive('ID must be positive');

/**
 * Positive amount (for budgets, etc.)
 */
export const positiveAmountSchema = z
  .number()
  .positive('Amount must be positive')
  .max(999999999999, 'Amount is too large');

/**
 * Amount that can be positive or negative (for transactions)
 */
export const amountSchema = z
  .number()
  .min(-999999999999, 'Amount is too small')
  .max(999999999999, 'Amount is too large');

/**
 * Name field with length limits
 */
export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`);

/**
 * Optional trimmed string with length limit
 */
export const optionalStringSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `Cannot exceed ${maxLength} characters`)
    .optional()
    .nullable();

/**
 * Color validation (hex color or named color)
 */
export const colorSchema = z
  .string()
  .trim()
  .max(MAX_COLOR_LENGTH, `Color cannot exceed ${MAX_COLOR_LENGTH} characters`)
  .regex(
    /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$/,
    'Color must be a hex code or named color'
  )
  .optional()
  .nullable();

/**
 * Emoji icon validation
 */
export const iconSchema = z
  .string()
  .max(MAX_ICON_LENGTH, `Icon cannot exceed ${MAX_ICON_LENGTH} characters`)
  .optional()
  .nullable();

/**
 * Array of IDs
 */
export const idArraySchema = z
  .array(z.coerce.number().int().positive())
  .min(1, 'At least one ID is required');

/**
 * Priority (0-100)
 */
export const prioritySchema = z
  .number()
  .int('Priority must be an integer')
  .min(0, 'Priority must be at least 0')
  .max(100, 'Priority cannot exceed 100')
  .default(0);

/**
 * Helper to format Zod errors into user-friendly format
 */
export function formatZodErrors(
  error: z.ZodError
): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}
