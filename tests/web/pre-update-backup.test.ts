/**
 * Tests for pre-update backup helper
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeBackupFilename } from '@/lib/pre-update-backup';

// --- Unit tests for makeBackupFilename (pure, no Tauri deps) ---

describe('pre-update-backup', () => {
  describe('makeBackupFilename', () => {
    it('should produce a .db filename with ISO-like timestamp', () => {
      const name = makeBackupFilename();
      expect(name).toMatch(/^pre-update-backup-\d{4}-\d{2}-\d{2}T.+\.db$/);
    });

    it('should not contain colons or dots in the timestamp part', () => {
      const name = makeBackupFilename();
      // Remove the known prefix and suffix to isolate the timestamp
      const ts = name.replace('pre-update-backup-', '').replace('.db', '');
      expect(ts).not.toContain(':');
      expect(ts).not.toContain('.');
    });

    it('should generate unique filenames on successive calls', () => {
      // Force different timestamps by advancing the clock
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-01T10:00:00.000Z'));
      const name1 = makeBackupFilename();
      vi.setSystemTime(new Date('2025-06-01T10:00:01.000Z'));
      const name2 = makeBackupFilename();
      vi.useRealTimers();
      expect(name1).not.toBe(name2);
    });

    it('should sort chronologically when sorted alphabetically', () => {
      vi.useFakeTimers();
      const names: string[] = [];
      for (let i = 0; i < 5; i++) {
        vi.setSystemTime(new Date(`2025-06-0${i + 1}T12:00:00.000Z`));
        names.push(makeBackupFilename());
      }
      vi.useRealTimers();

      const sorted = [...names].sort();
      expect(sorted).toEqual(names);
    });
  });

  // --- Integration-style tests with mocked Tauri FS APIs ---

  describe('createPreUpdateBackup', () => {
    const mockFs = {
      exists: vi.fn(),
      readFile: vi.fn(),
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readDir: vi.fn(),
      remove: vi.fn(),
    };
    const mockPath = {
      appLocalDataDir: vi.fn(),
      join: vi.fn(),
    };

    beforeEach(() => {
      vi.resetModules();
      vi.resetAllMocks();

      // Default happy-path mocks
      mockPath.appLocalDataDir.mockResolvedValue('/app');
      mockPath.join.mockImplementation((...args: string[]) =>
        Promise.resolve(args.join('/'))
      );
      mockFs.exists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
      mockFs.readDir.mockResolvedValue([]);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.remove.mockResolvedValue(undefined);

      // Mock the Tauri dynamic imports
      vi.doMock('@tauri-apps/plugin-fs', () => mockFs);
      vi.doMock('@tauri-apps/api/path', () => mockPath);
    });

    it('should succeed and write backup bytes', async () => {
      const { createPreUpdateBackup } = await import('@/lib/pre-update-backup');

      const result = await createPreUpdateBackup();
      expect(result.success).toBe(true);
      expect(result.path).toBeDefined();
      expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
      // writeFile should receive the same bytes that readFile returned
      const writtenBytes = mockFs.writeFile.mock.calls[0][1];
      expect(writtenBytes).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('should skip backup if database does not exist', async () => {
      mockFs.exists.mockImplementation((p: string) =>
        Promise.resolve(!p.includes('fluxby.db'))
      );

      const { createPreUpdateBackup } = await import('@/lib/pre-update-backup');

      const result = await createPreUpdateBackup();
      expect(result.success).toBe(true);
      expect(result.path).toBeUndefined();
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should create backup directory if it does not exist', async () => {
      mockFs.exists.mockImplementation((p: string) =>
        Promise.resolve(!p.includes('pre-update-backups'))
      );

      const { createPreUpdateBackup } = await import('@/lib/pre-update-backup');

      await createPreUpdateBackup();
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('pre-update-backups'),
        { recursive: true }
      );
    });

    it('should return failure on writeFile error', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('disk full'));

      const { createPreUpdateBackup } = await import('@/lib/pre-update-backup');

      const result = await createPreUpdateBackup();
      expect(result.success).toBe(false);
      expect(result.error).toBe('disk full');
    });

    describe('retention (pruning)', () => {
      it('should delete oldest backups when more than 3 exist', async () => {
        mockFs.readDir.mockResolvedValue([
          { name: 'pre-update-backup-2025-01-01T00-00-00-000Z.db' },
          { name: 'pre-update-backup-2025-02-01T00-00-00-000Z.db' },
          { name: 'pre-update-backup-2025-03-01T00-00-00-000Z.db' },
          { name: 'pre-update-backup-2025-04-01T00-00-00-000Z.db' },
        ]);

        const { createPreUpdateBackup } =
          await import('@/lib/pre-update-backup');

        await createPreUpdateBackup();
        // Should delete the oldest one (4 exist, keep 3 → delete 1)
        expect(mockFs.remove).toHaveBeenCalledTimes(1);
        expect(mockFs.remove).toHaveBeenCalledWith(
          expect.stringContaining(
            'pre-update-backup-2025-01-01T00-00-00-000Z.db'
          )
        );
      });

      it('should not delete anything when 3 or fewer backups exist', async () => {
        mockFs.readDir.mockResolvedValue([
          { name: 'pre-update-backup-2025-01-01T00-00-00-000Z.db' },
          { name: 'pre-update-backup-2025-02-01T00-00-00-000Z.db' },
        ]);

        const { createPreUpdateBackup } =
          await import('@/lib/pre-update-backup');

        await createPreUpdateBackup();
        expect(mockFs.remove).not.toHaveBeenCalled();
      });

      it('should ignore non-backup files when pruning', async () => {
        mockFs.readDir.mockResolvedValue([
          { name: 'pre-update-backup-2025-01-01T00-00-00-000Z.db' },
          { name: 'pre-update-backup-2025-02-01T00-00-00-000Z.db' },
          { name: 'pre-update-backup-2025-03-01T00-00-00-000Z.db' },
          { name: 'pre-update-backup-2025-04-01T00-00-00-000Z.db' },
          { name: 'some-other-file.txt' },
          { name: '.DS_Store' },
        ]);

        const { createPreUpdateBackup } =
          await import('@/lib/pre-update-backup');

        await createPreUpdateBackup();
        // Only 1 deleted (4 backup files → keep 3 → delete 1)
        expect(mockFs.remove).toHaveBeenCalledTimes(1);
      });

      it('should not fail backup if pruning fails', async () => {
        mockFs.readDir.mockRejectedValue(new Error('readDir failed'));

        const { createPreUpdateBackup } =
          await import('@/lib/pre-update-backup');

        // Backup should still succeed even if pruning throws
        const result = await createPreUpdateBackup();
        expect(result.success).toBe(true);
      });
    });
  });
});
