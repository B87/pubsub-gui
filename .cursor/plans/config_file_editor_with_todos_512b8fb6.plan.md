---
name: Config File Editor with Todos
overview: Add a config file editor UI that allows users to directly view and edit the ~/.pubsub-gui/config.json file through a modal dialog with JSON validation and syntax highlighting.
todos:
  - id: backend-methods
    content: Implement GetConfigFileContent and SaveConfigFileContent in app.go
    status: completed
  - id: frontend-component
    content: Create ConfigEditorDialog.tsx component with JSON validation
    status: completed
  - id: sidebar-button
    content: Add settings button to Sidebar.tsx footer
    status: completed
  - id: app-integration
    content: Wire up dialog state and handlers in App.tsx
    status: completed
  - id: validation-theme
    content: Implement config reload and theme application logic in backend
    status: completed
  - id: testing
    content: Test the complete config editing flow
    status: completed
---

# Config File Editor Implementation

## Overview

Add a config file editor UI that allows users to directly view and edit the `~/.pubsub-gui/config.json` file. The editor will provide JSON validation, syntax highlighting, and safe saving with validation.

## Current State Analysis

### Config File Structure

The config file (`~/.pubsub-gui/config.json`) contains:

- `profiles`: Array of connection profiles
- `activeProfileId`: Currently active profile ID
- `messageBufferSize`: Message buffer size (default: 500)
- `autoAck`: Auto-acknowledge setting (default: true)
- `theme`: UI theme - "light" | "dark" | "auto" (default: "auto")
- `templates`: Array of message templates

### Current Implementation

- Config is managed by `internal/config/manager.go` with `LoadConfig()` and `SaveConfig()` methods
- Config is loaded at app startup in `app.go`
- No UI exists for viewing or editing the config file directly

## Implementation Plan

### 1. Backend: Add Config File Methods (`app.go`)

Add methods to read and write the raw config file:

```go
// GetConfigFileContent returns the raw JSON content of the config file
func (a *App) GetConfigFileContent() (string, error)

// SaveConfigFileContent saves the raw JSON content to the config file
func (a *App) SaveConfigFileContent(content string) error
```

### 2. Frontend: Create ConfigEditorDialog Component (`frontend/src/components/ConfigEditorDialog.tsx`)

Create a new modal dialog component for editing the config file:

**Features:**

- Large textarea with monospace font
- JSON syntax validation (real-time)
- Save/Cancel buttons
- Error display for validation failures
- Warning message about editing config file

### 3. Frontend: Add Config Editor Button to Sidebar (`frontend/src/components/Sidebar.tsx`)

Add a button in the sidebar footer to open the config editor:

- Positioned in the footer area for easy access
- Gear/settings icon button

### 4. Frontend: Integrate ConfigEditorDialog in App (`frontend/src/App.tsx`)

- Add state for dialog open/close
- Wire up the config editor button from Sidebar
- Handle config reload after save

## Implementation Todos

- [ ] **Implement Backend Methods**: Create `GetConfigFileContent` and `SaveConfigFileContent` in `app.go` with proper validation and error handling. (id: `backend-methods`)
- [ ] **Create Frontend Component**: Implement `ConfigEditorDialog.tsx` with a validation-aware textarea and standard dialog layout. (id: `frontend-component`)
- [ ] **Update Sidebar UI**: Add the settings/config button to the `Sidebar.tsx` footer. (id: `sidebar-button`)
- [ ] **Integrate in App**: Wire up the dialog state and handlers in `App.tsx` to enable the full flow. (id: `app-integration`)
- [ ] **Validation & Theme Logic**: Ensure `SaveConfigFileContent` reloads the config and applies theme changes immediately using Wails runtime. (id: `validation-theme`)
- [ ] **End-to-End Testing**: Verify that editing the JSON correctly updates the file and triggers UI updates (like theme changes). (id: `testing`)