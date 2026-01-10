import { useState, useEffect } from 'react';
import { GetConfigFileContent, SaveConfigFileContent, GetCurrentVersion, CheckForUpdates } from '../../wailsjs/go/main/App';
import type { UpdateInfo } from '../../types/upgrade';
import { Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Alert, AlertDescription, FormField, Label } from '../ui';

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
    setError('');
    const previousValue = autoCheckUpgrades;

    // Optimistically update UI
    setAutoCheckUpgrades(enabled);

    try {
      // Save immediately
      const content = await GetConfigFileContent();
      const config = JSON.parse(content);
      config.autoCheckUpgrades = enabled;
      await SaveConfigFileContent(JSON.stringify(config, null, 2));
    } catch (e: any) {
      // Revert state on error
      setAutoCheckUpgrades(previousValue);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError('Failed to update auto-check setting: ' + errorMessage);
      console.error('Failed to update auto-check upgrades setting:', e);
    }
  };

  const handleIntervalChange = async (interval: number) => {
    setError('');
    const previousInterval = upgradeCheckInterval;

    // Optimistically update UI
    setUpgradeCheckInterval(interval);

    try {
      // Save immediately
      const content = await GetConfigFileContent();
      const config = JSON.parse(content);
      config.upgradeCheckInterval = interval;
      await SaveConfigFileContent(JSON.stringify(config, null, 2));
    } catch (e: any) {
      // Revert state on error
      setUpgradeCheckInterval(previousInterval);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError('Failed to update check interval: ' + errorMessage);
      console.error('Failed to update upgrade check interval:', e);
    }
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
      <Card>
        <CardHeader>
          <CardTitle style={{ color: 'var(--color-text-primary)' }}>
            Current Version
          </CardTitle>
        </CardHeader>
        <CardContent>
          <code
            style={{
              color: 'var(--color-text-primary)',
              fontSize: '1.1em',
              fontWeight: '600',
            }}
            className="block"
          >
            {currentVersion}
          </code>
        </CardContent>
      </Card>

      {/* Auto-Check Settings */}
      <Card>
        <CardHeader>
          <CardTitle style={{ color: 'var(--color-text-primary)' }}>
            Automatic Upgrade Checks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Checkbox */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="auto-check-upgrades"
              checked={autoCheckUpgrades}
              onCheckedChange={(checked) => handleAutoCheckChange(checked === true)}
              disabled={saving}
            />
            <Label
              htmlFor="auto-check-upgrades"
              style={{ color: 'var(--color-text-primary)' }}
              className="text-sm font-medium cursor-pointer"
            >
              Automatically check for upgrades
            </Label>
          </div>

          {/* Interval Selector */}
          {autoCheckUpgrades && (
            <FormField
              label="Check interval"
              className="ml-8"
            >
              <Select
                value={upgradeCheckInterval.toString()}
                onValueChange={(value) => handleIntervalChange(Number(value))}
                disabled={saving}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {intervalOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {/* Last Check Time */}
          {lastUpgradeCheck && (
            <div className="ml-8">
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Last checked: {lastUpgradeCheck}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Check */}
      <Card>
        <CardHeader>
          <CardTitle style={{ color: 'var(--color-text-primary)' }}>
            Manual Check
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleCheckNow}
            disabled={saving}
            loading={checking}
            className="flex items-center gap-2"
          >
            {!checking && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {checking ? 'Checking...' : 'Check for Updates Now'}
          </Button>

          {/* Check Result */}
          {checkResult && (
            <div>
              {checkResult.isUpdateAvailable ? (
                <Alert variant="success">
                  <AlertDescription>
                    <p className="font-semibold mb-1">Update Available!</p>
                    <p className="text-sm">
                      A new version <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>{checkResult.latestVersion}</code> is available.
                      You are currently running <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>{checkResult.currentVersion}</code>.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="default">
                  <AlertDescription>
                    <p className="font-semibold mb-1">You're up to date!</p>
                    <p className="text-sm">
                      You are running the latest version <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>{checkResult.currentVersion}</code>.
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
