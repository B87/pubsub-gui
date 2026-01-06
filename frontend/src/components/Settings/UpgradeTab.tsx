import { useState, useEffect } from 'react';
import { GetConfigFileContent, SaveConfigFileContent, GetCurrentVersion, CheckForUpdates } from '../../wailsjs/go/main/App';
import type { UpdateInfo } from '../../types/upgrade';

interface UpgradeTabProps {
  saving: boolean;
}

const intervalOptions = [
  { value: 1, label: '1 hour' },
  { value: 6, label: '6 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
  { value: 168, label: '1 week' },
];

export default function UpgradeTab({ saving }: UpgradeTabProps) {
  const [autoCheckUpgrades, setAutoCheckUpgrades] = useState(true);
  const [upgradeCheckInterval, setUpgradeCheckInterval] = useState(24);
  const [lastUpgradeCheck, setLastUpgradeCheck] = useState<string>('');
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Load settings from config on mount
  useEffect(() => {
    loadSettings();
    loadCurrentVersion();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const content = await GetConfigFileContent();
      const config = JSON.parse(content);

      setAutoCheckUpgrades(config.autoCheckUpgrades !== undefined ? config.autoCheckUpgrades : true);
      setUpgradeCheckInterval(config.upgradeCheckInterval || 24);

      if (config.lastUpgradeCheck) {
        try {
          const checkDate = new Date(config.lastUpgradeCheck);
          setLastUpgradeCheck(checkDate.toLocaleString());
        } catch (e) {
          setLastUpgradeCheck('');
        }
      } else {
        setLastUpgradeCheck('');
      }
    } catch (e: any) {
      setError('Failed to load settings: ' + e.toString());
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentVersion = async () => {
    try {
      const version = await GetCurrentVersion();
      setCurrentVersion(version || 'dev');
    } catch (e: any) {
      setCurrentVersion('dev');
    }
  };

  const saveSettings = async () => {
    setError('');
    try {
      const content = await GetConfigFileContent();
      const config = JSON.parse(content);

      config.autoCheckUpgrades = autoCheckUpgrades;
      config.upgradeCheckInterval = upgradeCheckInterval;

      const updatedContent = JSON.stringify(config, null, 2);
      await SaveConfigFileContent(updatedContent);

      // Reload to get updated last check time
      await loadSettings();
    } catch (e: any) {
      setError('Failed to save settings: ' + e.toString());
    }
  };

  const handleAutoCheckChange = async (enabled: boolean) => {
    setAutoCheckUpgrades(enabled);
    // Save immediately
    const content = await GetConfigFileContent();
    const config = JSON.parse(content);
    config.autoCheckUpgrades = enabled;
    await SaveConfigFileContent(JSON.stringify(config, null, 2));
  };

  const handleIntervalChange = async (interval: number) => {
    setUpgradeCheckInterval(interval);
    // Save immediately
    const content = await GetConfigFileContent();
    const config = JSON.parse(content);
    config.upgradeCheckInterval = interval;
    await SaveConfigFileContent(JSON.stringify(config, null, 2));
  };

  const handleCheckNow = async () => {
    setChecking(true);
    setError('');
    setCheckResult(null);
    try {
      const result = await CheckForUpdates();
      setCheckResult(result as any);
      // Reload settings to get updated last check time
      await loadSettings();
    } catch (e: any) {
      setError('Failed to check for updates: ' + e.toString());
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p style={{ color: 'var(--color-text-muted)' }}>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Version */}
      <div>
        <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
          Current Version
        </h3>
        <div
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border-primary)',
          }}
          className="border rounded-lg p-4"
        >
          <code
            style={{
              color: 'var(--color-text-primary)',
              fontSize: '1.1em',
              fontWeight: '600',
            }}
          >
            {currentVersion}
          </code>
        </div>
      </div>

      {/* Auto-Check Settings */}
      <div>
        <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Automatic Upgrade Checks
        </h3>

        {/* Checkbox */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            id="auto-check-upgrades"
            checked={autoCheckUpgrades}
            onChange={(e) => handleAutoCheckChange(e.target.checked)}
            disabled={saving}
            className="w-5 h-5 rounded"
            style={{
              accentColor: 'var(--color-accent-primary)',
            }}
          />
          <label
            htmlFor="auto-check-upgrades"
            style={{ color: 'var(--color-text-primary)' }}
            className="text-sm font-medium cursor-pointer"
          >
            Automatically check for upgrades
          </label>
        </div>

        {/* Interval Selector */}
        {autoCheckUpgrades && (
          <div className="ml-8 mb-4">
            <label
              htmlFor="check-interval"
              className="block text-sm mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Check interval:
            </label>
            <select
              id="check-interval"
              value={upgradeCheckInterval}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              disabled={saving}
              style={{
                backgroundColor: 'var(--color-bg-input)',
                color: 'var(--color-text-primary)',
                borderColor: 'var(--color-border-primary)',
              }}
              className="px-3 py-2 rounded-md border text-sm transition-colors focus:outline-none focus:ring-2"
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-primary)'}
            >
              {intervalOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Last Check Time */}
        {lastUpgradeCheck && (
          <div className="ml-8">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Last checked: {lastUpgradeCheck}
            </p>
          </div>
        )}
      </div>

      {/* Manual Check */}
      <div>
        <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Manual Check
        </h3>
        <button
          onClick={handleCheckNow}
          disabled={checking || saving}
          style={{
            backgroundColor: 'var(--color-accent-primary)',
            color: 'white',
          }}
          className="px-4 py-2 rounded-md transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
            }
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
            }
          }}
        >
          {checking ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Checking...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Check for Updates Now
            </>
          )}
        </button>

        {/* Check Result */}
        {checkResult && (
          <div className="mt-4">
            {checkResult.isUpdateAvailable ? (
              <div
                style={{
                  backgroundColor: 'var(--color-success-bg)',
                  borderColor: 'var(--color-success-border)',
                  color: 'var(--color-success)',
                }}
                className="p-4 border rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Update Available!</p>
                    <p className="text-sm">
                      A new version <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>{checkResult.latestVersion}</code> is available.
                      You are currently running <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>{checkResult.currentVersion}</code>.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-secondary)',
                }}
                className="p-4 border rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">You're up to date!</p>
                    <p className="text-sm">
                      You are running the latest version <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>{checkResult.currentVersion}</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            backgroundColor: 'var(--color-error-bg)',
            borderColor: 'var(--color-error-border)',
            color: 'var(--color-error)',
          }}
          className="p-3 border rounded-md text-sm"
        >
          {error}
        </div>
      )}
    </div>
  );
}
