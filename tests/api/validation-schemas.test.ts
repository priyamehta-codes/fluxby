import { describe, it, expect } from 'vitest';
import {
  createAccountSchema,
  updateAccountSchema,
  updateAccountOrderSchema,
  createBudgetSchema,
  updateBudgetSchema,
  createCategorySchema,
  updateCategorySchema,
  createCategoryRuleSchema,
  createTransactionSchema,
  updateTransactionSchema,
  createAddressBookEntrySchema,
  updateAddressBookEntrySchema,
  mergeContactsSchema,
  splitContactSchema,
  columnMappingSchema,
  ibanSchema,
  dateSchema,
  positiveAmountSchema,
  formatZodErrors,
} from '../../apps/api/src/schemas/index.js';

describe('Common Schemas', () => {
  describe('ibanSchema', () => {
    it('accepts valid IBANs', () => {
      const result = ibanSchema.safeParse('NL91ABNA0417164300');
      expect(result.success).toBe(true);
      expect(result.data).toBe('NL91ABNA0417164300');
    });

    it('normalizes IBAN to uppercase', () => {
      const result = ibanSchema.safeParse('nl91abna0417164300');
      expect(result.success).toBe(true);
      expect(result.data).toBe('NL91ABNA0417164300');
    });

    it('trims whitespace', () => {
      const result = ibanSchema.safeParse('  NL91ABNA0417164300  ');
      expect(result.success).toBe(true);
      expect(result.data).toBe('NL91ABNA0417164300');
    });

    it('rejects IBANs that are too short', () => {
      const result = ibanSchema.safeParse('NL91ABNA');
      expect(result.success).toBe(false);
    });

    it('rejects IBANs that are too long', () => {
      const result = ibanSchema.safeParse(
        'NL91ABNA0417164300123456789012345678901234567890'
      );
      expect(result.success).toBe(false);
    });

    it('rejects IBANs with invalid format', () => {
      const result = ibanSchema.safeParse('12345678901234567890');
      expect(result.success).toBe(false);
    });
  });

  describe('dateSchema', () => {
    it('accepts valid ISO date', () => {
      const result = dateSchema.safeParse('2024-03-14');
      expect(result.success).toBe(true);
    });

    it('rejects invalid date format', () => {
      const result = dateSchema.safeParse('14/03/2024');
      expect(result.success).toBe(false);
    });

    it('rejects invalid date values', () => {
      const result = dateSchema.safeParse('2024-13-45');
      expect(result.success).toBe(false);
    });
  });

  describe('positiveAmountSchema', () => {
    it('accepts positive numbers', () => {
      const result = positiveAmountSchema.safeParse(100.5);
      expect(result.success).toBe(true);
    });

    it('rejects zero', () => {
      const result = positiveAmountSchema.safeParse(0);
      expect(result.success).toBe(false);
    });

    it('rejects negative numbers', () => {
      const result = positiveAmountSchema.safeParse(-50);
      expect(result.success).toBe(false);
    });

    it('rejects absurdly large amounts', () => {
      const result = positiveAmountSchema.safeParse(999999999999999);
      expect(result.success).toBe(false);
    });
  });

  describe('formatZodErrors', () => {
    it('formats errors into field-level messages', () => {
      const result = createAccountSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              message: expect.any(String),
            }),
          ])
        );
      }
    });
  });
});

describe('Account Schemas', () => {
  describe('createAccountSchema', () => {
    it('accepts valid input', () => {
      const result = createAccountSchema.safeParse({
        iban: 'NL91ABNA0417164300',
        name: 'My Account',
        type: 'checking',
      });
      expect(result.success).toBe(true);
    });

    it('defaults type to checking', () => {
      const result = createAccountSchema.safeParse({
        iban: 'NL91ABNA0417164300',
        name: 'My Account',
      });
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('checking');
    });

    it('rejects missing iban', () => {
      const result = createAccountSchema.safeParse({
        name: 'My Account',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing name', () => {
      const result = createAccountSchema.safeParse({
        iban: 'NL91ABNA0417164300',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid type', () => {
      const result = createAccountSchema.safeParse({
        iban: 'NL91ABNA0417164300',
        name: 'My Account',
        type: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects names that are too long', () => {
      const result = createAccountSchema.safeParse({
        iban: 'NL91ABNA0417164300',
        name: 'a'.repeat(250),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateAccountSchema', () => {
    it('accepts partial updates', () => {
      const result = updateAccountSchema.safeParse({
        name: 'New Name',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty updates', () => {
      const result = updateAccountSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('updateAccountOrderSchema', () => {
    it('accepts array of IDs', () => {
      const result = updateAccountOrderSchema.safeParse({
        accountIds: [1, 2, 3],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty array', () => {
      const result = updateAccountOrderSchema.safeParse({
        accountIds: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric IDs', () => {
      const result = updateAccountOrderSchema.safeParse({
        accountIds: ['abc', 'def'],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Budget Schemas', () => {
  describe('createBudgetSchema', () => {
    it('accepts valid input', () => {
      const result = createBudgetSchema.safeParse({
        amount: 500,
        period: 'monthly',
        categoryId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('defaults period to monthly', () => {
      const result = createBudgetSchema.safeParse({
        amount: 500,
      });
      expect(result.success).toBe(true);
      expect(result.data?.period).toBe('monthly');
    });

    it('rejects negative amount', () => {
      const result = createBudgetSchema.safeParse({
        amount: -100,
      });
      expect(result.success).toBe(false);
    });

    it('validates date range', () => {
      const result = createBudgetSchema.safeParse({
        amount: 500,
        startDate: '2024-12-01',
        endDate: '2024-01-01', // End before start
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid date range', () => {
      const result = createBudgetSchema.safeParse({
        amount: 500,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateBudgetSchema', () => {
    it('accepts partial updates', () => {
      const result = updateBudgetSchema.safeParse({
        amount: 750,
      });
      expect(result.success).toBe(true);
    });

    it('validates period enum', () => {
      const result = updateBudgetSchema.safeParse({
        period: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid period values', () => {
      const result = updateBudgetSchema.safeParse({
        period: 'yearly',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Category Schemas', () => {
  describe('createCategorySchema', () => {
    it('accepts valid input', () => {
      const result = createCategorySchema.safeParse({
        name: 'Groceries',
        icon: '🛒',
        color: '#ff0000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing name', () => {
      const result = createCategorySchema.safeParse({
        icon: '🛒',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateCategorySchema', () => {
    it('accepts partial updates', () => {
      const result = updateCategorySchema.safeParse({
        name: 'Food & Dining',
      });
      expect(result.success).toBe(true);
    });

    it('accepts color updates', () => {
      const result = updateCategorySchema.safeParse({
        color: '#00ff00',
      });
      expect(result.success).toBe(true);
    });

    it('accepts icon updates', () => {
      const result = updateCategorySchema.safeParse({
        icon: '🍕',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createCategoryRuleSchema', () => {
    it('accepts valid input', () => {
      const result = createCategoryRuleSchema.safeParse({
        pattern: 'albert heijn',
        categoryId: 5,
        priority: 10,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing pattern', () => {
      const result = createCategoryRuleSchema.safeParse({
        categoryId: 5,
      });
      expect(result.success).toBe(false);
    });

    it('defaults priority to 0', () => {
      const result = createCategoryRuleSchema.safeParse({
        pattern: 'test',
        categoryId: 5,
      });
      expect(result.success).toBe(true);
      expect(result.data?.priority).toBe(0);
    });

    it('accepts long patterns within limits', () => {
      const result = createCategoryRuleSchema.safeParse({
        pattern: 'a'.repeat(100),
        categoryId: 5,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Transaction Schemas', () => {
  describe('createTransactionSchema', () => {
    it('accepts valid input', () => {
      const result = createTransactionSchema.safeParse({
        date: '2024-03-14',
        amount: -50.0,
        type: 'expense',
        accountId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('accepts negative amounts', () => {
      const result = createTransactionSchema.safeParse({
        date: '2024-03-14',
        amount: -1000,
        type: 'expense',
        accountId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing required fields', () => {
      const result = createTransactionSchema.safeParse({
        amount: 100,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid type', () => {
      const result = createTransactionSchema.safeParse({
        date: '2024-03-14',
        amount: 100,
        type: 'invalid',
        accountId: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateTransactionSchema', () => {
    it('accepts valid updates', () => {
      const result = updateTransactionSchema.safeParse({
        type: 'transfer',
        notes: 'Internal transfer',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty updates', () => {
      const result = updateTransactionSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

describe('AddressBook Schemas', () => {
  describe('createAddressBookEntrySchema', () => {
    it('accepts valid input', () => {
      const result = createAddressBookEntrySchema.safeParse({
        iban: 'NL91ABNA0417164300',
        name: 'John Doe',
        description: 'Friend',
      });
      expect(result.success).toBe(true);
    });

    it('normalizes IBAN', () => {
      const result = createAddressBookEntrySchema.safeParse({
        iban: '  nl91abna0417164300  ',
        name: 'John Doe',
      });
      expect(result.success).toBe(true);
      expect(result.data?.iban).toBe('NL91ABNA0417164300');
    });
  });

  describe('updateAddressBookEntrySchema', () => {
    it('accepts partial updates', () => {
      const result = updateAddressBookEntrySchema.safeParse({
        name: 'Jane Doe',
      });
      expect(result.success).toBe(true);
    });

    it('normalizes IBANs array in updates', () => {
      const result = updateAddressBookEntrySchema.safeParse({
        ibans: ['nl91abna0417164300'],
      });
      expect(result.success).toBe(true);
      expect(result.data?.ibans?.[0]).toBe('NL91ABNA0417164300');
    });
  });

  describe('mergeContactsSchema', () => {
    it('accepts valid input', () => {
      const result = mergeContactsSchema.safeParse({
        sourceIds: [1, 2, 3],
        targetId: 4,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty sourceIds', () => {
      const result = mergeContactsSchema.safeParse({
        sourceIds: [],
        targetId: 4,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('splitContactSchema', () => {
    it('accepts valid input', () => {
      const result = splitContactSchema.safeParse({
        contactId: 1,
        splitIbans: ['NL91ABNA0417164300'],
      });
      expect(result.success).toBe(true);
    });

    it('normalizes IBANs in array', () => {
      const result = splitContactSchema.safeParse({
        contactId: 1,
        splitIbans: ['nl91abna0417164300'],
      });
      expect(result.success).toBe(true);
      expect(result.data?.splitIbans[0]).toBe('NL91ABNA0417164300');
    });
  });
});

describe('Import Schemas', () => {
  describe('columnMappingSchema', () => {
    it('accepts valid mapping', () => {
      const result = columnMappingSchema.safeParse({
        date: 'Date',
        amount: 'Amount',
        description: 'Description',
        opposingIban: 'Counterparty IBAN',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing required columns', () => {
      const result = columnMappingSchema.safeParse({
        date: 'Date',
        // Missing amount and description
      });
      expect(result.success).toBe(false);
    });
  });
});
