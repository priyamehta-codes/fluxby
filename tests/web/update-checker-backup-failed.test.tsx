/** @vitest-environment jsdom */
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Set __TAURI__ before any module evaluation via vi.hoisted
vi.hoisted(() => {
  // In jsdom, window is a separate object from globalThis in Node
  // Set on both to ensure UpdateChecker's module-scope check sees it
  (globalThis as any).__TAURI__ = true;
  if (typeof globalThis.window !== 'undefined') {
    (globalThis.window as any).__TAURI__ = true;
  }
});

// Mock createPreUpdateBackup to simulate failure
vi.mock('@/lib/pre-update-backup', () => ({
  createPreUpdateBackup: vi
    .fn()
    .mockResolvedValue({ success: false, error: 'disk full' }),
}));

// Mock Tauri plugin-updater
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue({
    version: '2.0.0',
    currentVersion: '1.0.0',
    date: '2025-06-01',
    body: 'Release notes',
    downloadAndInstall: vi.fn(),
  }),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

// Shared mock state for confirm
let confirmResult = true;
const mockConfirm = vi
  .fn()
  .mockImplementation(() => Promise.resolve(confirmResult));
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock('@/contexts/ConfirmContext', () => ({
  useConfirm: () => mockConfirm,
}));
vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

const baseTrans = {
  updater: {
    title: 'Software updates',
    description: 'Check for and install app updates',
    checking: 'Checking for updates...',
    newVersion: 'New version',
    newVersionAvailable: 'Version {version} is available',
    upToDate: 'You are running the latest version',
    checkNow: 'Check now',
    installUpdate: 'Install update',
    refreshNow: 'Refresh now',
    downloading: 'Downloading update...',
    readyToRestart: 'Update ready. Restarting...',
    checkFailed: 'Failed to check for updates',
    installFailed: 'Failed to install update',
    installComplete: 'Update installed! Restarting...',
    errorOccurred: 'An error occurred',
    clickToCheck: 'Click to check for updates',
    viewReleaseNotes: 'View release notes',
    releaseNotesTitle: 'Release notes for {version}',
    lastChecked: 'Last checked: {time}',
    backgroundCheckEnabled: 'Auto-check every 4 hours',
    backingUp: 'Backing up database...',
    backupFailed: 'Database backup failed. Update cancelled.',
    installAnyway: 'Install anyway',
    installAnywayConfirm:
      'Are you sure? The update will proceed without a database backup.',
    webDescription: 'Check for app updates',
    webUpdateAvailable: 'A new version is available',
  },
  common: { cancel: 'Cancel', close: 'Close' },
};

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: baseTrans,
    language: 'en' as const,
    setLanguage: vi.fn(),
  }),
}));

// Suppress Card/Dialog dependencies to simplify rendering
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  CardDescription: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/ui/progress', () => ({
  Progress: (props: any) => <div role='progressbar' {...props} />,
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid='dialog'>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));

import { UpdateChecker } from '@/components/settings/UpdateChecker';

describe('UpdateChecker backup-failed state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // shouldAdvanceTime: true lets waitFor work while controlling timers
    vi.useFakeTimers({ shouldAdvanceTime: true });
    confirmResult = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderAndTriggerAvailable() {
    await act(async () => {
      render(<UpdateChecker />);
    });
    // Advance past the 2s auto-check delay
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    // Flush all pending microtasks (dynamic imports, state updates)
    await act(async () => {
      await Promise.resolve();
    });
    // Verify available state
    expect(screen.getByText(/Version 2\.0\.0 is available/)).toBeTruthy();
    // Prevent the auto-check from re-firing by stopping timer advancement
    vi.clearAllTimers();
  }

  it('should show backup-failed state with error details and action buttons', async () => {
    await renderAndTriggerAvailable();

    // Click install to trigger backup
    const installButton = screen.getByText('Install update');
    fireEvent.click(installButton);

    // Should show backup-failed state
    await waitFor(() => {
      expect(
        screen.getByText('Database backup failed. Update cancelled.')
      ).toBeTruthy();
      expect(screen.getByText('disk full')).toBeTruthy();
    });

    // Both Cancel and Install anyway buttons should be visible
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Install anyway')).toBeTruthy();
  });

  it('should return to available state when Cancel is clicked in backup-failed state', async () => {
    await renderAndTriggerAvailable();

    fireEvent.click(screen.getByText('Install update'));

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.getByText(/Version 2\.0\.0 is available/)).toBeTruthy();
    });
  });

  it('should call confirm dialog when Install anyway is clicked', async () => {
    confirmResult = false; // user declines
    await renderAndTriggerAvailable();

    fireEvent.click(screen.getByText('Install update'));

    await waitFor(() => {
      expect(screen.getByText('Install anyway')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Install anyway'));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'danger',
          title: 'Install anyway',
        })
      );
    });
  });

  it('should have aria-live on the status container for screen reader announcements', async () => {
    const { container } = render(<UpdateChecker />);

    await waitFor(() => {
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion?.getAttribute('aria-atomic')).toBe('true');
    });
  });
});
