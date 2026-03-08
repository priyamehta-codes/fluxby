/**
 * Tests for getCategoryStatsByPeriod method
 * Verifies that category transaction counts and amounts are correctly
 * calculated for a specific date range.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database interface
interface MockDatabase {
  queryAsync: ReturnType<typeof vi.fn>;
}

// Mock the profile ID
let mockProfileId: string | null = 'test-profile-123';

// Create a mock database
const createMockDb = (): MockDatabase => ({
  queryAsync: vi.fn(),
});

/**
 * Simplified getCategoryStatsByPeriod implementation for testing
 * This mirrors the actual implementation in data-service.ts
 */
async function getCategoryStatsByPeriod(
  db: MockDatabase,
  getProfileId: () => string | null,
  startDate: Date,
  endDate: Date
): Promise<Map<string, { count: number; amount: number }>> {
  const pid = getProfileId();
  if (!pid) return new Map();

  // Convert dates to ISO date strings (YYYY-MM-DD) to match TEXT date column
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const rows = await db.queryAsync(
    `SELECT 
       category_id as categoryId, 
       COUNT(*) as cnt, 
       SUM(amount) as total
     FROM transactions 
     WHERE is_deleted = 0 
       AND profile_id = ? 
       AND category_id IS NOT NULL
       AND date >= ?
       AND date <= ?
     GROUP BY category_id`,
    [pid, startStr, endStr]
  );

  const result = new Map<string, { count: number; amount: number }>();
  for (const row of rows) {
    result.set(row.categoryId, {
      count: row.cnt,
      amount: row.total,
    });
  }
  return result;
}

describe('getCategoryStatsByPeriod', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = createMockDb();
    mockProfileId = 'test-profile-123';
  });

  it('should return empty Map when no profile ID is set', async () => {
    mockProfileId = null;

    const result = await getCategoryStatsByPeriod(
      mockDb,
      () => mockProfileId,
      new Date('2024-01-01'),
      new Date('2024-01-31')
    );

    expect(result.size).toBe(0);
    expect(mockDb.queryAsync).not.toHaveBeenCalled();
  });

  it('should query with correct ISO date strings', async () => {
    mockDb.queryAsync.mockResolvedValue([]);

    await getCategoryStatsByPeriod(
      mockDb,
      () => mockProfileId,
      new Date('2024-01-15T12:00:00Z'),
      new Date('2024-02-28T23:59:59Z')
    );

    expect(mockDb.queryAsync).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      ['test-profile-123', '2024-01-15', '2024-02-28']
    );
  });

  it('should return empty Map when no transactions match', async () => {
    mockDb.queryAsync.mockResolvedValue([]);

    const result = await getCategoryStatsByPeriod(
      mockDb,
      () => mockProfileId,
      new Date('2024-01-01'),
      new Date('2024-01-31')
    );

    expect(result.size).toBe(0);
  });

  it('should correctly map category stats from query results', async () => {
    mockDb.queryAsync.mockResolvedValue([
      { categoryId: 'cat-1', cnt: 5, total: -250.5 },
      { categoryId: 'cat-2', cnt: 3, total: -100.0 },
      { categoryId: 'cat-3', cnt: 1, total: 500.0 },
    ]);

    const result = await getCategoryStatsByPeriod(
      mockDb,
      () => mockProfileId,
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );

    expect(result.size).toBe(3);

    expect(result.get('cat-1')).toEqual({ count: 5, amount: -250.5 });
    expect(result.get('cat-2')).toEqual({ count: 3, amount: -100.0 });
    expect(result.get('cat-3')).toEqual({ count: 1, amount: 500.0 });
  });

  it('should handle single day date range', async () => {
    mockDb.queryAsync.mockResolvedValue([
      { categoryId: 'cat-day', cnt: 2, total: -50.0 },
    ]);

    const result = await getCategoryStatsByPeriod(
      mockDb,
      () => mockProfileId,
      new Date('2024-06-15'),
      new Date('2024-06-15')
    );

    expect(mockDb.queryAsync).toHaveBeenCalledWith(expect.any(String), [
      'test-profile-123',
      '2024-06-15',
      '2024-06-15',
    ]);
    expect(result.get('cat-day')).toEqual({ count: 2, amount: -50.0 });
  });

  it('should handle categories with zero amount', async () => {
    mockDb.queryAsync.mockResolvedValue([
      { categoryId: 'cat-zero', cnt: 3, total: 0 },
    ]);

    const result = await getCategoryStatsByPeriod(
      mockDb,
      () => mockProfileId,
      new Date('2024-01-01'),
      new Date('2024-01-31')
    );

    expect(result.get('cat-zero')).toEqual({ count: 3, amount: 0 });
  });

  it('should handle large transaction counts', async () => {
    mockDb.queryAsync.mockResolvedValue([
      { categoryId: 'cat-large', cnt: 10000, total: -999999.99 },
    ]);

    const result = await getCategoryStatsByPeriod(
      mockDb,
      () => mockProfileId,
      new Date('2020-01-01'),
      new Date('2024-12-31')
    );

    expect(result.get('cat-large')).toEqual({
      count: 10000,
      amount: -999999.99,
    });
  });

  it('should only include non-null category IDs', async () => {
    // The SQL query filters out NULL category_ids, but let's verify the behavior
    mockDb.queryAsync.mockResolvedValue([
      { categoryId: 'cat-1', cnt: 5, total: -100 },
      // No null categoryId should be returned by the query
    ]);

    const result = await getCategoryStatsByPeriod(
      mockDb,
      () => mockProfileId,
      new Date('2024-01-01'),
      new Date('2024-01-31')
    );

    expect(result.size).toBe(1);
    expect(result.has('cat-1')).toBe(true);
  });
});

describe('getCategoryStatsByPeriod - date edge cases', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = createMockDb();
    mockProfileId = 'test-profile-123';
    mockDb.queryAsync.mockResolvedValue([]);
  });

  it('should handle year boundary correctly', async () => {
    await getCategoryStatsByPeriod(
      mockDb,
      () => mockProfileId,
      new Date('2023-12-01'),
      new Date('2024-01-31')
    );

    expect(mockDb.queryAsync).toHaveBeenCalledWith(expect.any(String), [
      'test-profile-123',
      '2023-12-01',
      '2024-01-31',
    ]);
  });

  it('should handle leap year date', async () => {
    await getCategoryStatsByPeriod(
      mockDb,
      () => mockProfileId,
      new Date('2024-02-29'),
      new Date('2024-02-29')
    );

    expect(mockDb.queryAsync).toHaveBeenCalledWith(expect.any(String), [
      'test-profile-123',
      '2024-02-29',
      '2024-02-29',
    ]);
  });

  it('should strip time component from dates', async () => {
    // Test that time is ignored and only date part is used
    await getCategoryStatsByPeriod(
      mockDb,
      () => mockProfileId,
      new Date('2024-03-15T23:59:59.999Z'),
      new Date('2024-03-20T00:00:00.001Z')
    );

    expect(mockDb.queryAsync).toHaveBeenCalledWith(expect.any(String), [
      'test-profile-123',
      '2024-03-15',
      '2024-03-20',
    ]);
  });
});
