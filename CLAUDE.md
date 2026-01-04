# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Wails v2** desktop application for Google Cloud Pub/Sub management. It combines a **Go backend** (for GCP Pub/Sub API interactions) with a **React + TypeScript frontend** (using Vite). The app provides a GUI for browsing topics, monitoring subscriptions, publishing messages, and working with both production GCP and the local Pub/Sub Emulator.

See PRD.md for comprehensive product requirements and architecture.

## Development Commands

### Building and Running

```bash
# Live development mode (hot reload frontend, run Go backend)
wails dev

# Build production binary for current platform
wails build

# Build for specific platforms
wails build -platform darwin/universal    # macOS universal binary
wails build -platform windows/amd64       # Windows
wails build -platform linux/amd64         # Linux
```

The dev server runs on http://localhost:34115 for browser-based debugging with access to Go methods.

### Frontend Commands

```bash
cd frontend

# Install dependencies
npm install

# Run Vite dev server (standalone, without Wails)
npm run dev

# Build frontend only (outputs to frontend/dist)
npm run build

# Preview production build
npm run preview
```

### Go Commands

```bash
# Run tests
go test ./...

# Format code
go fmt ./...

# Update dependencies
go mod tidy

# Add new dependency
go get <package>
```

## Architecture

### Backend (Go)

**Entry Point:** `main.go` creates the Wails app and binds the `App` struct from `app.go`.

**Current Structure:**
- `app.go`: Main application struct with Go methods exposed to frontend via Wails bindings
- `main.go`: Wails initialization, window configuration, asset server setup

**Planned Structure (per PRD.md):**
```
internal/
├── app/              # Wails app initialization and bindings
├── auth/             # GCP authentication (ADC + JSON key)
├── config/           # Local configuration persistence
├── pubsub/
│   ├── admin/        # List topics/subscriptions, fetch metadata
│   ├── publisher/    # Publish messages with attributes
│   └── subscriber/   # Streaming pull with backpressure control
└── models/           # Shared data structures
```

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

### UI Libraries (Planned per PRD.md)
- **Radix UI + Tailwind CSS**: Accessible components, rapid styling
- **Monaco Editor** (optional): JSON payload editing with syntax highlighting

## Configuration Files

- `wails.json`: Wails project configuration (frontend build commands, author info)
- `go.mod`: Go dependencies (currently Wails v2.11.0)
- `frontend/package.json`: Frontend dependencies (React 18, Vite 3, TypeScript 4)
- `frontend/tsconfig.json`: TypeScript compiler options

## Code Quality Rules (Codacy)

This project uses Codacy MCP Server integration. After editing any file:
1. Run `codacy_cli_analyze` for the edited file
2. Fix any issues found before proceeding
3. After adding dependencies, run `codacy_cli_analyze` with `tool: "trivy"` to check for security vulnerabilities

## IAM Permissions Required

For production GCP usage, service accounts need:
- `roles/pubsub.viewer`: List topics and subscriptions
- `roles/pubsub.publisher`: Publish messages to topics
- `roles/pubsub.subscriber`: Pull messages from subscriptions

Recommended: `roles/pubsub.editor` for dev environments (combines all above)

## Platform-Specific Notes

- **macOS**: Builds universal binaries (Intel + Apple Silicon)
- **Windows**: Requires Windows 10+, uses WebView2
- **Linux**: Targets Ubuntu 20.04+, outputs `.AppImage`

Build artifacts go to `build/bin/`
