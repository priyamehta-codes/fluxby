import { describe, it, expect } from 'vitest';
import {
  isRegexSafe,
  safeRegexReplace,
  escapeRegex,
} from '../../apps/api/src/utils/regex-safety.js';

describe('Regex Safety Utilities', () => {
  describe('isRegexSafe', () => {
    it('allows simple patterns', () => {
      expect(isRegexSafe('hello world')).toBe(true);
      expect(isRegexSafe('hello.*world')).toBe(true);
      expect(isRegexSafe('[a-z]+')).toBe(true);
      expect(isRegexSafe('^start')).toBe(true);
      expect(isRegexSafe('end$')).toBe(true);
    });

    it('blocks nested quantifiers (ReDoS)', () => {
      expect(isRegexSafe('(a+)+')).toBe(false);
      expect(isRegexSafe('(a*)*')).toBe(false);
      expect(isRegexSafe('(a+)*')).toBe(false);
      expect(isRegexSafe('(a{2,})*')).toBe(false);
    });

    it('blocks backreferences', () => {
      expect(isRegexSafe('(.*)\\1')).toBe(false);
      expect(isRegexSafe('(a)b\\1')).toBe(false);
    });

    it('blocks patterns that are too long', () => {
      const longPattern = 'a'.repeat(201);
      expect(isRegexSafe(longPattern)).toBe(false);
      const okPattern = 'a'.repeat(200);
      expect(isRegexSafe(okPattern)).toBe(true);
    });

    it('allows patterns with single quantifiers', () => {
      expect(isRegexSafe('a+')).toBe(true);
      expect(isRegexSafe('a*')).toBe(true);
      expect(isRegexSafe('a?')).toBe(true);
      expect(isRegexSafe('a{2,5}')).toBe(true);
    });
  });

  describe('safeRegexReplace', () => {
    it('performs safe replacements', () => {
      expect(safeRegexReplace('hello world', 'world', 'g', 'universe')).toBe(
        'hello universe'
      );
      expect(safeRegexReplace('HELLO', 'hello', 'i', 'hi')).toBe('hi');
    });

    it('returns original input for unsafe patterns', () => {
      const input = 'test string';
      expect(safeRegexReplace(input, '(a+)+', 'g', '')).toBe(input);
      expect(safeRegexReplace(input, '(.*)\\1', 'g', '')).toBe(input);
    });

    it('returns original input for very long inputs', () => {
      const longInput = 'a'.repeat(1001);
      expect(safeRegexReplace(longInput, 'a', 'g', 'b')).toBe(longInput);
    });

    it('sanitizes flags to only allow safe ones', () => {
      // Safe flags should work
      expect(safeRegexReplace('HELLO', 'hello', 'gi', 'hi')).toBe('hi');
      // Unsafe flags (like 'd') should be stripped
      expect(safeRegexReplace('hello', 'hello', 'gid', 'hi')).toBe('hi');
    });

    it('handles invalid regex gracefully', () => {
      // Unbalanced parentheses - should return original
      expect(safeRegexReplace('test', '(', 'g', '')).toBe('test');
    });
  });

  describe('escapeRegex', () => {
    it('escapes special regex characters', () => {
      expect(escapeRegex('hello.world')).toBe('hello\\.world');
      expect(escapeRegex('a+b*c?')).toBe('a\\+b\\*c\\?');
      expect(escapeRegex('[abc]')).toBe('\\[abc\\]');
      expect(escapeRegex('^$')).toBe('\\^\\$');
      expect(escapeRegex('a|b')).toBe('a\\|b');
      expect(escapeRegex('(a)')).toBe('\\(a\\)');
      expect(escapeRegex('{1,2}')).toBe('\\{1,2\\}');
      expect(escapeRegex('a\\b')).toBe('a\\\\b');
    });

    it('leaves regular characters unchanged', () => {
      expect(escapeRegex('hello world')).toBe('hello world');
      expect(escapeRegex('abc123')).toBe('abc123');
    });

    it('works with empty string', () => {
      expect(escapeRegex('')).toBe('');
    });
  });
});
