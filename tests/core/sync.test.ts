import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkClockDrift,
  isValidSyncChange,
  validateSyncChanges,
  mergeChanges,
  getChangesSince,
  createSyncableRow,
  updateSyncableRow,
  deleteSyncableRow,
  type SyncableRow,
  type SyncChange,
} from '@fluxby/core';

describe('sync.ts', () => {
  describe('checkClockDrift', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should detect no drift for current timestamp', () => {
      const now = Date.now();
      const result = checkClockDrift(now);

      expect(result.hasDrift).toBe(false);
      expect(Math.abs(result.driftMs)).toBeLessThan(1000);
    });

    it('should detect no drift for slightly future timestamp', () => {
      const nearFuture = Date.now() + 30 * 60 * 1000; // 30 minutes ahead
      const result = checkClockDrift(nearFuture);

      expect(result.hasDrift).toBe(false);
    });

    it('should detect drift for timestamp more than 1 hour ahead', () => {
      const farFuture = Date.now() + 2 * 60 * 60 * 1000; // 2 hours ahead
      const result = checkClockDrift(farFuture);

      expect(result.hasDrift).toBe(true);
      expect(result.driftMs).toBeGreaterThan(60 * 60 * 1000);
    });

    it('should not flag past timestamps as drift', () => {
      const past = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      const result = checkClockDrift(past);

      // Negative drift doesn't trigger the warning (only future drift matters)
      expect(result.hasDrift).toBe(false);
      expect(result.driftMs).toBeLessThan(0);
    });
  });

  describe('isValidSyncChange', () => {
    it('should return true for valid sync change', () => {
      const change: SyncChange = {
        table: 'transactions',
        row: {
          id: 'test-123',
          updated_at: Date.now(),
          is_deleted: false,
          device_id: 'device-1',
        },
      };

      expect(isValidSyncChange(change)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidSyncChange(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidSyncChange(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidSyncChange('string')).toBe(false);
      expect(isValidSyncChange(123)).toBe(false);
      expect(isValidSyncChange(true)).toBe(false);
    });

    it('should return false for missing table', () => {
      const change = {
        row: {
          id: 'test-123',
          updated_at: Date.now(),
          is_deleted: false,
          device_id: 'device-1',
        },
      };

      expect(isValidSyncChange(change)).toBe(false);
    });

    it('should return false for empty table', () => {
      const change = {
        table: '',
        row: {
          id: 'test-123',
          updated_at: Date.now(),
          is_deleted: false,
          device_id: 'device-1',
        },
      };

      expect(isValidSyncChange(change)).toBe(false);
    });

    it('should return false for missing row', () => {
      const change = {
        table: 'transactions',
      };

      expect(isValidSyncChange(change)).toBe(false);
    });

    it('should return false for non-object row', () => {
      const change = {
        table: 'transactions',
        row: 'not an object',
      };

      expect(isValidSyncChange(change)).toBe(false);
    });

    it('should return false for missing row.id', () => {
      const change = {
        table: 'transactions',
        row: {
          updated_at: Date.now(),
          is_deleted: false,
          device_id: 'device-1',
        },
      };

      expect(isValidSyncChange(change)).toBe(false);
    });

    it('should return false for empty row.id', () => {
      const change = {
        table: 'transactions',
        row: {
          id: '',
          updated_at: Date.now(),
          is_deleted: false,
          device_id: 'device-1',
        },
      };

      expect(isValidSyncChange(change)).toBe(false);
    });

    it('should return false for missing updated_at', () => {
      const change = {
        table: 'transactions',
        row: {
          id: 'test-123',
          is_deleted: false,
          device_id: 'device-1',
        },
      };

      expect(isValidSyncChange(change)).toBe(false);
    });

    it('should return false for non-number updated_at', () => {
      const change = {
        table: 'transactions',
        row: {
          id: 'test-123',
          updated_at: '2024-01-15',
          is_deleted: false,
          device_id: 'device-1',
        },
      };

      expect(isValidSyncChange(change)).toBe(false);
    });

    it('should return false for missing is_deleted', () => {
      const change = {
        table: 'transactions',
        row: {
          id: 'test-123',
          updated_at: Date.now(),
          device_id: 'device-1',
        },
      };

      expect(isValidSyncChange(change)).toBe(false);
    });

    it('should return false for non-boolean is_deleted', () => {
      const change = {
        table: 'transactions',
        row: {
          id: 'test-123',
          updated_at: Date.now(),
          is_deleted: 0,
          device_id: 'device-1',
        },
      };

      expect(isValidSyncChange(change)).toBe(false);
    });

    it('should return false for missing device_id', () => {
      const change = {
        table: 'transactions',
        row: {
          id: 'test-123',
          updated_at: Date.now(),
          is_deleted: false,
        },
      };

      expect(isValidSyncChange(change)).toBe(false);
    });

    it('should return false for non-string device_id', () => {
      const change = {
        table: 'transactions',
        row: {
          id: 'test-123',
          updated_at: Date.now(),
          is_deleted: false,
          device_id: 123,
        },
      };

      expect(isValidSyncChange(change)).toBe(false);
    });
  });

  describe('validateSyncChanges', () => {
    it('should return all valid changes', () => {
      const changes = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: Date.now(),
            is_deleted: false,
            device_id: 'device-1',
          },
        },
        {
          table: 'accounts',
          row: {
            id: 'acc-1',
            updated_at: Date.now(),
            is_deleted: false,
            device_id: 'device-1',
          },
        },
      ];

      const result = validateSyncChanges(changes);

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toBe(0);
    });

    it('should filter out invalid changes', () => {
      const changes = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: Date.now(),
            is_deleted: false,
            device_id: 'device-1',
          },
        },
        null,
        { table: '' },
        { table: 'broken', row: 'not-object' },
      ];

      const result = validateSyncChanges(changes as unknown[]);

      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toBe(3);
    });

    it('should handle empty array', () => {
      const result = validateSyncChanges([]);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toBe(0);
    });
  });

  describe('mergeChanges', () => {
    const localDeviceId = 'device-local';

    it('should apply new rows from remote', () => {
      const localRows = new Map<string, SyncableRow>();

      const remoteChanges: SyncChange<SyncableRow>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: 'device-remote',
          },
        },
      ];

      const result = mergeChanges(localRows, remoteChanges, localDeviceId);

      expect(result.applied).toBe(1);
      expect(result.skipped).toBe(0);
      expect(localRows.has('tx-1')).toBe(true);
    });

    it('should apply remote changes with newer timestamp', () => {
      const localRows = new Map<string, SyncableRow>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: localDeviceId,
          },
        ],
      ]);

      const remoteChanges: SyncChange<SyncableRow>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 2000,
            is_deleted: false,
            device_id: 'device-remote',
          },
        },
      ];

      const result = mergeChanges(localRows, remoteChanges, localDeviceId);

      expect(result.applied).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe('remote');
      expect(localRows.get('tx-1')?.device_id).toBe('device-remote');
    });

    it('should skip remote changes with older timestamp', () => {
      const localRows = new Map<string, SyncableRow>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: 2000,
            is_deleted: false,
            device_id: localDeviceId,
          },
        ],
      ]);

      const remoteChanges: SyncChange<SyncableRow>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: 'device-remote',
          },
        },
      ];

      const result = mergeChanges(localRows, remoteChanges, localDeviceId);

      expect(result.applied).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe('local');
      expect(localRows.get('tx-1')?.device_id).toBe(localDeviceId);
    });

    it('should use device_id as tiebreaker for same timestamp', () => {
      const localRows = new Map<string, SyncableRow>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: 'device-aaa', // Local has lower device_id
          },
        ],
      ]);

      const remoteChanges: SyncChange<SyncableRow>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: 'device-zzz', // Remote has higher device_id
          },
        },
      ];

      const result = mergeChanges(localRows, remoteChanges, 'device-aaa');

      // Remote wins because 'device-zzz' > 'device-aaa'
      expect(result.applied).toBe(1);
      expect(localRows.get('tx-1')?.device_id).toBe('device-zzz');
    });

    it('should handle multiple remote changes', () => {
      const localRows = new Map<string, SyncableRow>();

      const remoteChanges: SyncChange<SyncableRow>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: 'device-remote',
          },
        },
        {
          table: 'transactions',
          row: {
            id: 'tx-2',
            updated_at: 2000,
            is_deleted: false,
            device_id: 'device-remote',
          },
        },
      ];

      const result = mergeChanges(localRows, remoteChanges, localDeviceId);

      expect(result.applied).toBe(2);
      expect(localRows.size).toBe(2);
    });

    it('should handle soft-deleted rows', () => {
      const localRows = new Map<string, SyncableRow>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: localDeviceId,
          },
        ],
      ]);

      const remoteChanges: SyncChange<SyncableRow>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 2000,
            is_deleted: true,
            device_id: 'device-remote',
          },
        },
      ];

      const result = mergeChanges(localRows, remoteChanges, localDeviceId);

      expect(result.applied).toBe(1);
      expect(localRows.get('tx-1')?.is_deleted).toBe(true);
    });
  });

  describe('getChangesSince', () => {
    it('should return changes after the given timestamp', () => {
      const rows = new Map<string, SyncableRow>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: 'device-1',
          },
        ],
        [
          'tx-2',
          {
            id: 'tx-2',
            updated_at: 2000,
            is_deleted: false,
            device_id: 'device-1',
          },
        ],
        [
          'tx-3',
          {
            id: 'tx-3',
            updated_at: 3000,
            is_deleted: false,
            device_id: 'device-1',
          },
        ],
      ]);

      const changes = getChangesSince(rows, 1500, 'transactions');

      expect(changes).toHaveLength(2);
      expect(changes.map((c) => c.row.id)).toEqual(
        expect.arrayContaining(['tx-2', 'tx-3'])
      );
    });

    it('should return empty array if no changes since timestamp', () => {
      const rows = new Map<string, SyncableRow>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: 'device-1',
          },
        ],
      ]);

      const changes = getChangesSince(rows, 2000, 'transactions');

      expect(changes).toHaveLength(0);
    });

    it('should include the correct table name', () => {
      const rows = new Map<string, SyncableRow>([
        [
          'acc-1',
          {
            id: 'acc-1',
            updated_at: 2000,
            is_deleted: false,
            device_id: 'device-1',
          },
        ],
      ]);

      const changes = getChangesSince(rows, 1000, 'accounts');

      expect(changes[0].table).toBe('accounts');
    });
  });

  describe('createSyncableRow', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should add sync metadata to data', () => {
      const data = { name: 'Test Item', amount: 100 };
      const deviceId = 'device-123';

      const row = createSyncableRow(data, deviceId);

      expect(row.name).toBe('Test Item');
      expect(row.amount).toBe(100);
      expect(row.id).toBeDefined();
      expect(row.updated_at).toBe(Date.now());
      expect(row.is_deleted).toBe(false);
      expect(row.device_id).toBe(deviceId);
    });

    it('should generate unique UUIDs', () => {
      const data = { name: 'Test' };
      const row1 = createSyncableRow(data, 'device-1');
      const row2 = createSyncableRow(data, 'device-1');

      expect(row1.id).not.toBe(row2.id);
    });
  });

  describe('updateSyncableRow', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should update row with new values and timestamp', () => {
      const original: SyncableRow & { name: string } = {
        id: 'row-1',
        updated_at: 1000,
        is_deleted: false,
        device_id: 'device-old',
        name: 'Original',
      };

      const updated = updateSyncableRow(
        original,
        { name: 'Updated' },
        'device-new'
      );

      expect(updated.id).toBe('row-1');
      expect(updated.name).toBe('Updated');
      expect(updated.updated_at).toBe(Date.now());
      expect(updated.device_id).toBe('device-new');
      expect(updated.is_deleted).toBe(false);
    });

    it('should preserve unupdated fields', () => {
      const original: SyncableRow & { name: string; amount: number } = {
        id: 'row-1',
        updated_at: 1000,
        is_deleted: false,
        device_id: 'device-1',
        name: 'Test',
        amount: 100,
      };

      const updated = updateSyncableRow(
        original,
        { name: 'New Name' },
        'device-2'
      );

      expect(updated.amount).toBe(100);
    });
  });

  describe('deleteSyncableRow', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should mark row as deleted', () => {
      const original: SyncableRow = {
        id: 'row-1',
        updated_at: 1000,
        is_deleted: false,
        device_id: 'device-1',
      };

      const deleted = deleteSyncableRow(original, 'device-2');

      expect(deleted.id).toBe('row-1');
      expect(deleted.is_deleted).toBe(true);
      expect(deleted.updated_at).toBe(Date.now());
      expect(deleted.device_id).toBe('device-2');
    });

    it('should preserve other fields', () => {
      const original: SyncableRow & { name: string } = {
        id: 'row-1',
        updated_at: 1000,
        is_deleted: false,
        device_id: 'device-1',
        name: 'Test',
      };

      const deleted = deleteSyncableRow(original, 'device-2');

      expect(deleted.name).toBe('Test');
    });
  });

  describe('LWW Conflict Resolution Edge Cases', () => {
    const localDeviceId = 'device-local';

    it('should handle concurrent edits within 1ms timestamp precision', () => {
      // Both devices edit at exactly the same timestamp
      const localRows = new Map<string, SyncableRow>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: 1705323600000, // Exact timestamp
            is_deleted: false,
            device_id: localDeviceId,
          },
        ],
      ]);

      const remoteChanges: SyncChange<SyncableRow>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 1705323600000, // Exact same timestamp
            is_deleted: false,
            device_id: 'device-remote',
          },
        },
      ];

      const result = mergeChanges(localRows, remoteChanges, localDeviceId);

      // Same timestamp uses device_id as tiebreaker - not recorded as conflict
      // 'device-remote' > 'device-local', so remote wins
      expect(result.applied).toBe(1);
      expect(result.skipped).toBe(0);
      expect(localRows.get('tx-1')?.device_id).toBe('device-remote');
    });

    it('should handle edit-delete conflict (delete wins if newer)', () => {
      const localRows = new Map<string, SyncableRow>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: localDeviceId,
          },
        ],
      ]);

      // Remote deletes after local edit
      const remoteChanges: SyncChange<SyncableRow>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 2000, // Newer
            is_deleted: true, // Deleted
            device_id: 'device-remote',
          },
        },
      ];

      const result = mergeChanges(localRows, remoteChanges, localDeviceId);

      expect(result.applied).toBe(1);
      expect(localRows.get('tx-1')?.is_deleted).toBe(true);
    });

    it('should handle resurrection conflict (un-delete wins if newer)', () => {
      // Local has deleted row
      const localRows = new Map<string, SyncableRow>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: true,
            device_id: localDeviceId,
          },
        ],
      ]);

      // Remote un-deletes (edits after delete)
      const remoteChanges: SyncChange<SyncableRow>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 2000, // Newer edit after delete
            is_deleted: false, // Resurrected
            device_id: 'device-remote',
          },
        },
      ];

      const result = mergeChanges(localRows, remoteChanges, localDeviceId);

      expect(result.applied).toBe(1);
      expect(localRows.get('tx-1')?.is_deleted).toBe(false);
    });

    it('should handle multiple conflicting changes to same row', () => {
      const localRows = new Map<string, SyncableRow>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: localDeviceId,
          },
        ],
      ]);

      // Multiple remote changes for same row (e.g., replayed from different devices)
      const remoteChanges: SyncChange<SyncableRow>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 1500,
            is_deleted: false,
            device_id: 'device-A',
          },
        },
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 2000, // This one should win
            is_deleted: false,
            device_id: 'device-B',
          },
        },
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 1800,
            is_deleted: false,
            device_id: 'device-C',
          },
        },
      ];

      const _result = mergeChanges(localRows, remoteChanges, localDeviceId);

      // device-B's change (at 2000) should win
      expect(localRows.get('tx-1')?.device_id).toBe('device-B');
    });

    it('should handle clock drift with future timestamps', () => {
      const now = Date.now();
      const futureTime = now + 24 * 60 * 60 * 1000; // 1 day in future

      const localRows = new Map<string, SyncableRow>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: now,
            is_deleted: false,
            device_id: localDeviceId,
          },
        ],
      ]);

      // Remote has clock drift - timestamp in future
      const remoteChanges: SyncChange<SyncableRow>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: futureTime,
            is_deleted: false,
            device_id: 'device-drifted',
          },
        },
      ];

      const result = mergeChanges(localRows, remoteChanges, localDeviceId);

      // Future timestamp wins (LWW doesn't prevent clock drift)
      expect(result.applied).toBe(1);
      expect(localRows.get('tx-1')?.device_id).toBe('device-drifted');
    });

    it('should preserve all fields when merging conflict winner', () => {
      const localRows = new Map<string, SyncableRow & { amount: number }>([
        [
          'tx-1',
          {
            id: 'tx-1',
            updated_at: 1000,
            is_deleted: false,
            device_id: localDeviceId,
            amount: 100,
          },
        ],
      ]);

      const remoteChanges: SyncChange<SyncableRow & { amount: number }>[] = [
        {
          table: 'transactions',
          row: {
            id: 'tx-1',
            updated_at: 2000,
            is_deleted: false,
            device_id: 'device-remote',
            amount: 200, // Different amount
          },
        },
      ];

      const result = mergeChanges(
        localRows as Map<string, SyncableRow>,
        remoteChanges as SyncChange<SyncableRow>[],
        localDeviceId
      );

      expect(result.applied).toBe(1);
      expect((localRows.get('tx-1') as { amount: number }).amount).toBe(200);
    });
  });
});
