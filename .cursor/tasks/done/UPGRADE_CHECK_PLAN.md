# In-App Upgrade Check Implementation Plan

## Overview

This document outlines the implementation plan for adding automatic upgrade checking functionality to the Pub/Sub GUI application. The system will periodically check for new releases and notify users when upgrades are available.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Backend Implementation](#backend-implementation)
3. [Frontend Implementation](#frontend-implementation)
4. [Configuration Management](#configuration-management)
5. [User Experience](#user-experience)
6. [Security Considerations](#security-considerations)
7. [Testing Strategy](#testing-strategy)
8. [Rollout Plan](#rollout-plan)

---

## Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Startup                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Check if upgrade check is enabled & last check time        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│        Fetch latest release from GitHub API                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│   Compare current version with latest release version       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  Up to date     │    │  Upgrade available │
│  (do nothing)   │    │  (notify user)   │
└─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Show notification   │
                    │ with release notes  │
                    └─────────────────────┘
```

### Components

1. **Backend (Go)**
   - Version checking service
   - GitHub API integration
   - Configuration management
   - Event emission for notifications

2. **Frontend (React)**
   - Upgrade notification UI component
   - Settings panel for upgrade preferences
   - Download/redirect logic

3. **Configuration**
   - Check interval preference
   - Auto-check enabled/disabled
   - Last check timestamp
   - Dismissed version tracking

---

## Backend Implementation

### 1. Version Package Structure

Create `internal/version/` package:

```
internal/version/
├── version.go           # Version constants and current version
├── checker.go           # Upgrade checking logic
├── github.go            # GitHub API client
└── models.go            # Data structures for releases
```

### 2. Version Constants (`internal/version/version.go`)

```go
package version

import "fmt"

const (
    // Version is set during build via ldflags
    // go build -ldflags "-X internal/version.Version=1.2.3"
    Version = "dev"

    // GitHubOwner is the repository owner
    GitHubOwner = "your-username"

    // GitHubRepo is the repository name
    GitHubRepo = "pubsub-gui"

    // ReleasesURL is the GitHub releases page
    ReleasesURL = "https://github.com/your-username/pubsub-gui/releases"
)

// GetVersion returns the current version
func GetVersion() string {
    return Version
}

// GetReleasesURL returns the GitHub releases URL
func GetReleasesURL() string {
    return ReleasesURL
}
```

### 3. GitHub API Client (`internal/version/github.go`)

```go
package version

import (
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

const (
    githubAPIURL = "https://api.github.com/repos/%s/%s/releases/latest"
    requestTimeout = 10 * time.Second
)

// GitHubRelease represents a GitHub release
type GitHubRelease struct {
    TagName     string    `json:"tag_name"`
    Name        string    `json:"name"`
    Body        string    `json:"body"`
    HTMLURL     string    `json:"html_url"`
    PublishedAt time.Time `json:"published_at"`
    Prerelease  bool      `json:"prerelease"`
    Draft       bool      `json:"draft"`
}

// FetchLatestRelease fetches the latest release from GitHub
func FetchLatestRelease() (*GitHubRelease, error) {
    url := fmt.Sprintf(githubAPIURL, GitHubOwner, GitHubRepo)

    client := &http.Client{
        Timeout: requestTimeout,
    }

    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }

    // Set User-Agent to avoid GitHub API rate limiting
    req.Header.Set("User-Agent", fmt.Sprintf("%s/%s", GitHubRepo, Version))
    req.Header.Set("Accept", "application/vnd.github.v3+json")

    resp, err := client.Do(req)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch release: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("github API returned status %d", resp.StatusCode)
    }

    var release GitHubRelease
    if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
        return nil, fmt.Errorf("failed to decode release: %w", err)
    }

    // Skip drafts and prereleases
    if release.Draft || release.Prerelease {
        return nil, fmt.Errorf("latest release is a draft or prerelease")
    }

    return &release, nil
}
```

### 4. Version Checker (`internal/version/checker.go`)

```go
package version

import (
    "fmt"
    "strings"
    "time"

    "github.com/hashicorp/go-version"
)

// UpdateInfo contains information about an available update
type UpdateInfo struct {
    CurrentVersion  string    `json:"currentVersion"`
    LatestVersion   string    `json:"latestVersion"`
    ReleaseNotes    string    `json:"releaseNotes"`
    ReleaseURL      string    `json:"releaseUrl"`
    PublishedAt     time.Time `json:"publishedAt"`
    IsUpdateAvailable bool    `json:"isUpdateAvailable"`
}

// CheckForUpdates checks if a newer version is available
func CheckForUpdates() (*UpdateInfo, error) {
    currentVer := GetVersion()

    // Skip check for dev builds
    if currentVer == "dev" {
        return &UpdateInfo{
            CurrentVersion:    currentVer,
            IsUpdateAvailable: false,
        }, nil
    }

    // Fetch latest release from GitHub
    release, err := FetchLatestRelease()
    if err != nil {
        return nil, fmt.Errorf("failed to fetch latest release: %w", err)
    }

    // Parse versions
    current, err := version.NewVersion(normalizeVersion(currentVer))
    if err != nil {
        return nil, fmt.Errorf("failed to parse current version: %w", err)
    }

    latest, err := version.NewVersion(normalizeVersion(release.TagName))
    if err != nil {
        return nil, fmt.Errorf("failed to parse latest version: %w", err)
    }

    // Compare versions
    updateAvailable := latest.GreaterThan(current)

    return &UpdateInfo{
        CurrentVersion:    currentVer,
        LatestVersion:     release.TagName,
        ReleaseNotes:      release.Body,
        ReleaseURL:        release.HTMLURL,
        PublishedAt:       release.PublishedAt,
        IsUpdateAvailable: updateAvailable,
    }, nil
}

// normalizeVersion removes 'v' prefix if present
func normalizeVersion(v string) string {
    return strings.TrimPrefix(v, "v")
}
```

### 5. App Integration (`app.go`)

Add to the `App` struct:

```go
type App struct {
    // ... existing fields ...

    // Upgrade checking
    upgradeCheckMu     sync.Mutex
    lastUpgradeCheck   time.Time
    upgradeCheckTicker *time.Ticker
}

// GetCurrentVersion returns the current application version
func (a *App) GetCurrentVersion() string {
    return version.GetVersion()
}

// CheckForUpdates checks if a newer version is available
func (a *App) CheckForUpdates() (*version.UpdateInfo, error) {
    a.upgradeCheckMu.Lock()
    defer a.upgradeCheckMu.Unlock()

    updateInfo, err := version.CheckForUpdates()
    if err != nil {
        return nil, err
    }

    a.lastUpgradeCheck = time.Now()

    // Save last check time to config
    config, _ := a.GetConfig()
    config.LastUpgradeCheck = a.lastUpgradeCheck
    _ = a.SaveConfig(config)

    return updateInfo, nil
}

// StartPeriodicUpgradeCheck starts background upgrade checking
func (a *App) StartPeriodicUpgradeCheck() {
    config, err := a.GetConfig()
    if err != nil || !config.AutoCheckUpgrades {
        return
    }

    // Calculate check interval (default: 24 hours)
    interval := 24 * time.Hour
    if config.UpgradeCheckInterval > 0 {
        interval = time.Duration(config.UpgradeCheckInterval) * time.Hour
    }

    // Check if enough time has passed since last check
    timeSinceLastCheck := time.Since(config.LastUpgradeCheck)
    if timeSinceLastCheck < interval {
        // Schedule next check
        a.scheduleNextUpgradeCheck(interval - timeSinceLastCheck)
        return
    }

    // Perform initial check
    go a.performUpgradeCheck()

    // Schedule periodic checks
    a.scheduleNextUpgradeCheck(interval)
}

func (a *App) scheduleNextUpgradeCheck(delay time.Duration) {
    a.upgradeCheckMu.Lock()
    defer a.upgradeCheckMu.Unlock()

    // Stop existing ticker if any
    if a.upgradeCheckTicker != nil {
        a.upgradeCheckTicker.Stop()
    }

    // Wait for the delay, then check periodically
    time.AfterFunc(delay, func() {
        a.performUpgradeCheck()

        config, _ := a.GetConfig()
        interval := 24 * time.Hour
        if config.UpgradeCheckInterval > 0 {
            interval = time.Duration(config.UpgradeCheckInterval) * time.Hour
        }

        a.upgradeCheckMu.Lock()
        a.upgradeCheckTicker = time.NewTicker(interval)
        a.upgradeCheckMu.Unlock()

        go func() {
            for range a.upgradeCheckTicker.C {
                a.performUpgradeCheck()
            }
        }()
    })
}

func (a *App) performUpgradeCheck() {
    updateInfo, err := a.CheckForUpdates()
    if err != nil {
        // Log error but don't notify user
        fmt.Printf("Failed to check for updates: %v\n", err)
        return
    }

    if updateInfo.IsUpdateAvailable {
        config, _ := a.GetConfig()

        // Don't notify if user dismissed this version
        if config.DismissedUpgradeVersion == updateInfo.LatestVersion {
            return
        }

        // Emit event to frontend
        runtime.EventsEmit(a.ctx, "upgrade:available", updateInfo)
    }
}

// DismissUpgradeNotification marks a version as dismissed
func (a *App) DismissUpgradeNotification(version string) error {
    config, err := a.GetConfig()
    if err != nil {
        return err
    }

    config.DismissedUpgradeVersion = version
    return a.SaveConfig(config)
}

// OpenReleasesPage opens the GitHub releases page in browser
func (a *App) OpenReleasesPage(url string) error {
    return runtime.BrowserOpenURL(a.ctx, url)
}
```

### 6. Configuration Model Updates (`internal/models/connection.go`)

Add to `AppConfig`:

```go
type AppConfig struct {
    // ... existing fields ...

    // Upgrade checking
    AutoCheckUpgrades       bool      `json:"autoCheckUpgrades"`
    UpgradeCheckInterval    int       `json:"upgradeCheckInterval"` // hours
    LastUpgradeCheck        time.Time `json:"lastUpgradeCheck"`
    DismissedUpgradeVersion string    `json:"dismissedUpgradeVersion"`
}
```

### 7. Startup Integration (`main.go`)

Add to app startup:

```go
func main() {
    // ... existing setup ...

    err := wails.Run(&options.App{
        // ... existing options ...
        OnStartup: func(ctx context.Context) {
            app.startup(ctx)

            // Start periodic upgrade checks
            app.StartPeriodicUpgradeCheck()
        },
    })

    // ... rest of main ...
}
```

---

## Frontend Implementation

### 1. Types (`frontend/src/types/upgrade.ts`)

```typescript
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
  lastUpgradeCheck: string;
  dismissedUpgradeVersion: string;
}
```

### 2. Upgrade Notification Component (`frontend/src/components/UpgradeNotification.tsx`)

```typescript
import { useState, useEffect } from 'react';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import {
  CheckForUpdates,
  DismissUpgradeNotification,
  OpenReleasesPage
} from '../../wailsjs/go/main/App';
import type { UpdateInfo } from '../types/upgrade';

export default function UpgradeNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  useEffect(() => {
    // Listen for upgrade notifications
    const handler = (info: UpdateInfo) => {
      setUpdateInfo(info);
      setIsVisible(true);
    };

    EventsOn('upgrade:available', handler);

    return () => {
      EventsOff('upgrade:available');
    };
  }, []);

  const handleDismiss = async () => {
    if (updateInfo) {
      await DismissUpgradeNotification(updateInfo.latestVersion);
      setIsVisible(false);
    }
  };

  const handleDownload = () => {
    if (updateInfo) {
      OpenReleasesPage(updateInfo.releaseUrl);
    }
  };

  const handleCheckNow = async () => {
    const info = await CheckForUpdates();
    if (info.isUpdateAvailable) {
      setUpdateInfo(info);
      setIsVisible(true);
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
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-accent-primary)',
        color: 'var(--color-text-primary)',
        zIndex: 1000,
      }}
      className="rounded-lg border-2 shadow-lg p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5"
            style={{ color: 'var(--color-accent-primary)' }}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" />
          </svg>
          <h3 className="font-semibold text-lg">Update Available</h3>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-200"
          aria-label="Dismiss notification"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <p className="text-slate-300 mb-2">
        Version <strong>{updateInfo.latestVersion}</strong> is now available.
        <br />
        You're currently on <strong>{updateInfo.currentVersion}</strong>.
      </p>

      {showReleaseNotes && (
        <div
          className="mt-3 mb-3 p-3 rounded max-h-48 overflow-y-auto text-sm"
          style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
        >
          <h4 className="font-semibold mb-2">Release Notes:</h4>
          <pre className="whitespace-pre-wrap text-slate-300">
            {updateInfo.releaseNotes}
          </pre>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={handleDownload}
          className="flex-1 px-4 py-2 rounded font-medium"
          style={{
            backgroundColor: 'var(--color-accent-primary)',
            color: 'white',
          }}
        >
          Download Update
        </button>
        <button
          onClick={() => setShowReleaseNotes(!showReleaseNotes)}
          className="px-4 py-2 rounded font-medium border border-slate-600 hover:bg-slate-700"
        >
          {showReleaseNotes ? 'Hide' : 'Show'} Notes
        </button>
      </div>
    </div>
  );
}
```

### 3. Settings Integration

Add to settings/preferences dialog:

```typescript
// In your ConfigEditorDialog or Settings component

const [upgradeSettings, setUpgradeSettings] = useState({
  autoCheckUpgrades: true,
  upgradeCheckInterval: 24, // hours
});

// UI section for upgrade settings
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Upgrade Settings</h3>

  <div className="flex items-center justify-between">
    <label>
      <input
        type="checkbox"
        checked={upgradeSettings.autoCheckUpgrades}
        onChange={(e) =>
          setUpgradeSettings({
            ...upgradeSettings,
            autoCheckUpgrades: e.target.checked,
          })
        }
      />
      Automatically check for upgrades
    </label>
  </div>

  {upgradeSettings.autoCheckUpgrades && (
    <div>
      <label>Check interval (hours)</label>
      <select
        value={upgradeSettings.upgradeCheckInterval}
        onChange={(e) =>
          setUpgradeSettings({
            ...upgradeSettings,
            upgradeCheckInterval: parseInt(e.target.value),
          })
        }
      >
        <option value={1}>Every hour</option>
        <option value={6}>Every 6 hours</option>
        <option value={12}>Every 12 hours</option>
        <option value={24}>Daily</option>
        <option value={168}>Weekly</option>
      </select>
    </div>
  )}

  <button onClick={handleCheckForUpdates}>
    Check for Updates Now
  </button>
</div>
```

### 4. App Integration (`frontend/src/App.tsx`)

Add the notification component:

```typescript
import UpgradeNotification from './components/UpgradeNotification';

function App() {
  return (
    <div>
      {/* ... existing components ... */}

      <UpgradeNotification />
    </div>
  );
}
```

---

## Configuration Management

### Default Configuration

When initializing a new config file, set sensible defaults:

```go
defaultConfig := models.AppConfig{
    // ... existing defaults ...

    // Upgrade checking defaults
    AutoCheckUpgrades:       true,
    UpgradeCheckInterval:    24, // Check daily
    LastUpgradeCheck:        time.Time{}, // Never checked
    DismissedUpgradeVersion: "",
}
```

### Configuration Validation

Add validation to ensure upgrade settings are valid:

```go
func (a *App) SaveConfig(config models.AppConfig) error {
    // Validate upgrade check interval
    if config.UpgradeCheckInterval < 1 {
        config.UpgradeCheckInterval = 24
    }
    if config.UpgradeCheckInterval > 720 { // Max 30 days
        config.UpgradeCheckInterval = 720
    }

    // ... rest of validation and save logic ...
}
```

---

## User Experience

### Notification Behavior

1. **First Run**: Check for updates on first startup
2. **Periodic Checks**: Respect user's interval setting (default: 24 hours)
3. **Manual Checks**: Allow users to check manually from settings
4. **Dismissal**: Remember dismissed versions (don't nag about same version)
5. **Non-Intrusive**: Notification appears in corner, doesn't block workflow

### Notification States

- **Update Available**: Show notification with version info
- **Update Dismissed**: Don't show notification for this version again
- **Up to Date**: No notification (manual check shows "up to date" message)
- **Check Failed**: Silently fail, retry on next interval

### User Actions

1. **Download Update**: Opens browser to GitHub releases page
2. **Show Release Notes**: Expands notification to show changelog
3. **Dismiss**: Hides notification for this version
4. **Disable Auto-Check**: Turn off in settings

---

## Security Considerations

### 1. HTTPS-Only Communication

- Always use HTTPS for GitHub API calls
- Validate SSL certificates (default behavior in Go's `http.Client`)

### 2. Rate Limiting

- GitHub API has rate limits (60 requests/hour for unauthenticated)
- Our periodic checks (default 24 hours) stay well within limits
- No need for API token for public repositories

### 3. Version Validation

- Use `github.com/hashicorp/go-version` for semantic version comparison
- Prevents version injection attacks
- Validates version format before comparison

### 4. User Agent

- Always set proper User-Agent header
- Helps GitHub identify legitimate traffic
- Format: `{app-name}/{version}`

### 5. No Auto-Download

- Never automatically download or install updates
- Always require user action
- Opens browser to official GitHub releases page

### 6. Code Signing

- Ensure releases are properly signed (macOS, Windows)
- Users should verify signatures before installing
- Document verification process in release notes

---

## Testing Strategy

### Unit Tests

1. **Version Parsing**
   ```go
   func TestVersionComparison(t *testing.T) {
       // Test cases for version comparison
   }
   ```

2. **GitHub API Mock**
   ```go
   func TestFetchLatestRelease(t *testing.T) {
       // Mock GitHub API responses
   }
   ```

3. **Configuration Validation**
   ```go
   func TestUpgradeSettingsValidation(t *testing.T) {
       // Test config validation logic
   }
   ```

### Integration Tests

1. **Manual Check Flow**
   - Click "Check for Updates" button
   - Verify API call is made
   - Verify notification appears if update available

2. **Periodic Check Flow**
   - Set short interval (e.g., 1 hour)
   - Wait for interval to pass
   - Verify automatic check occurs

3. **Dismissal Flow**
   - Dismiss update notification
   - Verify notification doesn't reappear
   - Verify config is updated

### End-to-End Tests

1. **Clean Install**
   - Install app with default settings
   - Verify initial check occurs
   - Verify notification behavior

2. **Upgrade Scenario**
   - Install older version
   - Run app
   - Verify upgrade notification appears
   - Download and install update
   - Verify new version runs correctly

---

## Rollout Plan

### Phase 1: Backend Implementation (Week 1)

- [ ] Create `internal/version/` package
- [ ] Implement GitHub API client
- [ ] Implement version checker logic
- [ ] Add configuration fields
- [ ] Add methods to `App` struct
- [ ] Unit tests for version package
- [ ] Integration with startup

### Phase 2: Frontend Implementation (Week 2)

- [ ] Create TypeScript types
- [ ] Implement `UpgradeNotification` component
- [ ] Add settings UI for upgrade preferences
- [ ] Integrate with `App.tsx`
- [ ] Add manual check button
- [ ] Test notification behavior

### Phase 3: Build Integration (Week 3)

- [ ] Update build scripts to inject version via ldflags
- [ ] Ensure GoReleaser sets version correctly
- [ ] Test version detection in builds
- [ ] Verify GitHub releases API compatibility

### Phase 4: Testing & Documentation (Week 4)

- [ ] Manual testing with all scenarios
- [ ] Update `CLAUDE.md` with upgrade check documentation
- [ ] Add troubleshooting section
- [ ] User documentation in README
- [ ] Create GitHub release template

### Phase 5: Release (Week 5)

- [ ] Merge to main branch
- [ ] Create release with upgrade check feature
- [ ] Monitor for issues
- [ ] Gather user feedback

---

## Build Configuration

### GoReleaser Configuration

Update `.goreleaser.yaml` to inject version:

```yaml
builds:
  - id: wails
    # ... existing config ...
    ldflags:
      - -X internal/version.Version={{.Version}}
      - -X internal/version.GitCommit={{.ShortCommit}}
      - -X internal/version.BuildDate={{.Date}}
```

### Wails Build Commands

For local builds:

```bash
# Development build (no version set)
wails build

# Production build with version
wails build -ldflags "-X internal/version.Version=1.2.3"
```

---

## Future Enhancements

### Phase 2 Features (Post-Launch)

1. **In-App Download**
   - Download update directly in app
   - Verify checksum/signature
   - Install on app restart

2. **Beta Channel**
   - Allow users to opt into beta releases
   - Separate setting from stable channel

3. **Release Notes Viewer**
   - Dedicated dialog for release notes
   - Markdown rendering
   - Change history

4. **Auto-Update**
   - Optional automatic update installation
   - Requires user consent
   - Background download with progress

5. **Update Statistics**
   - Track update check success/failure
   - Report metrics (opt-in)

---

## Dependencies

### Backend (Go)

Add to `go.mod`:

```
github.com/hashicorp/go-version v1.6.0
```

### Frontend (React)

No additional dependencies required (uses built-in Wails runtime).

---

## Resources

- **GitHub Releases API**: https://docs.github.com/en/rest/releases
- **Semantic Versioning**: https://semver.org/
- **go-version Library**: https://github.com/hashicorp/go-version
- **Wails Runtime API**: https://wails.io/docs/reference/runtime/intro

---

**Last Updated**: 2026-01-06
