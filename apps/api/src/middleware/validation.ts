import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodSchema } from 'zod';
import { formatZodErrors } from '../schemas/common.js';

/**
 * Validation target options
 */
type ValidationTarget = 'body' | 'query' | 'params';

interface ValidationOptions {
  /** Which part of the request to validate (default: 'body') */
  target?: ValidationTarget;
  /** Whether to strip unknown keys (default: true for body) */
  stripUnknown?: boolean;
}

/**
 * Create validation middleware for a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param options - Validation options
 * @returns Express middleware
 *
 * @example
 * ```ts
 * router.post('/', validate(createAccountSchema), (req, res) => {
 *   // req.body is now typed and validated
 * });
 *
 * router.get('/:id', validate(idParamSchema, { target: 'params' }), ...)
 * ```
 */
export function validate<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
): RequestHandler {
  const { target = 'body', stripUnknown = target === 'body' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[target];

    // If stripUnknown is true and schema is an object schema, use strip
    const parseSchema = stripUnknown ? schema : schema;

    const result = parseSchema.safeParse(data);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: formatZodErrors(result.error),
      });
      return;
    }

    // Replace request data with validated (and potentially transformed) data
    if (target === 'body') {
      req.body = result.data;
    } else if (target === 'query') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).validatedQuery = result.data;
    } else if (target === 'params') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).validatedParams = result.data;
    }

    next();
  };
}

/**
 * Validate both body and params in a single middleware
 */
export function validateBodyAndParams<B extends ZodSchema, P extends ZodSchema>(
  bodySchema: B,
  paramsSchema: P
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Validate params first
    const paramsResult = paramsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: formatZodErrors(paramsResult.error).map((e) => ({
          ...e,
          field: `params.${e.field}`,
        })),
      });
      return;
    }

    // Validate body
    const bodyResult = bodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: formatZodErrors(bodyResult.error),
      });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).validatedParams = paramsResult.data;
    req.body = bodyResult.data;

    next();
  };
}

/**
 * Validate path params with the id param schema
 * Common helper for routes with :id parameter
 */
export function validateIdParam(): RequestHandler {
  const idSchema = z.object({
    id: z.coerce.number().int().positive(),
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    const result = idSchema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid ID parameter',
        details: formatZodErrors(result.error),
      });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).validatedParams = result.data;
    next();
  };
}

// Re-export schemas for convenience
export * from '../schemas/index.js';
