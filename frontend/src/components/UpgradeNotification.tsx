import { useState, useEffect } from 'react';
import { EventsOn } from '../wailsjs/runtime/runtime';
import {
  GetCurrentVersion,
  CheckForUpdates,
  DismissUpgradeNotification,
  OpenReleasesPage,
} from '../wailsjs/go/main/App';
import { version } from '../wailsjs/go/models';
import type { UpdateInfo } from '../types/upgrade';

export default function UpgradeNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState<string>('');

  // Listen for upgrade:available event
  useEffect(() => {
    const unsubscribe = EventsOn('upgrade:available', (data: version.UpdateInfo) => {
      // Convert Wails model to our type
      const updateInfo: UpdateInfo = {
        currentVersion: data.currentVersion,
        latestVersion: data.latestVersion,
        releaseNotes: data.releaseNotes,
        releaseUrl: data.releaseUrl,
        publishedAt: data.publishedAt,
        isUpdateAvailable: data.isUpdateAvailable,
      };
      setUpdateInfo(updateInfo);
      setIsVisible(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleDismiss = async () => {
    if (!updateInfo || isDismissing) return;

    setIsDismissing(true);
    setError('');
    try {
      await DismissUpgradeNotification(updateInfo.latestVersion);
      setIsVisible(false);
      setUpdateInfo(null);
      setShowReleaseNotes(false);
      setError('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError('Failed to dismiss notification: ' + errorMessage);
      // Keep notification visible on error so user can see the error
    } finally {
      setIsDismissing(false);
    }
  };

  const handleDownload = async () => {
    if (!updateInfo) return;

    setError('');
    try {
      await OpenReleasesPage(updateInfo.releaseUrl);
      setError('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError('Failed to open releases page: ' + errorMessage);
    }
  };

  const handleCheckNow = async () => {
    setError('');
    try {
      const info = await CheckForUpdates();
      if (info && info.isUpdateAvailable) {
        // Convert Wails model to our type
        const updateInfo: UpdateInfo = {
          currentVersion: info.currentVersion,
          latestVersion: info.latestVersion,
          releaseNotes: info.releaseNotes,
          releaseUrl: info.releaseUrl,
          publishedAt: info.publishedAt,
          isUpdateAvailable: info.isUpdateAvailable,
        };
        setUpdateInfo(updateInfo);
        setIsVisible(true);
        setError('');
      } else {
        // No update available - clear any previous errors
        setError('');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError('Failed to check for updates: ' + errorMessage);
    }
  };

  if (!isVisible || !updateInfo) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        maxWidth: '400px',
        width: 'calc(100% - 40px)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)',
        }}
        className="border rounded-lg shadow-xl p-4"
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div
            style={{
              color: 'var(--color-accent-primary)',
            }}
            className="flex-shrink-0 mt-0.5"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3
              style={{ color: 'var(--color-text-primary)' }}
              className="text-sm font-semibold mb-1"
            >
              Update Available
            </h3>
            <p
              style={{ color: 'var(--color-text-secondary)' }}
              className="text-xs"
            >
              Version {updateInfo.currentVersion} → {updateInfo.latestVersion}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            disabled={isDismissing}
            style={{
              color: 'var(--color-text-muted)',
            }}
            className="flex-shrink-0 hover:opacity-70 transition-opacity disabled:opacity-50"
            title="Dismiss"
            aria-label="Dismiss upgrade notification"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              backgroundColor: 'var(--color-error-bg)',
              borderColor: 'var(--color-error-border)',
              color: 'var(--color-error)',
            }}
            className="mb-3 p-2 border rounded text-xs"
          >
            {error}
          </div>
        )}

        {/* Release Notes Toggle */}
        {updateInfo.releaseNotes && (
          <div className="mb-3">
            <button
              onClick={() => setShowReleaseNotes(!showReleaseNotes)}
              style={{
                color: 'var(--color-text-secondary)',
              }}
              className="text-xs hover:opacity-80 transition-opacity flex items-center gap-1"
            >
              <span>{showReleaseNotes ? 'Hide' : 'Show'} Release Notes</span>
              <svg
                className={`w-3 h-3 transition-transform ${showReleaseNotes ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showReleaseNotes && (
              <div
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)',
                }}
                className="mt-2 p-3 border rounded text-xs max-h-48 overflow-y-auto"
              >
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    fontFamily: 'inherit',
                  }}
                >
                  {updateInfo.releaseNotes}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            style={{
              backgroundColor: 'var(--color-accent-primary)',
              color: 'white',
            }}
            className="flex-1 px-3 py-2 rounded text-sm font-medium transition-opacity hover:opacity-90"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
            }}
          >
            Download Update
          </button>
          <button
            onClick={handleCheckNow}
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)',
            }}
            className="px-3 py-2 rounded text-sm transition-opacity hover:opacity-80"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
            }}
          >
            Check Again
          </button>
        </div>
      </div>
    </div>
  );
}
