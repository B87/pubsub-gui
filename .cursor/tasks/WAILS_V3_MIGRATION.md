# Wails v2 to v3 Migration Plan - Pub/Sub GUI

## Overview

This document outlines the migration strategy for upgrading the Pub/Sub GUI application from Wails v2 to Wails v3. The migration will improve performance, enable multi-window support, and provide better code organization through the service pattern.

**Estimated Migration Time:** 3-6 hours

**Target Wails Version:** v3.0.0 (when stable)

---

## Table of Contents

1. [Why Migrate to v3](#why-migrate-to-v3)
2. [Breaking Changes Impact Analysis](#breaking-changes-impact-analysis)
3. [Migration Strategy](#migration-strategy)
4. [Step-by-Step Migration Guide](#step-by-step-migration-guide)
5. [Code Transformation Examples](#code-transformation-examples)
6. [Testing Plan](#testing-plan)
7. [Rollback Strategy](#rollback-strategy)
8. [Post-Migration Benefits](#post-migration-benefits)

---

## Why Migrate to v3

### Performance Improvements
- **Faster startup**: Optimized initialization reduces app launch time
- **Lower memory usage**: More efficient resource management
- **Better bridge performance**: <1ms call overhead for Go ↔ JavaScript communication

### Developer Experience
- **Service pattern**: Better code organization and separation of concerns
- **Multi-window support**: Enable preferences window, monitoring windows, etc.
- **Type safety**: Improved TypeScript bindings with better autocomplete
- **Clearer API**: Object-oriented methods instead of context-based functions

### New Features
- **System tray support**: Built-in support for system tray integration
- **Better event system**: Typed events with simpler API
- **Enhanced window management**: Create, destroy, and manage windows dynamically

---

## Breaking Changes Impact Analysis

### High Impact Changes

| Change | Current Usage | Effort | Files Affected |
|--------|---------------|--------|----------------|
| Application initialization | `wails.Run()` in `main.go` | Low | 1 file |
| Bindings system | `App` struct with context | Medium | 1 file |
| Runtime calls | `runtime.*` functions | High | All handlers |
| Event system | `EventsOn/EventsEmit` | Medium | Frontend components |
| Frontend bindings import paths | `wailsjs/go/main/App` | Low | ~30 components |

### Medium Impact Changes

| Change | Current Usage | Effort | Files Affected |
|--------|---------------|--------|----------------|
| Configuration file format | `wails.json` | Low | 1 file |
| Window options | `options.App{}` | Low | 1 file |
| Context handling | `app.ctx context.Context` | Medium | All handlers |

### Low Impact Changes

| Change | Current Usage | Effort | Files Affected |
|--------|---------------|--------|----------------|
| Asset embedding | `//go:embed all:frontend/dist` | None | No change |
| Build commands | `wails build` | None | Script updates |

---

## Migration Strategy

### Approach: Incremental Migration

We'll use a phased approach to minimize risk:

1. **Phase 1: Preparation** (30 minutes)
   - Create migration branch
   - Backup current state
   - Update dependencies
   - Review v3 documentation

2. **Phase 2: Backend Migration** (2-3 hours)
   - Convert main.go to v3 structure
   - Transform App struct to services
   - Update runtime calls
   - Migrate handler pattern

3. **Phase 3: Frontend Migration** (1-2 hours)
   - Update import paths
   - Regenerate bindings
   - Update event handling
   - Test all components

4. **Phase 4: Testing & Validation** (1 hour)
   - Functional testing
   - Performance validation
   - Multi-window testing
   - Production build testing

---

## Step-by-Step Migration Guide

### Prerequisites

```bash
# Ensure Go 1.21+ installed
go version

# Ensure Node.js 18+ installed
node --version

# Create migration branch
git checkout -b feature/wails-v3-migration

# Backup current state
git tag v2-backup
```

---

### Step 1: Update Dependencies (15 minutes)

#### 1.1 Update go.mod

**Current:**
```go
module pubsub-gui

go 1.21

require (
    github.com/wailsapp/wails/v2 v2.11.0
    // ... other dependencies
)
```

**New:**
```go
module pubsub-gui

go 1.21

require (
    github.com/wailsapp/wails/v3 v3.0.0-alpha.1
    // ... other dependencies (unchanged)
)
```

**Command:**
```bash
go get github.com/wailsapp/wails/v3@latest
go mod tidy
```

#### 1.2 Update Wails CLI

```bash
# Install Wails v3 CLI
go install github.com/wailsapp/wails/v3/cmd/wails3@latest

# Verify installation
wails3 version
```

#### 1.3 Update wails.json

**Current (`wails.json`):**
```json
{
  "$schema": "https://wails.io/schemas/config.v2.json",
  "name": "pubsub-gui",
  "outputfilename": "pubsub-gui",
  "frontend:install": "npm install",
  "frontend:build": "npm run build",
  "frontend:dev:watcher": "npm run dev",
  "frontend:dev:serverUrl": "auto",
  "author": {
    "name": "Bernat",
    "email": "b.barroso8@gmail.com"
  }
}
```

**New (`wails.json`):**
```json
{
  "$schema": "https://wails.io/schemas/config.v3.json",
  "name": "pubsub-gui",
  "outputfilename": "pubsub-gui",
  "frontend": {
    "dir": "./frontend",
    "install": "npm install",
    "build": "npm run build",
    "dev": "npm run dev",
    "devServerUrl": "http://localhost:5173"
  },
  "author": {
    "name": "Bernat",
    "email": "b.barroso8@gmail.com"
  }
}
```

---

### Step 2: Restructure Backend (2-3 hours)

#### 2.1 Create Service Architecture

**New Directory Structure:**
```
internal/
├── services/
│   ├── connection_service.go      # Connection management
│   ├── resource_service.go        # Topic/subscription management
│   ├── monitoring_service.go      # Message streaming
│   ├── template_service.go        # Template management
│   ├── config_service.go          # Configuration management
│   └── publisher_service.go       # Message publishing
├── app/                           # Keep existing handlers
├── auth/                          # Unchanged
├── config/                        # Unchanged
├── models/                        # Unchanged
└── pubsub/                        # Unchanged
```

#### 2.2 Transform main.go

**Current (`main.go`):**
```go
package main

import (
    "context"
    "embed"

    "github.com/wailsapp/wails/v2"
    "github.com/wailsapp/wails/v2/pkg/options"
    "github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

var version = "dev"

func main() {
    app := NewApp()
    app.SetVersion(version)

    err := wails.Run(&options.App{
        Title:      "pubsub-gui",
        Width:      1728,
        Height:     972,
        Fullscreen: false,
        AssetServer: &assetserver.Options{
            Assets: assets,
        },
        BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
        OnStartup:        app.startup,
        OnShutdown:       func(_ context.Context) { app.Disconnect() },
        Bind: []interface{}{
            app,
        },
    })

    if err != nil {
        println("Error:", err.Error())
    }
}
```

**New (`main.go`):**
```go
package main

import (
    "embed"
    "log"

    "pubsub-gui/internal/services"

    "github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

var version = "dev"

func main() {
    // Create application instance
    app := application.New(application.Options{
        Name:        "pubsub-gui",
        Description: "Google Cloud Pub/Sub Management GUI",
        Assets: application.AssetOptions{
            Handler: application.AssetFileServerFS(assets),
        },
    })

    // Create and register services
    connectionService := services.NewConnectionService(app, version)
    resourceService := services.NewResourceService(app, connectionService)
    monitoringService := services.NewMonitoringService(app, connectionService)
    templateService := services.NewTemplateService(app)
    configService := services.NewConfigService(app, monitoringService)
    publisherService := services.NewPublisherService(app, connectionService)

    // Register all services
    app.RegisterService(application.NewService(connectionService))
    app.RegisterService(application.NewService(resourceService))
    app.RegisterService(application.NewService(monitoringService))
    app.RegisterService(application.NewService(templateService))
    app.RegisterService(application.NewService(configService))
    app.RegisterService(application.NewService(publisherService))

    // Create main window
    window := app.NewWebviewWindowWithOptions(application.WebviewWindowOptions{
        Title:  "Pub/Sub GUI",
        Width:  1728,
        Height: 972,
        BackgroundColour: application.NewRGB(27, 38, 54),
        URL:    "/",
    })

    // Show window
    window.Show()

    // Run application
    if err := app.Run(); err != nil {
        log.Fatal(err)
    }
}
```

#### 2.3 Create Service Layer

**Example: Connection Service (`internal/services/connection_service.go`)**

```go
package services

import (
    "context"
    "fmt"
    "os"

    "pubsub-gui/internal/app"
    "pubsub-gui/internal/auth"
    "pubsub-gui/internal/config"
    "pubsub-gui/internal/models"

    "github.com/wailsapp/wails/v3/pkg/application"
)

// ConnectionService handles all connection-related operations
type ConnectionService struct {
    app            *application.Application
    config         *models.AppConfig
    configManager  *config.Manager
    clientManager  *auth.ClientManager
    connection     *app.ConnectionHandler
    version        string
}

// NewConnectionService creates a new connection service
func NewConnectionService(app *application.Application, version string) *ConnectionService {
    return &ConnectionService{
        app:     app,
        version: version,
    }
}

// ServiceStartup is called when the service starts
func (s *ConnectionService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
    // Initialize client manager
    s.clientManager = auth.NewClientManager(ctx)

    // Initialize config manager
    configMgr, err := config.NewManager()
    if err != nil {
        return fmt.Errorf("failed to initialize config manager: %w", err)
    }
    s.configManager = configMgr

    // Load configuration
    cfg, err := s.configManager.LoadConfig()
    if err != nil {
        cfg = models.NewDefaultConfig()
    }
    s.config = cfg

    // Initialize connection handler
    s.connection = app.NewConnectionHandler(
        ctx,
        s.config,
        s.configManager,
        s.clientManager,
        func() {
            // Emit resource sync event - will be handled by ResourceService
            s.app.EmitEvent("connection:resources-sync-needed", nil)
        },
    )

    // Auto-connect to active profile
    if s.config.ActiveProfileID != "" {
        for _, profile := range s.config.Profiles {
            if profile.ID == s.config.ActiveProfileID {
                if err := s.connectWithProfile(&profile); err != nil {
                    s.app.Logger.Error("Failed to auto-connect", "error", err)
                } else {
                    // Trigger resource sync
                    s.app.EmitEvent("connection:resources-sync-needed", nil)
                }
                break
            }
        }
    }

    return nil
}

// GetConnectionStatus returns the current connection status
func (s *ConnectionService) GetConnectionStatus() app.ConnectionStatus {
    return s.connection.GetConnectionStatus()
}

// GetVersion returns the application version
func (s *ConnectionService) GetVersion() string {
    if s.version == "" {
        return "dev"
    }
    return s.version
}

// ConnectWithADC connects using Application Default Credentials
func (s *ConnectionService) ConnectWithADC(projectID string) error {
    err := s.connection.ConnectWithADC(projectID)
    if err == nil {
        s.app.EmitEvent("connection:resources-sync-needed", nil)
    }
    return err
}

// ConnectWithServiceAccount connects using service account JSON key
func (s *ConnectionService) ConnectWithServiceAccount(projectID, keyPath string) error {
    err := s.connection.ConnectWithServiceAccount(projectID, keyPath)
    if err == nil {
        s.app.EmitEvent("connection:resources-sync-needed", nil)
    }
    return err
}

// Disconnect closes the current connection
func (s *ConnectionService) Disconnect() error {
    // Emit disconnect event so other services can cleanup
    s.app.EmitEvent("connection:disconnected", nil)
    return s.clientManager.Close()
}

// GetProfiles returns all saved connection profiles
func (s *ConnectionService) GetProfiles() []models.ConnectionProfile {
    return s.connection.GetProfiles()
}

// SaveProfile saves a connection profile
func (s *ConnectionService) SaveProfile(profile models.ConnectionProfile) error {
    return s.connection.SaveProfile(profile)
}

// DeleteProfile removes a connection profile
func (s *ConnectionService) DeleteProfile(profileID string) error {
    return s.connection.DeleteProfile(profileID, s.Disconnect)
}

// SwitchProfile switches to a different connection profile
func (s *ConnectionService) SwitchProfile(profileID string) error {
    return s.connection.SwitchProfile(profileID, s.Disconnect)
}

// GetClientManager returns the client manager (for other services)
func (s *ConnectionService) GetClientManager() *auth.ClientManager {
    return s.clientManager
}

// GetConfig returns the current config (for other services)
func (s *ConnectionService) GetConfig() *models.AppConfig {
    return s.config
}

// GetConfigManager returns the config manager (for other services)
func (s *ConnectionService) GetConfigManager() *config.Manager {
    return s.configManager
}

// connectWithProfile is a helper to connect using a profile
func (s *ConnectionService) connectWithProfile(profile *models.ConnectionProfile) error {
    if profile.EmulatorHost != "" {
        os.Setenv("PUBSUB_EMULATOR_HOST", profile.EmulatorHost)
    }

    switch profile.AuthMethod {
    case "ADC":
        return s.connection.ConnectWithADC(profile.ProjectID)
    case "ServiceAccount":
        return s.connection.ConnectWithServiceAccount(profile.ProjectID, profile.ServiceAccountPath)
    default:
        return fmt.Errorf("unsupported auth method: %s", profile.AuthMethod)
    }
}
```

**Example: Resource Service (`internal/services/resource_service.go`)**

```go
package services

import (
    "context"
    "sync"

    "pubsub-gui/internal/app"
    "pubsub-gui/internal/pubsub/admin"

    "github.com/wailsapp/wails/v3/pkg/application"
)

// ResourceService handles topic and subscription management
type ResourceService struct {
    app               *application.Application
    connectionService *ConnectionService
    resources         *app.ResourceHandler

    // Resource cache
    resourceMu    sync.RWMutex
    topics        []admin.TopicInfo
    subscriptions []admin.SubscriptionInfo
}

// NewResourceService creates a new resource service
func NewResourceService(app *application.Application, connectionService *ConnectionService) *ResourceService {
    return &ResourceService{
        app:               app,
        connectionService: connectionService,
        topics:            []admin.TopicInfo{},
        subscriptions:     []admin.SubscriptionInfo{},
    }
}

// ServiceStartup is called when the service starts
func (s *ResourceService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
    clientManager := s.connectionService.GetClientManager()

    // Initialize resource handler
    s.resources = app.NewResourceHandler(
        ctx,
        clientManager,
        &s.resourceMu,
        &s.topics,
        &s.subscriptions,
    )

    // Listen for connection events
    s.app.OnEvent("connection:resources-sync-needed", func(e *application.CustomEvent) {
        go s.resources.SyncResources()
    })

    s.app.OnEvent("connection:disconnected", func(e *application.CustomEvent) {
        // Clear resource cache
        s.resourceMu.Lock()
        s.topics = []admin.TopicInfo{}
        s.subscriptions = []admin.SubscriptionInfo{}
        s.resourceMu.Unlock()
    })

    return nil
}

// SyncResources manually triggers a resource sync
func (s *ResourceService) SyncResources() error {
    return s.resources.SyncResources()
}

// ListTopics returns all topics from cached store
func (s *ResourceService) ListTopics() ([]admin.TopicInfo, error) {
    return s.resources.ListTopics()
}

// ListSubscriptions returns all subscriptions from cached store
func (s *ResourceService) ListSubscriptions() ([]admin.SubscriptionInfo, error) {
    return s.resources.ListSubscriptions()
}

// GetTopicMetadata retrieves metadata for a specific topic
func (s *ResourceService) GetTopicMetadata(topicID string) (admin.TopicInfo, error) {
    return s.resources.GetTopicMetadata(topicID)
}

// GetSubscriptionMetadata retrieves metadata for a specific subscription
func (s *ResourceService) GetSubscriptionMetadata(subID string) (admin.SubscriptionInfo, error) {
    return s.resources.GetSubscriptionMetadata(subID)
}

// CreateTopic creates a new topic
func (s *ResourceService) CreateTopic(topicID string, messageRetentionDuration string) error {
    return s.resources.CreateTopic(topicID, messageRetentionDuration, func() {
        go s.resources.SyncResources()
    })
}

// DeleteTopic deletes a topic
func (s *ResourceService) DeleteTopic(topicID string) error {
    return s.resources.DeleteTopic(topicID, func() {
        go s.resources.SyncResources()
    })
}

// CreateSubscription creates a new subscription
func (s *ResourceService) CreateSubscription(topicID string, subID string, ttlSeconds int64) error {
    return s.resources.CreateSubscription(topicID, subID, ttlSeconds, func() {
        go s.resources.SyncResources()
    })
}

// DeleteSubscription deletes a subscription
func (s *ResourceService) DeleteSubscription(subID string) error {
    return s.resources.DeleteSubscription(subID, func() {
        go s.resources.SyncResources()
    })
}

// UpdateSubscription updates a subscription's configuration
func (s *ResourceService) UpdateSubscription(subID string, params app.SubscriptionUpdateParams) error {
    return s.resources.UpdateSubscription(subID, params, func() {
        go s.resources.SyncResources()
    })
}
```

**Note:** Similar services would be created for:
- `MonitoringService` (message streaming)
- `TemplateService` (template management)
- `ConfigService` (config management)
- `PublisherService` (message publishing)

#### 2.4 Update Handler Pattern

The existing handlers in `internal/app/` can remain largely unchanged. They just need to:

1. Remove context parameters where runtime was used
2. Accept application instance if needed for events
3. Use callback functions for cross-service communication

---

### Step 3: Update Frontend (1-2 hours)

#### 3.1 Generate New Bindings

```bash
# Generate v3 bindings
wails3 generate bindings

# This creates: frontend/bindings/pubsub-gui/
# - connectionservice.js
# - resourceservice.js
# - monitoringservice.js
# - templateservice.js
# - configservice.js
# - publisherservice.js
```

#### 3.2 Update Import Paths

**Current:**
```typescript
import {
  ConnectWithADC,
  ConnectWithServiceAccount,
  Disconnect,
  GetConnectionStatus,
} from '../wailsjs/go/main/App';
```

**New:**
```typescript
import {
  ConnectWithADC,
  ConnectWithServiceAccount,
  Disconnect,
  GetConnectionStatus,
} from './bindings/pubsub-gui/connectionservice';

import {
  ListTopics,
  ListSubscriptions,
  CreateTopic,
  DeleteTopic,
} from './bindings/pubsub-gui/resourceservice';

import {
  StartMonitor,
  StopMonitor,
  GetBufferedMessages,
} from './bindings/pubsub-gui/monitoringservice';
```

#### 3.3 Update Event Handling

**Current:**
```typescript
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';

useEffect(() => {
  const handler = (data: any) => {
    console.log('Event received:', data);
  };

  EventsOn('my-event', handler);

  return () => {
    EventsOff('my-event');
  };
}, []);
```

**New:**
```typescript
import { OnEvent, Emit } from '@wailsio/runtime';

useEffect(() => {
  const unsubscribe = OnEvent('my-event', (data) => {
    console.log('Event received:', data);
  });

  return unsubscribe;
}, []);
```

#### 3.4 Create Migration Script

**Create `scripts/update-imports.sh`:**

```bash
#!/bin/bash

# Script to automatically update import paths from v2 to v3

echo "Updating Wails import paths from v2 to v3..."

# Find all TypeScript/JavaScript files in frontend
find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | while read file; do
  echo "Processing: $file"

  # Update runtime imports
  sed -i.bak "s|from '../wailsjs/runtime/runtime'|from '@wailsio/runtime'|g" "$file"
  sed -i.bak "s|from '../../wailsjs/runtime/runtime'|from '@wailsio/runtime'|g" "$file"

  # Update EventsOn/EventsOff to OnEvent
  # Note: This is a simple replacement - manual review recommended
  sed -i.bak 's/EventsOn(/OnEvent(/g' "$file"

  # Remove backup files
  rm -f "$file.bak"
done

echo "Import path updates complete!"
echo "IMPORTANT: Review changes and update service-specific imports manually"
echo "Run: git diff frontend/src"
```

**Make it executable:**
```bash
chmod +x scripts/update-imports.sh
```

---

### Step 4: Update Runtime Calls (if any direct usage)

Since this app uses handlers that abstract runtime calls, most changes are isolated to the handler layer. If there are any direct runtime calls in services, update them:

**Current:**
```go
import "github.com/wailsapp/wails/v2/pkg/runtime"

runtime.EventsEmit(ctx, "event-name", data)
runtime.LogInfo(ctx, "message")
```

**New:**
```go
// In service with app reference
s.app.EmitEvent("event-name", data)
s.app.Logger.Info("message")
```

---

### Step 5: Update Build Configuration

#### 5.1 Update .goreleaser.yaml (if using GoReleaser)

**Current ldflags:**
```yaml
builds:
  - ldflags:
      - -X main.version={{.Version}}
```

**New ldflags (if version moved to service):**
```yaml
builds:
  - ldflags:
      - -X main.version={{.Version}}
      # No change needed if version is still in main.go
```

#### 5.2 Update Build Scripts

**Update `Taskfile.yml` or build scripts:**

```yaml
# Change wails commands to wails3
dev:
  cmd: wails3 dev

build:
  cmd: wails3 build

build-all:
  cmd: wails3 build -platform darwin/universal,windows/amd64,linux/amd64
```

---

## Code Transformation Examples

### Example 1: Connection Status Check

**Current (`frontend/src/components/CommandBar.tsx`):**
```typescript
import { GetConnectionStatus } from '../wailsjs/go/main/App';

const checkStatus = async () => {
  const status = await GetConnectionStatus();
  setConnected(status.connected);
};
```

**New:**
```typescript
import { GetConnectionStatus } from './bindings/pubsub-gui/connectionservice';

const checkStatus = async () => {
  const status = await GetConnectionStatus();
  setConnected(status.connected);
};
```

### Example 2: Resource Listing

**Current (`frontend/src/components/Sidebar.tsx`):**
```typescript
import { ListTopics, ListSubscriptions } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';

useEffect(() => {
  EventsOn('resources:updated', (data: any) => {
    setTopics(data.topics);
    setSubscriptions(data.subscriptions);
  });
}, []);
```

**New:**
```typescript
import { ListTopics, ListSubscriptions } from './bindings/pubsub-gui/resourceservice';
import { OnEvent } from '@wailsio/runtime';

useEffect(() => {
  const unsubscribe = OnEvent('resources:updated', (data) => {
    setTopics(data.topics);
    setSubscriptions(data.subscriptions);
  });

  return unsubscribe;
}, []);
```

### Example 3: Message Publishing

**Current (`frontend/src/components/TopicDetails.tsx`):**
```typescript
import { PublishMessage } from '../wailsjs/go/main/App';

const handlePublish = async () => {
  const result = await PublishMessage(topicId, payload, attributes);
  console.log('Published:', result.messageId);
};
```

**New:**
```typescript
import { PublishMessage } from './bindings/pubsub-gui/publisherservice';

const handlePublish = async () => {
  const result = await PublishMessage(topicId, payload, attributes);
  console.log('Published:', result.messageId);
};
```

### Example 4: Theme Configuration

**Current (`frontend/src/contexts/ThemeContext.tsx`):**
```typescript
import { UpdateTheme, UpdateFontSize } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';

useEffect(() => {
  EventsOn('config:theme-changed', (data: any) => {
    setTheme(data.theme);
  });

  EventsOn('config:font-size-changed', (data: any) => {
    setFontSize(data.fontSize);
  });
}, []);
```

**New:**
```typescript
import { UpdateTheme, UpdateFontSize } from './bindings/pubsub-gui/configservice';
import { OnEvent } from '@wailsio/runtime';

useEffect(() => {
  const unsubscribeTheme = OnEvent('config:theme-changed', (data) => {
    setTheme(data.theme);
  });

  const unsubscribeFontSize = OnEvent('config:font-size-changed', (data) => {
    setFontSize(data.fontSize);
  });

  return () => {
    unsubscribeTheme();
    unsubscribeFontSize();
  };
}, []);
```

---

## Testing Plan

### Pre-Migration Testing

Before starting migration, create a test checklist of all features:

- [ ] Connect with ADC
- [ ] Connect with Service Account
- [ ] Connect to Emulator
- [ ] List topics
- [ ] List subscriptions
- [ ] Create topic
- [ ] Delete topic
- [ ] Create subscription
- [ ] Delete subscription
- [ ] Update subscription
- [ ] Publish message
- [ ] Monitor topic
- [ ] Monitor subscription
- [ ] Stop monitoring
- [ ] Save template
- [ ] Update template
- [ ] Delete template
- [ ] Change theme
- [ ] Change font size
- [ ] Edit config file
- [ ] Switch profiles
- [ ] Delete profile

### Post-Migration Testing

After migration, verify all features still work:

#### 1. Connection Testing

```bash
# Test ADC connection
- Open app
- Click "Connect"
- Select "Application Default Credentials"
- Enter project ID
- Verify connection successful
- Verify topics and subscriptions load

# Test Service Account connection
- Disconnect
- Click "Connect"
- Select "Service Account"
- Select JSON key file
- Verify connection successful

# Test Emulator connection
- Disconnect
- Set PUBSUB_EMULATOR_HOST environment variable
- Connect with ADC
- Verify connected to emulator
```

#### 2. Resource Management Testing

```bash
# Test topic operations
- Create new topic
- Verify topic appears in sidebar
- Delete topic
- Verify topic removed from sidebar

# Test subscription operations
- Create new subscription
- Verify subscription appears in sidebar
- Update subscription (ack deadline, retention, etc.)
- Verify changes saved
- Delete subscription
- Verify subscription removed
```

#### 3. Messaging Testing

```bash
# Test publishing
- Select a topic
- Enter message payload
- Add attributes
- Click "Publish"
- Verify message ID returned

# Test monitoring
- Start topic monitor
- Publish messages
- Verify messages appear in monitor
- Stop monitoring
- Verify monitoring stopped
```

#### 4. Configuration Testing

```bash
# Test theme switching
- Open Settings
- Change theme (Dark → Light → Dracula → Monokai)
- Verify theme changes immediately
- Restart app
- Verify theme persists

# Test font size
- Open Settings
- Change font size (Small → Medium → Large)
- Verify font size changes
- Verify Monaco editor font changes

# Test config editor
- Open Advanced Settings
- Edit config JSON
- Save changes
- Verify changes applied
```

#### 5. Performance Testing

```bash
# Measure startup time
- Close app
- Start timer
- Launch app
- Stop timer when window appears
- Compare v2 vs v3 startup time (expect 10-20% faster)

# Measure message throughput
- Start topic monitor
- Publish 100 messages rapidly
- Measure time to display all messages
- Compare v2 vs v3 (expect similar or better)

# Measure memory usage
- Monitor memory with Activity Monitor / Task Manager
- Connect to project
- Load 50+ topics and subscriptions
- Start monitoring multiple subscriptions
- Compare v2 vs v3 memory usage (expect 5-15% lower)
```

#### 6. Multi-Window Testing (New Feature)

```bash
# Test preferences window (if implemented)
- Open Settings
- Verify settings open in new window
- Make changes
- Close settings window
- Verify main window still responsive

# Test multiple monitors (future enhancement)
- Create second monitor window
- Monitor two subscriptions simultaneously
- Verify both update independently
```

### Automated Testing

**Create test script (`scripts/test-migration.sh`):**

```bash
#!/bin/bash

echo "Running Wails v3 migration tests..."

# Build the application
echo "Building application..."
wails3 build
if [ $? -ne 0 ]; then
  echo "Build failed!"
  exit 1
fi

# Check bindings were generated
echo "Checking bindings..."
if [ ! -d "frontend/bindings/pubsub-gui" ]; then
  echo "Bindings not generated!"
  exit 1
fi

# Check for required services
services=("connectionservice" "resourceservice" "monitoringservice" "templateservice" "configservice" "publisherservice")
for service in "${services[@]}"; do
  if [ ! -f "frontend/bindings/pubsub-gui/${service}.js" ]; then
    echo "Missing binding: ${service}.js"
    exit 1
  fi
done

echo "All tests passed!"
```

---

## Rollback Strategy

### If Migration Fails

1. **Immediate Rollback:**
   ```bash
   git checkout main
   git branch -D feature/wails-v3-migration
   ```

2. **Restore from Tag:**
   ```bash
   git checkout v2-backup
   ```

3. **Rebuild v2:**
   ```bash
   wails build
   ```

### Gradual Rollback (Partial Migration)

If some features work but others don't:

1. **Keep v3 structure, use v2 runtime temporarily:**
   - Possible to run v2 and v3 side-by-side (different import paths)
   - Not recommended for production

2. **Feature flags:**
   - Implement feature flags to enable/disable v3 features
   - Gradually enable features as they're validated

---

## Post-Migration Benefits

### Immediate Benefits

1. **Better Code Organization**
   - Services are independent modules
   - Easier to test individual components
   - Clearer separation of concerns

2. **Improved Developer Experience**
   - Better IDE autocomplete
   - Clearer error messages
   - Easier debugging

3. **Performance Improvements**
   - Faster startup (10-20% expected)
   - Lower memory usage (5-15% expected)
   - More efficient bridge calls

### Future Opportunities

1. **Multi-Window Support**
   - Dedicated preferences window
   - Separate monitoring windows for different subscriptions
   - Dashboard window + detail windows

2. **System Tray Integration**
   ```go
   // Future enhancement
   systray := app.NewSystemTray()
   systray.SetIcon(iconBytes)
   systray.SetLabel("Pub/Sub GUI")

   menu := app.NewMenu()
   menu.Add("Show").OnClick(showMainWindow)
   menu.Add("Preferences").OnClick(showPreferencesWindow)
   menu.Add("Quit").OnClick(app.Quit)
   systray.SetMenu(menu)
   ```

3. **Better Plugin System**
   - Services can be dynamically loaded
   - Third-party extensions possible
   - Custom message parsers/formatters

4. **Enhanced Testing**
   - Services can be unit tested independently
   - Mock services for frontend testing
   - Integration tests easier to write

---

## Migration Checklist

### Preparation Phase

- [ ] Create migration branch (`feature/wails-v3-migration`)
- [ ] Create backup tag (`v2-backup`)
- [ ] Document current feature list
- [ ] Run pre-migration tests
- [ ] Take performance baseline measurements

### Dependency Updates

- [ ] Update `go.mod` to use Wails v3
- [ ] Install Wails v3 CLI (`wails3`)
- [ ] Update `wails.json` to v3 format
- [ ] Run `go mod tidy`

### Backend Migration

- [ ] Create `internal/services/` directory
- [ ] Create `ConnectionService`
- [ ] Create `ResourceService`
- [ ] Create `MonitoringService`
- [ ] Create `TemplateService`
- [ ] Create `ConfigService`
- [ ] Create `PublisherService`
- [ ] Update `main.go` with v3 application structure
- [ ] Register all services
- [ ] Remove old `app.go` (or keep as reference)
- [ ] Update handler calls if needed
- [ ] Test backend builds without errors

### Frontend Migration

- [ ] Run `wails3 generate bindings`
- [ ] Verify bindings generated in `frontend/bindings/`
- [ ] Run import update script
- [ ] Manually update service-specific imports
- [ ] Update event handling (EventsOn → OnEvent)
- [ ] Update all component imports
- [ ] Fix any TypeScript errors
- [ ] Test frontend builds without errors

### Testing Phase

- [ ] Run all connection tests
- [ ] Run all resource management tests
- [ ] Run all messaging tests
- [ ] Run all configuration tests
- [ ] Run performance tests
- [ ] Compare v2 vs v3 metrics
- [ ] Test on all target platforms (macOS, Windows, Linux)
- [ ] Test production build

### Finalization

- [ ] Update documentation (CLAUDE.md, README.md)
- [ ] Update build scripts
- [ ] Update CI/CD pipelines (if any)
- [ ] Create PR with detailed migration notes
- [ ] Code review
- [ ] Merge to main
- [ ] Tag release (`v3.0.0` or similar)
- [ ] Create release notes

---

## Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| **Preparation** | 30 minutes | Branching, backup, documentation |
| **Dependency Updates** | 15 minutes | go.mod, wails.json, CLI installation |
| **Backend Migration** | 2-3 hours | Service creation, main.go update, testing |
| **Frontend Migration** | 1-2 hours | Bindings, import updates, testing |
| **Testing** | 1 hour | Comprehensive feature and performance testing |
| **Documentation** | 30 minutes | Update docs and build scripts |
| **Total** | **5-7 hours** | Full migration with testing |

For focused work with no interruptions: **3-4 hours minimum**

---

## Resources

### Official Documentation

- **Wails v3 Documentation**: https://wails.io/docs/next/
- **Migration Guide**: https://wails.io/docs/next/guides/migration
- **API Reference**: https://wails.io/docs/next/reference/
- **Service Pattern**: https://wails.io/docs/next/guides/application/#services

### Community Resources

- **Discord**: https://discord.gg/wails
- **GitHub Discussions**: https://github.com/wailsapp/wails/discussions
- **Examples**: https://github.com/wailsapp/wails/tree/v3/examples

### Project-Specific

- **Current Architecture**: See `CLAUDE.md` sections on "Architecture" and "Backend API Reference"
- **Theme System**: See `.cursor/rules/theme-system.mdc`
- **React Guidelines**: See `.cursor/rules/react-tailwind.mdc`
- **Requirements**: See `PRD.md`

---

## Questions & Answers

### Q: Should we migrate now or wait for v3 stable release?

**A:** Wait for v3 stable unless:
- You need multi-window support urgently
- You're experiencing performance issues in v2
- You want to prepare for future features

**Recommendation:** Start experimenting with v3 in a separate branch now, but don't migrate production until v3.0.0 stable is released.

### Q: Will this break existing user configurations?

**A:** No, the configuration file format (`~/.pubsub-gui/config.json`) remains unchanged. Users won't need to reconfigure.

### Q: Can we run v2 and v3 side-by-side during migration?

**A:** Yes, they use different import paths (`v2` vs `v3`). You can have both in the same codebase temporarily for gradual migration.

### Q: What happens to existing handlers in `internal/app/`?

**A:** They can remain largely unchanged. Services will call handlers with callbacks instead of direct runtime access. Minimal refactoring needed.

### Q: Will the upgrade check feature (from UPGRADE_CHECK_PLAN.md) work in v3?

**A:** Yes, it will work better! The version checking logic can be a separate service with clearer separation:

```go
type UpgradeService struct {
    app *application.Application
}

func (s *UpgradeService) CheckForUpdates() (*version.UpdateInfo, error) {
    // Same logic as before
    updateInfo, err := version.CheckForUpdates()
    if err == nil && updateInfo.IsUpdateAvailable {
        s.app.EmitEvent("upgrade:available", updateInfo)
    }
    return updateInfo, err
}
```

---

## Next Steps

1. **Review this plan** with the team
2. **Wait for v3 stable release** (or start experimenting with alpha/beta)
3. **Create migration branch** when ready to proceed
4. **Follow step-by-step guide** in this document
5. **Test thoroughly** before merging to main
6. **Update documentation** after successful migration

---

**Last Updated:** 2026-01-06
**Status:** Planning Document
**Target Version:** Wails v3.0.0 (when stable)
