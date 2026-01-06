---
name: Upgrade Check Feature Implementation
overview: Implement automatic upgrade checking functionality that periodically checks GitHub releases for new versions and notifies users when updates are available. The implementation follows the existing handler pattern, integrates with the config system, and provides a non-intrusive notification UI.
todos:
  - id: version-package-models
    content: Create internal/version/models.go with GitHubRelease and UpdateInfo structs (JSON tags, time.Time fields)
    status: completed
  - id: version-package-version
    content: Create internal/version/version.go with constants (GitHubOwner='B87', GitHubRepo='pubsub-gui'), GetVersion() function reading from main.version, and GetReleasesURL() function
    status: completed
  - id: version-package-github
    content: Create internal/version/github.go with FetchLatestRelease() function (http.Client with 10s timeout, User-Agent header, skip drafts/prereleases, parse GitHub API response)
    status: completed
    dependencies:
      - version-package-models
  - id: version-package-checker
    content: Create internal/version/checker.go with CheckForUpdates() function (use go-version library, normalize versions, skip dev builds, return UpdateInfo)
    status: completed
    dependencies:
      - version-package-models
      - version-package-version
      - version-package-github
  - id: add-go-version-dependency
    content: Add github.com/hashicorp/go-version v1.6.0 to go.mod and run 'go mod tidy'
    status: completed
  - id: add-app-upgrade-fields
    content: Add upgradeCheckMu sync.Mutex, lastUpgradeCheck time.Time, and upgradeCheckTicker *time.Ticker fields to App struct in app.go
    status: completed
  - id: implement-getcurrentversion
    content: Implement GetCurrentVersion() string method in app.go that delegates to existing GetVersion() method
    status: completed
    dependencies:
      - add-app-upgrade-fields
  - id: implement-checkforupdates
    content: Implement CheckForUpdates() (*version.UpdateInfo, error) method in app.go (call version.CheckForUpdates(), update lastUpgradeCheck, save to config, return UpdateInfo)
    status: completed
    dependencies:
      - add-app-upgrade-fields
      - version-package-checker
      - update-appconfig-model
  - id: implement-startperiodicupgradecheck
    content: Implement StartPeriodicUpgradeCheck() method in app.go (check if enabled, calculate interval, check time since last check, schedule check)
    status: completed
    dependencies:
      - add-app-upgrade-fields
      - update-appconfig-model
  - id: implement-schedulenextupgradecheck
    content: Implement scheduleNextUpgradeCheck(delay time.Duration) private method in app.go (stop existing ticker, use time.AfterFunc, start periodic ticker)
    status: completed
    dependencies:
      - add-app-upgrade-fields
      - implement-startperiodicupgradecheck
  - id: implement-performupgradecheck
    content: Implement performUpgradeCheck() private method in app.go (call CheckForUpdates(), emit upgrade:available event if update available and not dismissed)
    status: completed
    dependencies:
      - implement-checkforupdates
      - implement-schedulenextupgradecheck
  - id: implement-dismissupgradenotification
    content: Implement DismissUpgradeNotification(version string) error method in app.go (update config with dismissed version, save config)
    status: completed
    dependencies:
      - add-app-upgrade-fields
      - update-appconfig-model
  - id: implement-openreleasespage
    content: Implement OpenReleasesPage(url string) error method in app.go using runtime.BrowserOpenURL(ctx, url)
    status: completed
    dependencies:
      - add-app-upgrade-fields
  - id: integrate-startup-upgrade-check
    content: Add call to a.StartPeriodicUpgradeCheck() in app.go startup() method after handlers are initialized
    status: completed
    dependencies:
      - implement-startperiodicupgradecheck
  - id: add-shutdown-cleanup
    content: Add cleanup in app.go Disconnect() method to stop upgradeCheckTicker if running and set to nil
    status: completed
    dependencies:
      - add-app-upgrade-fields
  - id: create-frontend-upgrade-types
    content: Create frontend/src/types/upgrade.ts with UpdateInfo and UpgradeSettings TypeScript interfaces
    status: completed
  - id: generate-wails-bindings
    content: Run 'wails dev' to generate TypeScript bindings for GetCurrentVersion, CheckForUpdates, DismissUpgradeNotification, and OpenReleasesPage methods
    status: completed
    dependencies:
      - implement-getcurrentversion
      - implement-checkforupdates
      - implement-dismissupgradenotification
      - implement-openreleasespage
  - id: create-upgrade-notification-component
    content: Create frontend/src/components/UpgradeNotification.tsx component with state management, event listener, UI elements (fixed position, icon, version text, collapsible notes, buttons), and handlers (dismiss, download, check now)
    status: completed
    dependencies:
      - create-frontend-upgrade-types
      - generate-wails-bindings
  - id: integrate-notification-in-app
    content: Import and add UpgradeNotification component to frontend/src/App.tsx render tree
    status: completed
    dependencies:
      - create-upgrade-notification-component
  - id: create-upgrade-settings-tab
    content: Create frontend/src/components/Settings/UpgradeTab.tsx component with state, UI elements (checkbox, dropdown, button, displays), load/save settings, and manual check functionality
    status: completed
    dependencies:
      - create-frontend-upgrade-types
      - generate-wails-bindings
  - id: update-settings-dialog
    content: Add 'Upgrade' tab to SettingsDialog.tsx tabs array, import UpgradeTab component, and add tab state management
    status: completed
    dependencies:
      - create-upgrade-settings-tab
  - id: update-goreleaser-ldflags
    content: "Update .goreleaser.yaml ldflags to include -X internal/version.Version={{.Version}} for version package injection (note: GoReleaser not currently used in release workflow)"
    status: completed
    dependencies:
      - version-package-version
  - id: update-release-workflow-ldflags
    content: "Update .github/workflows/release.yml Build with Wails step to pass ldflags: wails build -ldflags '-X main.version=${{ steps.version.outputs.version }} -X internal/version.Version=${{ steps.version.outputs.version }}' -platform ${{ matrix.platform }} -clean"
    status: completed
    dependencies:
      - version-package-version
  - id: verify-version-injection
    content: Verify internal/version/version.go GetVersion() function correctly reads from main.version variable (set via ldflags) with fallback to dev, and test that version is correctly injected in release builds
    status: completed
    dependencies:
      - version-package-version
      - update-release-workflow-ldflags
  - id: write-checker-unit-tests
    content: Create internal/version/checker_test.go with tests for version comparison logic, normalization (remove v prefix), and dev build skipping
    status: completed
    dependencies:
      - version-package-checker
  - id: write-github-unit-tests
    content: Create internal/version/github_test.go with mocked HTTP client tests for GitHub API response parsing and error handling
    status: completed
    dependencies:
      - version-package-github
  - id: test-startup-upgrade-check
    content: Test upgrade check functionality on app startup (verify periodic check starts, respects settings, handles errors gracefully)
    status: pending
    dependencies:
      - integrate-startup-upgrade-check
      - create-upgrade-notification-component
  - id: test-periodic-checking
    content: Test periodic checking with short interval (set to 1 hour, verify check occurs, verify notification appears if update available)
    status: pending
    dependencies:
      - test-startup-upgrade-check
  - id: test-dismissal-persistence
    content: Test dismissal persistence (dismiss notification, restart app, verify same version not shown again)
    status: pending
    dependencies:
      - implement-dismissupgradenotification
      - create-upgrade-notification-component
  - id: test-manual-check
    content: Test manual check from settings (click Check for Updates Now button, verify API call, verify result display)
    status: pending
    dependencies:
      - create-upgrade-settings-tab
  - id: update-claude-documentation
    content: ""
    status: pending
    dependencies:
      - implement-checkforupdates
      - implement-dismissupgradenotification
      - implement-openreleasespage
---

# Upgrade Check Feature Implementation Plan

## Overview

This plan implements automatic upgrade checking functionality that periodically checks GitHub releases for new versions and notifies users when updates are available. The implementation follows existing codebase patterns (handler-based architecture, event-driven updates, theme-compliant UI).

## Architecture

```mermaid
flowchart TD
    A[App Startup] --> B[StartPeriodicUpgradeCheck]
    B --> C{Check Enabled?}
    C -->|No| D[Skip]
    C -->|Yes| E{Time Since Last Check?}
    E -->|Interval Passed| F[Fetch Latest Release]
    E -->|Not Yet| G[Schedule Next Check]
    F --> H[Compare Versions]
    H --> I{Update Available?}
    I -->|Yes| J[Emit upgrade:available Event]
    I -->|No| K[Schedule Next Check]
    J --> L[Frontend Shows Notification]
    L --> M{User Action}
    M -->|Download| N[Open GitHub Releases]
    M -->|Dismiss| O[Save Dismissed Version]
    M -->|Show Notes| P[Display Release Notes]
```

## Implementation Tasks

### Phase 1: Backend - Version Package

#### 1.1 Create Version Package Structure

- **File**: `internal/version/version.go`
    - Define version constants (GitHubOwner: "B87", GitHubRepo: "pubsub-gui")
    - Export `GetVersion()` function that reads from `main.version` (set via ldflags)
    - Export `GetReleasesURL()` function

- **File**: `internal/version/github.go`
    - Implement `FetchLatestRelease()` function
    - Use `http.Client` with 10s timeout
    - Set User-Agent header: `pubsub-gui/{version}`
    - Parse GitHub API response (skip drafts/prereleases)
    - Return `GitHubRelease` struct with tag_name, name, body, html_url, published_at

- **File**: `internal/version/checker.go`
    - Implement `CheckForUpdates()` function
    - Use `github.com/hashicorp/go-version` for semantic version comparison
    - Normalize versions (remove 'v' prefix)
    - Skip check for "dev" builds
    - Return `UpdateInfo` struct

- **File**: `internal/version/models.go`
    - Define `GitHubRelease` struct (JSON tags)
    - Define `UpdateInfo` struct (JSON tags)

#### 1.2 Add Dependency

- **File**: `go.mod`
    - Add: `github.com/hashicorp/go-version v1.6.0`
    - Run `go mod tidy`

### Phase 2: Backend - Configuration Updates

#### 2.1 Update AppConfig Model

- **File**: `internal/models/connection.go`
    - Add to `AppConfig` struct:
    ```go
    AutoCheckUpgrades       bool      `json:"autoCheckUpgrades"`
    UpgradeCheckInterval    int       `json:"upgradeCheckInterval"` // hours
    LastUpgradeCheck        time.Time `json:"lastUpgradeCheck"`
    DismissedUpgradeVersion string    `json:"dismissedUpgradeVersion"`
    ```

    - Update `NewDefaultConfig()` to set defaults:
        - `AutoCheckUpgrades: true`
        - `UpgradeCheckInterval: 24`
        - `LastUpgradeCheck: time.Time{}`
        - `DismissedUpgradeVersion: ""`

#### 2.2 Update ConfigHandler

- **File**: `internal/app/config.go`
    - Add validation in `SaveConfigFileContent()`:
        - Validate `UpgradeCheckInterval` (1-720 hours)
        - Set defaults if invalid

### Phase 3: Backend - App Integration

#### 3.1 Add Upgrade Check Fields to App Struct

- **File**: `app.go`
    - Add to `App` struct:
    ```go
    upgradeCheckMu     sync.Mutex
    lastUpgradeCheck   time.Time
    upgradeCheckTicker *time.Ticker
    ```


#### 3.2 Add Upgrade Check Methods to App

- **File**: `app.go`
    - Implement `GetCurrentVersion() string` - delegate to existing `GetVersion()`
    - Implement `CheckForUpdates() (*version.UpdateInfo, error)`
        - Call `version.CheckForUpdates()`
        - Update `lastUpgradeCheck` timestamp
        - Save to config via `configManager`
        - Return `UpdateInfo`
    - Implement `StartPeriodicUpgradeCheck()`
        - Check if auto-check enabled in config
        - Calculate interval (default 24 hours)
        - Check if enough time passed since last check
        - Schedule initial check or next check
    - Implement `scheduleNextUpgradeCheck(delay time.Duration)`
        - Stop existing ticker if any
        - Use `time.AfterFunc` for delayed check
        - Start periodic ticker after first check
    - Implement `performUpgradeCheck()`
        - Call `CheckForUpdates()`
        - If update available and not dismissed, emit `upgrade:available` event
    - Implement `DismissUpgradeNotification(version string) error`
        - Update config with dismissed version
        - Save config
    - Implement `OpenReleasesPage(url string) error`
        - Use `runtime.BrowserOpenURL(ctx, url)`

#### 3.3 Integrate with Startup

- **File**: `app.go` (in `startup()` method)
    - After handlers initialized, call `a.StartPeriodicUpgradeCheck()`

#### 3.4 Cleanup on Shutdown

- **File**: `app.go` (in `Disconnect()` method)
    - Stop `upgradeCheckTicker` if running
    - Set to nil

### Phase 4: Frontend - Types and Wails Bindings

#### 4.1 Create TypeScript Types

- **File**: `frontend/src/types/upgrade.ts`
    - Define `UpdateInfo` interface:
    ```typescript
    export interface UpdateInfo {
      currentVersion: string;
      latestVersion: string;
      releaseNotes: string;
      releaseUrl: string;
      publishedAt: string;
      isUpdateAvailable: boolean;
    }
    ```

    - Define `UpgradeSettings` interface (for settings UI)

#### 4.2 Generate Wails Bindings

- Run `wails dev` to generate TypeScript bindings for new Go methods:
    - `GetCurrentVersion()`
    - `CheckForUpdates()`
    - `DismissUpgradeNotification(version: string)`
    - `OpenReleasesPage(url: string)`

### Phase 5: Frontend - Upgrade Notification Component

#### 5.1 Create UpgradeNotification Component

- **File**: `frontend/src/components/UpgradeNotification.tsx`
    - Follow React/Tailwind patterns from rules
    - Use semantic CSS variables for all colors (theme-compliant)
    - State management:
        - `updateInfo: UpdateInfo | null`
        - `isVisible: boolean`
        - `showReleaseNotes: boolean`
    - Event listener for `upgrade:available` event
    - UI elements:
        - Fixed position (bottom-right corner)
        - Update icon with accent color
        - Version comparison text
        - Collapsible release notes section
        - "Download Update" button (opens GitHub releases)
        - "Show/Hide Notes" button
        - Dismiss button (X icon)
    - Handlers:
        - `handleDismiss()` - calls `DismissUpgradeNotification()`
        - `handleDownload()` - calls `OpenReleasesPage()`
        - `handleCheckNow()` - manual check (optional, for testing)

#### 5.2 Integrate with App.tsx

- **File**: `frontend/src/App.tsx`
    - Import `UpgradeNotification` component
    - Add `<UpgradeNotification />` to render tree (after other components)

### Phase 6: Frontend - Settings Integration

#### 6.1 Create Upgrade Settings Tab Component

- **File**: `frontend/src/components/Settings/UpgradeTab.tsx`
    - Follow Settings tab pattern (similar to `AppearanceTab.tsx`)
    - State for upgrade settings:
        - `autoCheckUpgrades: boolean`
        - `upgradeCheckInterval: number`
    - UI elements:
        - Checkbox: "Automatically check for upgrades"
        - Select dropdown: Check interval (1, 6, 12, 24, 168 hours)
        - Button: "Check for Updates Now"
        - Display: Last check time (if available)
        - Display: Current version
    - Load settings from config on mount
    - Save settings via `SaveConfigFileContent()` (update JSON)
    - Manual check button calls `CheckForUpdates()` and shows result

#### 6.2 Update SettingsDialog

- **File**: `frontend/src/components/SettingsDialog.tsx`
    - Add "Upgrade" tab to tabs array
    - Import and render `UpgradeTab` component
    - Add tab state management

### Phase 7: Build Configuration

#### 7.1 Update GoReleaser Configuration

- **File**: `.goreleaser.yaml`
    - Update `ldflags` to include version injection for version package:ldflags:
  - -s -w
  - -X main.version={{.Version}}
  - -X internal/version.Version={{.Version}}
  - -X main.commit={{.Commit}}
  - -X main.date={{.Date}}

#### 7.2 Verify Version Injection

- **File**: `internal/version/version.go`
    - Use `main.version` variable (set via ldflags) or fallback to "dev"
    - Ensure `GetVersion()` reads from correct source

### Phase 8: Testing & Documentation

#### 8.1 Unit Tests

- **File**: `internal/version/checker_test.go`
    - Test version comparison logic
    - Test normalization (remove 'v' prefix)
    - Test dev build skipping

- **File**: `internal/version/github_test.go`
    - Mock HTTP client for GitHub API
    - Test response parsing
    - Test error handling

#### 8.2 Integration Testing

- Test upgrade check on app startup
- Test periodic checking with short interval
- Test dismissal persistence
- Test manual check from settings

#### 8.3 Documentation Updates

- **File**: `CLAUDE.md`
    - Add upgrade check section to Backend API Reference
    - Document new events (`upgrade:available`)
    - Document configuration options

## Key Implementation Details

### Version Source

- Version is set via ldflags in `main.go` (already implemented)
- `internal/version` package reads from `main.version` variable
- Fallback to "dev" for development builds

### Event Emission

- Backend emits `upgrade:available` event with `UpdateInfo` payload
- Frontend listens in `UpgradeNotification` component
- Event only emitted if update available and not dismissed

### Configuration Persistence

- Upgrade settings stored in `~/.pubsub-gui/config.json`
- Last check time updated after each check
- Dismissed version stored to prevent re-notification

### Error Handling

- GitHub API failures logged but don't notify user
- Version parsing errors return error to caller
- Network timeouts handled gracefully (10s timeout)

### Security Considerations

- HTTPS-only communication (GitHub API)
- No auto-download (user must click to open browser)
- Version validation using `go-version` library
- User-Agent header set for rate limiting

## Files to Create/Modify

### New Files

- `internal/version/version.go`
- `internal/version/github.go`
- `internal/version/checker.go`
- `internal/version/models.go`
- `internal/version/checker_test.go`
- `internal/version/github_test.go`
- `frontend/src/types/upgrade.ts`
- `frontend/src/components/UpgradeNotification.tsx`
- `frontend/src/components/Settings/UpgradeTab.tsx`

### Modified Files

- `go.mod` (add dependency)
- `internal/models/connection.go` (add config fields)
- `internal/app/config.go` (add validation)
- `app.go` (add methods and fields)
- `main.go` (no changes needed - version already set)
- `.goreleaser.yaml` (update ldflags)
- `frontend/src/App.tsx` (add component)
- `frontend/src/components/SettingsDialog.tsx` (add tab)
- `CLAUDE.md` (documentation)

## Dependencies

### Backend

- `github.com/hashicorp/go-version v1.6.0` (new)

### Frontend

- No new dependencies (uses existing Wails runtime)

## Testing Checklist

- [ ] Version comparison works correctly (semantic versioning)
- [ ] GitHub API integration works (fetch latest release)
- [ ] Periodic checking respects interval setting
- [ ] Notification appears when update available
- [ ] Dismissal prevents re-notification for same version
- [ ] Manual check from settings works
- [ ] Settings UI saves preferences correctly
- [ ] Release notes display correctly
- [ ] Download button opens GitHub releases page
- [ ] Dev builds skip upgrade check
- [ ] Error handling works (network failures, API errors)
- [ ] Theme compliance (all 5 themes tested)

## Rollout Strategy

1. **Phase 1-3**: Backend implementation and testing
2. **Phase 4-6**: Frontend implementation and testing
3. **Phase 7**: Build configuration updates
4. **Phase 8**: Integration testing and documentation
5. **Release**: Merge to main, create release with feature enabled