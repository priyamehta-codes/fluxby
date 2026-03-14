/**
 * Regex Safety Utilities
 *
 * Functions to prevent ReDoS (Regular Expression Denial of Service) attacks
 * by validating regex patterns before execution.
 */

/**
 * Maximum allowed length for regex patterns
 */
const MAX_PATTERN_LENGTH = 200;

/**
 * Patterns known to cause ReDoS vulnerabilities
 */
const DANGEROUS_PATTERNS = [
  // Nested quantifiers: (a+)+, (a*)+, (a+)*, (a{2,})+, etc.
  /\([^)]*[+*]\)\s*[+*]/, // Group with quantifier followed by quantifier
  /\([^)]*[+*]\)\s*\{[0-9]+,\}/, // Group with quantifier followed by {n,}
  /\([^)]*\{[0-9]+,\}\)\s*[+*]/, // Group with {n,} followed by quantifier
  /\([^)]*\{[0-9]+,\}\)\s*\{[0-9]+,\}/, // Group with {n,} followed by {n,}
  /\(\?[^)]*\(/, // Nested groups with modifiers
  /\\1/, // Backreferences can be dangerous
];

/**
 * Validate a regex pattern for safety (prevent ReDoS attacks)
 *
 * @param pattern - The regex pattern to validate
 * @returns true if the pattern is safe, false if potentially dangerous
 *
 * @example
 * ```ts
 * isRegexSafe('hello.*world'); // true
 * isRegexSafe('(a+)+'); // false - nested quantifiers
 * isRegexSafe('(.*)\\1'); // false - backreference
 * ```
 */
export function isRegexSafe(pattern: string): boolean {
  // Reject patterns that are too long
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return false;
  }

  // Check against known dangerous patterns
  for (const dangerous of DANGEROUS_PATTERNS) {
    if (dangerous.test(pattern)) {
      return false;
    }
  }

  return true;
}

/**
 * Safely execute a regex replacement with validation
 *
 * @param input - The string to apply the regex to
 * @param pattern - The regex pattern
 * @param flags - Regex flags (only safe flags are allowed: g, i, m, s, u, y)
 * @param replacement - The replacement string (default: empty string)
 * @returns The result of the replacement, or the original input if pattern is unsafe
 *
 * @example
 * ```ts
 * safeRegexReplace('Hello World', 'world', 'i', 'Universe');
 * // Returns: 'Hello Universe'
 *
 * safeRegexReplace('test', '(a+)+', 'g', ''); // Unsafe pattern
 * // Returns: 'test' (original unchanged)
 * ```
 */
export function safeRegexReplace(
  input: string,
  pattern: string,
  flags: string,
  replacement: string = ''
): string {
  // Validate flags - only allow safe flags
  const safeFlags = flags.replace(/[^gimsuy]/g, '') || 'gi';

  // Validate pattern safety
  if (!isRegexSafe(pattern)) {
    console.warn(`Unsafe regex pattern blocked: ${pattern}`);
    return input;
  }

  // Limit input length for regex operations to prevent CPU exhaustion
  if (input.length > 1000) {
    return input;
  }

  try {
    const regex = new RegExp(pattern, safeFlags);
    return input.replace(regex, replacement);
  } catch (error) {
    // If regex fails to compile, return original input
    if (process.env.NODE_ENV === 'development') {
      console.error('Regex error:', error);
    }
    return input;
  }
}

/**
 * Escape special regex characters in a string for literal matching
 *
 * @param str - The string to escape
 * @returns The escaped string safe for use in a RegExp
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
