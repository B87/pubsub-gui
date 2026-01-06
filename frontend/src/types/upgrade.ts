// Upgrade-related type definitions

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  releaseUrl: string;
  publishedAt: string;
  isUpdateAvailable: boolean;
}

export interface UpgradeSettings {
  autoCheckUpgrades: boolean;
  upgradeCheckInterval: number; // hours
  lastUpgradeCheck?: string;
  dismissedUpgradeVersion?: string;
}
