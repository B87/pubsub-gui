# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Development Workflow](#development-workflow)
5. [Key Technical Decisions](#key-technical-decisions)
6. [Component Development Guidelines](#component-development-guidelines)
7. [Backend API Reference](#backend-api-reference)
8. [Code Quality & Testing](#code-quality--testing)
9. [Troubleshooting](#troubleshooting)
10. [Additional Resources](#additional-resources)

---

## Project Overview

This is a **Wails v2** desktop application for Google Cloud Pub/Sub management. It combines a **Go backend** (for GCP Pub/Sub API interactions) with a **React + TypeScript frontend** (using Vite). The app provides a GUI for browsing topics, monitoring subscriptions, publishing messages, and working with both production GCP and the local Pub/Sub Emulator.

### Key Features

- **Multi-Project Support**: Connect to multiple GCP projects with saved profiles
- **Real-Time Monitoring**: Stream messages from topics and subscriptions in real-time
- **Message Publishing**: Publish messages with custom attributes and payloads
- **Template System**: Save and reuse message templates
- **Theme Support**: 5 themes (Auto, Dark, Light, Dracula, Monokai) with 3 font sizes
- **Resource Management**: Create, update, and delete topics and subscriptions

**For comprehensive requirements:** See `PRD.md` for detailed product specifications and architecture.

**For theme system details:** See `.cursor/rules/theme-system.mdc` for complete theme documentation.

**For UI development:** See `.cursor/rules/react-tailwind.mdc` for React and styling guidelines.

---

## Quick Start

### Prerequisites

- **Go**: 1.21+ (for backend development)
- **Node.js**: 18+ (for frontend development)
- **Wails CLI**: v2.11.0+ (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- **GCP Account**: For testing with real Pub/Sub (optional - can use emulator)

### First-Time Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd pubsub-gui

# 2. Install dependencies
wails doctor  # Verify Wails setup
cd frontend && npm install && cd ..

# 3. Run in development mode
wails dev

# The app will open automatically
# Dev server runs on http://localhost:34115 for browser debugging
```

### Development Workflow

```bash
# Development (hot reload enabled)
wails dev

# Build for current platform
wails build

# Build for specific platforms
wails build -platform darwin/universal    # macOS (Intel + Apple Silicon)
wails build -platform windows/amd64       # Windows 64-bit
wails build -platform linux/amd64         # Linux 64-bit

# Build artifacts go to build/bin/
```

### Frontend-Only Development

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Run Vite dev server (without Go backend)
npm run dev

# Build frontend only (outputs to frontend/dist)
npm run build

# Preview production build
npm run preview
```

**Note:** Frontend-only mode is useful for UI development, but Wails bindings won't work without the Go backend.

### Backend Development

```bash
# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Format code (run before committing)
go fmt ./...

# Lint code (if golangci-lint installed)
golangci-lint run

# Update dependencies
go mod tidy

# Add new dependency
go get <package>
```

## Architecture

### Backend (Go)

**Entry Point:** `main.go` creates the Wails app and binds the `App` struct from `app.go`.

**Current Structure:**
- `app.go`: Main application struct with Go methods exposed to frontend via Wails bindings (delegates to handlers)
- `main.go`: Wails initialization, window configuration, asset server setup
- `internal/app/`: Handler structs organizing methods by domain:
  - `connection.go`: ConnectionHandler for connection and profile management
  - `resources.go`: ResourceHandler for topic and subscription CRUD operations
  - `monitoring.go`: MonitoringHandler for message monitoring and streaming
  - `config.go`: ConfigHandler for configuration management (theme, font size, auto-ack)
  - `templates.go`: TemplateHandler for message template management
- `internal/auth/`: GCP authentication (ADC, Service Account, OAuth)
- `internal/config/`: Local configuration persistence
- `internal/pubsub/`:
  - `admin/`: List topics/subscriptions, fetch metadata
  - `publisher/`: Publish messages with attributes
  - `subscriber/`: Message streaming and monitoring
- `internal/models/`: Shared data structures

### Frontend (React + TypeScript)

**Build Tool:** Vite with `@vitejs/plugin-react`

**Current Structure:**
- `frontend/src/App.tsx`: Main React component
- `frontend/src/main.tsx`: React entry point
- `frontend/wailsjs/`: Auto-generated Go bindings (DO NOT EDIT)

**Planned Structure (per PRD.md):**
```
frontend/src/
├── components/
│   ├── Sidebar/              # Project selector + resource tree
│   ├── TopicDetails/         # Topic metadata + publish form
│   ├── SubscriptionMonitor/  # Message stream viewer
│   └── MessageCard/          # Individual message display
├── contexts/
│   ├── AuthContext.tsx       # Authentication state
│   └── PubSubContext.tsx     # Active project/resources
├── hooks/
│   └── useMessageStream.ts   # WebSocket-like message handling
└── App.tsx
```

### Wails Communication Pattern

**Frontend → Backend (Method Calls):**
```typescript
import { Greet } from "../wailsjs/go/main/App";

// Call Go method
const result = await Greet(name);
```

**Backend → Frontend (Events):**
```go
import "github.com/wailsapp/wails/v2/pkg/runtime"

// Emit event to frontend
runtime.EventsEmit(a.ctx, "message:received", message)
```

**Frontend Event Listening:**
```typescript
import { EventsOn } from "../wailsjs/runtime/runtime";

EventsOn("message:received", (data) => {
  // Handle event
});
```

### Wails Binding Generation

**Important:** The `frontend/wailsjs/` directory contains **auto-generated** TypeScript bindings for Go methods. These are generated when you run `wails dev` or `wails build`.

**When Adding New Go Methods:**

1. **Add the method to `app.go`** - Methods on the `App` struct are automatically exposed to the frontend
2. **Run `wails dev`** - This generates the TypeScript bindings in `frontend/wailsjs/go/main/App.js` and `App.d.ts`
3. **Import and use** - Import the new method from `wailsjs/go/main/App` in your React components

**During Development (Before Bindings Are Generated):**

If you need to use a new method before running `wails dev`, you can declare it temporarily to avoid TypeScript errors:

```typescript
// These functions will be generated by Wails when the app runs
// Declare them here to avoid TypeScript errors during development
declare const NewMethodName: (param: string) => Promise<ReturnType>;
```

**Note:** After running `wails dev`, you can remove the `declare` statements and import normally. The generated bindings will provide full type safety.

**DO NOT EDIT** files in `frontend/wailsjs/` - they are auto-generated and will be overwritten.

## Key Technical Decisions

### Authentication
- Support Application Default Credentials (ADC) as default
- Support Service Account JSON key files
- Detect `PUBSUB_EMULATOR_HOST` environment variable for local emulator
- Store connection profiles in `~/.pubsub-gui/config.json`

### Message Handling
- Auto-acknowledge messages by default (prevent redelivery storms)
- Buffer last 500 messages in memory (configurable)
- Use Go concurrency for streaming pull (goroutines + channels)
- Emit messages to frontend via Wails events for real-time updates

### Resource Synchronization & Caching
- **Background Sync Model**: Resources (topics, subscriptions) are fetched once and cached locally in the backend
- **Parallel Fetching**: Topics and subscriptions are fetched simultaneously using goroutines for faster initial load
- **Event-Driven Updates**: Backend emits `resources:updated` event when resources change, frontend updates state automatically
- **Local Filtering**: Frontend filters relationships locally using `useMemo` hooks for instant UI updates (no API roundtrips)
- **Automatic Invalidation**: Cache is refreshed automatically after mutations (create/delete/update operations)
- **Performance Benefits**: Reduces API calls by ~90%, makes navigation between resources instant

### UI Libraries (Planned per PRD.md)
- **Radix UI + Tailwind CSS**: Accessible components, rapid styling
- **Monaco Editor** (optional): JSON payload editing with syntax highlighting

### Theme System
- **5 Themes**: Auto (system preference), Dark (default), Light, Dracula, Monokai
- **3 Font Sizes**: Small, Medium (default), Large - independent of theme selection
- **CSS Custom Properties**: All themes use CSS variables for runtime switching without component changes
- **Monaco Integration**: Editor themes automatically match application theme
- **Configuration**: Users edit `~/.pubsub-gui/config.json` via ConfigEditorDialog
- **Backward Compatible**: Existing Tailwind classes (e.g., `bg-slate-900`) map to theme variables
- **Event-Driven**: Backend emits `config:theme-changed` and `config:font-size-changed` events
- **System Integration**: Auto theme respects OS dark/light mode preference via `prefers-color-scheme`

**Architecture:**
```
Backend (Go):
- internal/models/connection.go: AppConfig.Theme, AppConfig.FontSize
- app.go: Validation and event emission

Frontend (React):
- frontend/src/themes.css: Theme color palettes (CSS variables)
- frontend/src/contexts/ThemeContext.tsx: Theme orchestration
- frontend/src/hooks/useTheme.ts: Theme access hook
- frontend/src/types/theme.ts: TypeScript definitions
- frontend/src/utils/monacoThemes.ts: Monaco Editor themes
```

**Color Palette Structure:**
Each theme defines semantic color tokens:
- Backgrounds: `--color-bg-primary/secondary/tertiary`
- Text: `--color-text-primary/secondary/tertiary/muted`
- Borders: `--color-border-primary/secondary`
- Accent: `--color-accent-primary/hover/active`
- Status: `--color-success/error/warning` (with variants)

**Usage Pattern:**
```tsx
// Components use theme via context
import { useTheme } from '../hooks/useTheme';

function MyComponent() {
  const { theme, fontSize, effectiveTheme, monacoTheme } = useTheme();

  // Existing Tailwind classes work automatically (mapped to CSS variables)
  return <div className="bg-slate-900 text-slate-100">Content</div>;
}
```

**Monaco Editor Integration:**
```tsx
import { useTheme } from '../hooks/useTheme';
import { registerCustomThemes } from '../utils/monacoThemes';

const { monacoTheme, fontSize } = useTheme();
const fontSizeMap = { small: 12, medium: 14, large: 16 };

// Register custom themes on mount
handleEditorDidMount = (editor, monaco) => {
  registerCustomThemes(monaco); // Registers Dracula + Monokai
};

<Editor
  theme={monacoTheme}           // Dynamic: vs-light, vs-dark, dracula, monokai
  options={{ fontSize: fontSizeMap[fontSize] }}
/>
```

**Theme Switching:**
Users change themes by editing config via ConfigEditorDialog. Changes apply instantly without app reload. Theme preference persists across restarts.

See `.cursor/rules/theme-system.mdc` for comprehensive documentation.

---

## Development Workflow

### Adding New Backend Methods

When creating new Go methods for the frontend to call:

1. **Define the method on the `App` struct** in `app.go`:
   ```go
   func (a *App) MyNewMethod(param string) (string, error) {
       // Implementation
       return result, nil
   }
   ```

2. **Run `wails dev`** to generate TypeScript bindings

3. **Import and use in React**:
   ```typescript
   import { MyNewMethod } from '../wailsjs/go/main/App';

   const result = await MyNewMethod("test");
   ```

### Adding New Components

When creating new React components:

1. **Check theme system requirements** (see `.cursor/rules/react-tailwind.mdc`)
2. **Use semantic CSS variables** (preferred) or mapped Tailwind classes
3. **Test with all 5 themes** (Auto, Dark, Light, Dracula, Monokai)
4. **Ensure accessibility** (ARIA labels, keyboard navigation)

Example component structure:
```tsx
import { useTheme } from '../hooks/useTheme';

export default function MyComponent() {
  const { theme, fontSize } = useTheme();

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        color: 'var(--color-text-primary)',
      }}
      className="border border-slate-700 rounded-lg p-4"
    >
      {/* Content */}
    </div>
  );
}
```

### Emitting Events from Backend

For real-time updates (e.g., message streams):

```go
import "github.com/wailsapp/wails/v2/pkg/runtime"

// In your App method
runtime.EventsEmit(a.ctx, "event:name", payload)
```

Listen in frontend:
```typescript
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';

useEffect(() => {
  const unsubscribe = EventsOn("event:name", (data) => {
    console.log("Received:", data);
  });

  return () => EventsOff("event:name");
}, []);
```

### Working with Concurrency

The app uses Go concurrency heavily. Key patterns:

**Resource Synchronization:**
```go
// Always lock when accessing shared state
a.resourceMu.RLock()
topics := a.topics
a.resourceMu.RUnlock()

// Initialize to empty slices, not nil (prevents race conditions)
a.topics = []admin.TopicInfo{}
a.subscriptions = []admin.SubscriptionInfo{}
```

**Message Streaming:**
```go
// Use goroutines with proper cleanup
go func() {
    for {
        select {
        case msg := <-messageChan:
            runtime.EventsEmit(a.ctx, "message:received", msg)
        case <-ctx.Done():
            return
        }
    }
}()
```

---

## Component Development Guidelines

### Theme System Requirements

**CRITICAL**: All components MUST support the theme system. See `.cursor/rules/react-tailwind.mdc` for full guidelines.

**Core Requirements:**
1. **NEVER use hardcoded colors** (e.g., `#1a1a1a`, `rgb(255,0,0)`)
2. **PRIORITIZE semantic CSS variables** over Tailwind classes
3. **Test with all 5 themes** before committing

**Approved Styling Approaches:**

**Option 1: Semantic CSS Variables (Preferred)**
```tsx
<div
  style={{
    backgroundColor: 'var(--color-bg-secondary)',
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-border-primary)',
  }}
>
```


### Component Structure

**Standard Component Template:**
```tsx
import { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';

interface MyComponentProps {
  data: string;
  onAction: () => void;
}

export default function MyComponent({ data, onAction }: MyComponentProps) {
  const { theme, fontSize } = useTheme();
  const [localState, setLocalState] = useState('');

  useEffect(() => {
    // Setup and cleanup
    return () => {
      // Cleanup
    };
  }, []);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
      }}
      className="rounded-lg border border-slate-700 p-4"
    >
      {/* Component content */}
    </div>
  );
}
```

### Performance Considerations

**Virtual Scrolling:**
For lists with 100+ items, use `@tanstack/react-virtual`:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48, // Row height
  overscan: 10,
});
```

**Memoization:**
Use `useMemo` for expensive computations:

```tsx
const filteredItems = useMemo(() => {
  return items.filter(item => item.name.includes(searchQuery));
}, [items, searchQuery]);
```

### Accessibility Checklist

- [ ] All interactive elements have `aria-label` or visible text
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus states are visible
- [ ] Color contrast meets WCAG AA (4.5:1 for normal text)
- [ ] Error messages are announced to screen readers

---

## Backend API Reference

### Core App Methods

All methods are on the `App` struct in `app.go` and exposed to frontend via Wails.

#### Connection Management

```go
func (a *App) ConnectWithADC(projectID string) error
```
Connects to GCP project using Application Default Credentials. Validates credentials and initializes Pub/Sub client.

```go
func (a *App) ConnectWithServiceAccount(projectID, keyPath string) error
```
Connects to GCP project using a service account JSON key file. Validates credentials and initializes Pub/Sub client.

```go
func (a *App) ConnectWithOAuth(projectID, oauthClientPath string) error
```
Connects to GCP project using OAuth2 credentials. Opens browser for authentication and stores encrypted tokens.

```go
func (a *App) Disconnect() error
```
Disconnects from current project. Cleans up clients and stops monitoring.

```go
func (a *App) GetConnectionStatus() app.ConnectionStatus
```
Returns current connection status including project ID, auth method, and emulator host.

#### Profile Management

```go
func (a *App) GetProfiles() []models.ConnectionProfile
```
Returns all saved connection profiles.

```go
func (a *App) SaveProfile(profile models.ConnectionProfile) error
```
Saves a connection profile to the configuration.

```go
func (a *App) DeleteProfile(profileID string) error
```
Deletes a connection profile. Disconnects if the deleted profile was active.

```go
func (a *App) SwitchProfile(profileID string) error
```
Switches to a different connection profile. Disconnects from current connection and connects using the new profile.

#### Resource Management

```go
func (a *App) SyncResources() error
```
Fetches all topics and subscriptions from GCP. Uses goroutines for parallel fetching. Emits `resources:updated` event.

```go
func (a *App) ListTopics() ([]admin.TopicInfo, error)
```
Returns cached topic list from synchronized store. Call `SyncResources()` first to refresh.

```go
func (a *App) ListSubscriptions() ([]admin.SubscriptionInfo, error)
```
Returns cached subscription list from synchronized store. Call `SyncResources()` first to refresh.

```go
func (a *App) GetTopicMetadata(topicID string) (admin.TopicInfo, error)
```
Retrieves metadata for a specific topic.

```go
func (a *App) GetSubscriptionMetadata(subID string) (admin.SubscriptionInfo, error)
```
Retrieves metadata for a specific subscription.

```go
func (a *App) CreateTopic(topicID string, messageRetentionDuration string) error
```
Creates a new topic with optional message retention duration. Auto-refreshes resource cache.

```go
func (a *App) DeleteTopic(topicID string) error
```
Deletes a topic. Auto-refreshes resource cache.

```go
func (a *App) CreateSubscription(topicID string, subID string, ttlSeconds int64) error
```
Creates a new subscription for a topic with TTL. Auto-refreshes resource cache.

```go
func (a *App) UpdateSubscription(subID string, params SubscriptionUpdateParams) error
```
Updates a subscription's configuration (ack deadline, retention duration, filter, dead letter policy, push config). Auto-refreshes resource cache.

```go
func (a *App) DeleteSubscription(subscriptionID string) error
```
Deletes a subscription. Auto-refreshes resource cache.

#### Message Operations

```go
func (a *App) PublishMessage(topicID, payload string, attributes map[string]string) (PublishResult, error)
```
Publishes a message to a topic. Returns `PublishResult` containing message ID and timestamp.

```go
func (a *App) StartTopicMonitor(topicID string, subscriptionID string) error
```
Starts monitoring a topic. If `subscriptionID` is empty, creates temporary subscription. Emits `message:received` events.

```go
func (a *App) StopTopicMonitor(topicID string) error
```
Stops monitoring a topic. Cleans up temporary subscription if created.

```go
func (a *App) StartMonitor(subscriptionID string) error
```
Starts monitoring a subscription. Emits `message:received` events.

```go
func (a *App) StopMonitor(subscriptionID string) error
```
Stops monitoring a subscription.

```go
func (a *App) GetBufferedMessages(subscriptionID string) ([]subscriber.PubSubMessage, error)
```
Returns all messages in the buffer for a subscription.

```go
func (a *App) ClearMessageBuffer(subscriptionID string) error
```
Clears the message buffer for a subscription.

#### Templates

```go
func (a *App) GetTemplates(topicID string) ([]models.MessageTemplate, error)
```
Returns all templates, optionally filtered by topicID. If topicID is empty, returns all templates. If provided, returns templates linked to that topic + global templates.

```go
func (a *App) SaveTemplate(template models.MessageTemplate) error
```
Saves a message template to the configuration.

```go
func (a *App) UpdateTemplate(templateID string, template models.MessageTemplate) error
```
Updates an existing template.

```go
func (a *App) DeleteTemplate(templateID string) error
```
Deletes a template from the configuration.

#### Configuration

```go
func (a *App) GetConfigFileContent() (string, error)
```
Returns raw JSON content of the config file.

```go
func (a *App) SaveConfigFileContent(content string) error
```
Saves raw JSON content to the config file. Validates theme and font size values.

```go
func (a *App) UpdateTheme(theme string) error
```
Updates theme setting. Emits `config:theme-changed` event. Valid values: `auto`, `dark`, `light`, `dracula`, `monokai`.

```go
func (a *App) UpdateFontSize(fontSize string) error
```
Updates font size setting. Emits `config:font-size-changed` event. Valid values: `small`, `medium`, `large`.

```go
func (a *App) GetAutoAck() (bool, error)
```
Returns current auto-acknowledge setting.

```go
func (a *App) SetAutoAck(enabled bool) error
```
Updates auto-acknowledge setting.

```go
func (a *App) GetConfigFileContent() (string, error)
```
Returns raw JSON content of the config file.

```go
func (a *App) SaveConfigFileContent(content string) error
```
Saves raw JSON content to the config file. Validates theme and font size values.

### Frontend Events

Events emitted from backend that frontend can listen to:

| Event Name | Payload Type | Description |
|------------|--------------|-------------|
| `resources:updated` | `{ topics?: [], subscriptions?: [] }` | Fired when resource cache is refreshed (may include partial data) |
| `resources:sync-error` | `{ errors: { topics?: string, subscriptions?: string } }` | Error during resource synchronization (partial failures) |
| `message:received` | `models.PubSubMessage` | New message received during monitoring (topic or subscription) |
| `monitor:started` | `{ subscriptionID: string }` | Monitoring started for a subscription |
| `monitor:stopped` | `{ subscriptionID: string }` | Monitoring stopped for a subscription |
| `monitor:error` | `{ subscriptionID: string, error: string }` | Error during monitoring |
| `topic:created` | `{ topicID: string }` | Topic created |
| `topic:deleted` | `{ topicID: string }` | Topic deleted |
| `subscription:created` | `{ subscriptionID: string }` | Subscription created |
| `subscription:updated` | `{ subscriptionID: string }` | Subscription updated |
| `subscription:deleted` | `{ subscriptionID: string }` | Subscription deleted |
| `connection:success` | `{ projectId: string, authMethod: string }` | Connection established successfully |
| `config:theme-changed` | `string` | Theme setting changed (value is the theme name) |
| `config:font-size-changed` | `string` | Font size setting changed (value is the font size) |

**Event Listening Pattern:**
```typescript
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';

useEffect(() => {
  const handler = (data) => {
    console.log("Received:", data);
  };

  EventsOn("event:name", handler);

  return () => {
    EventsOff("event:name");
  };
}, []);
```

---

## Code Quality & Testing

### Codacy Integration

This project uses Codacy MCP Server integration. **After editing any file:**

1. **Run analysis:**
   ```bash
   codacy_cli_analyze --file <path-to-file>
   ```

2. **Fix any issues found** before proceeding

3. **Check dependencies for vulnerabilities:**
   ```bash
   codacy_cli_analyze --tool trivy
   ```

### Testing Guidelines

**Backend Tests:**
```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific package
go test ./internal/auth/...

# Verbose output
go test -v ./...
```

**Frontend Tests:**
```bash
cd frontend

# Run tests (if configured)
npm test

# Run with coverage
npm test -- --coverage
```

### Code Quality Checklist

Before committing:
- [ ] Run `go fmt ./...` on Go code
- [ ] Run `codacy_cli_analyze` on modified files
- [ ] Verify no hardcoded colors in React components
- [ ] Test with all 5 themes
- [ ] Run `go test ./...` if backend changes
- [ ] Check for race conditions in concurrent code
- [ ] Verify proper error handling

---

## Troubleshooting

### Common Errors

#### "subscriptions not yet synced"

**Cause:** Race condition - monitoring started before `SyncResources()` completed.

**Fix:** The code now initializes resource slices to empty arrays instead of `nil`. If you still see this:
1. Ensure you're calling `SyncResources()` after connecting
2. Wait for `resources:updated` event before monitoring

#### "failed to create temporary subscription"

**Cause:** Insufficient IAM permissions or topic doesn't exist.

**Fix:**
1. Verify service account has `roles/pubsub.editor` or `roles/pubsub.subscriber`
2. Confirm topic exists with `GetTopics()`
3. Check GCP project ID is correct

#### TypeScript errors for new Go methods

**Cause:** Wails bindings not yet generated.

**Fix:**
1. Run `wails dev` to generate bindings
2. Or add temporary `declare` statement (see [Wails Binding Generation](#wails-binding-generation))

#### Theme colors not applying

**Cause:** Component using hardcoded colors or unmapped Tailwind classes.

**Fix:**
1. Replace hardcoded hex/rgb colors with CSS variables
2. Use only [approved Tailwind classes](.cursor/rules/react-tailwind.mdc)
3. Add missing mappings to `frontend/src/themes.css` if needed

#### Build fails with "command not found: wails"

**Cause:** Wails CLI not installed or not in PATH.

**Fix:**
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Add Go bin to PATH if needed
export PATH=$PATH:$(go env GOPATH)/bin
```

### Performance Issues

#### Slow message rendering

**Solution:** Use virtual scrolling. See [TopicMonitor.tsx:57-62](/Users/bernat/vms/personal/pubsub-gui/frontend/src/components/TopicMonitor.tsx#L57-L62) for implementation.

#### High memory usage during monitoring

**Cause:** Message buffer growing unbounded.

**Fix:** The app limits to 500 messages by default. Adjust in backend if needed:
```go
const maxBufferSize = 500
if len(messages) > maxBufferSize {
    messages = messages[:maxBufferSize]
}
```

#### Slow resource sync

**Solution:** The app already uses parallel fetching. If still slow:
1. Check network latency to GCP
2. Verify not rate-limited by GCP APIs
3. Consider caching with longer TTL

### Debugging Tips

**Enable Dev Tools in Wails:**
```bash
# Dev mode automatically opens Chrome DevTools
wails dev

# Access in browser for more tools
# Open: http://localhost:34115
```

**Debug Go Backend:**
```go
// Add logging
import "log"

log.Printf("Debug: %+v", variable)
```

**Debug Race Conditions:**
```bash
# Run with race detector
go test -race ./...

# Build with race detector
go build -race
```

**Debug Frontend Events:**
```typescript
import { EventsOn } from '../wailsjs/runtime/runtime';

// Log all events
EventsOn("*", (eventName, data) => {
  console.log(`Event: ${eventName}`, data);
});
```

---

## Additional Resources

### Configuration Files

- **`wails.json`**: Wails project configuration (build commands, app metadata)
- **`go.mod`**: Go dependencies (currently Wails v2.11.0, GCP libraries)
- **`frontend/package.json`**: Frontend dependencies (React 18, Vite 3, TypeScript 4)
- **`frontend/tsconfig.json`**: TypeScript compiler options
- **`~/.pubsub-gui/config.json`**: User configuration (connection profiles, theme, font size)

### Documentation Files

- **`PRD.md`**: Product Requirements Document - comprehensive feature specifications
- **`.cursor/rules/theme-system.mdc`**: Complete theme system documentation
- **`.cursor/rules/react-tailwind.mdc`**: React and styling guidelines (MUST READ for UI work)

### IAM Permissions Required

For production GCP usage, service accounts need:
- **`roles/pubsub.viewer`**: List topics and subscriptions
- **`roles/pubsub.publisher`**: Publish messages to topics
- **`roles/pubsub.subscriber`**: Pull messages from subscriptions

**Recommended:** `roles/pubsub.editor` for dev environments (combines all above)

### Platform-Specific Notes

- **macOS**: Builds universal binaries (Intel + Apple Silicon), requires macOS 10.13+
- **Windows**: Requires Windows 10+, uses WebView2 (auto-installed)
- **Linux**: Targets Ubuntu 20.04+, outputs `.AppImage` and `.deb`

Build artifacts go to `build/bin/`

### External Dependencies

**Backend (Go):**
- `github.com/wailsapp/wails/v2` - Desktop app framework
- `cloud.google.com/go/pubsub` - GCP Pub/Sub client
- `google.golang.org/api` - GCP API support

**Frontend (React):**
- `react` v18 - UI library
- `@tanstack/react-virtual` - Virtual scrolling
- `@monaco-editor/react` - Code editor
- `tailwindcss` v4 - Utility CSS

### Getting Help

1. **Check this file** for common patterns and troubleshooting
2. **Review `.cursor/rules/react-tailwind.mdc`** for UI guidelines
3. **Check `PRD.md`** for feature requirements
4. **Search codebase** for similar implementations
5. **Check Wails docs**: https://wails.io/docs/

---

**Last Updated:** 2026-01-06
