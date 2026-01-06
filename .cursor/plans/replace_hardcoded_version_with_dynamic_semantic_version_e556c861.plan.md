---
name: Replace hardcoded version with dynamic semantic version
overview: "Replace the hardcoded \"Milestone 2: Resource Explorer\" string in Sidebar with the actual semantic version from the Go backend, which will be set via build-time ldflags."
todos: []
---

# Replace Hardcoded Version with Dynamic Semantic Version

## Overview

Replace the hardcoded milestone string in the Sidebar footer with the actual application version that's injected at build time via Go ldflags.

## Implementation Steps

### 1. Add version variable in `main.go`

- Add a `version` variable that will be set via ldflags (already configured in `.goreleaser.yaml`)
- Default to "dev" for development builds
- Store it in the App struct so it can be accessed

### 2. Add GetVersion method in `app.go`

- Add a `GetVersion()` method to the `App` struct that returns the version string
- This method will be automatically exposed to the frontend via Wails bindings

### 3. Update `Sidebar.tsx` to fetch and display version

- Import `GetVersion` from `../wailsjs/go/main/App`
- Use `useState` and `useEffect` to fetch the version on component mount
- Replace the hardcoded "Milestone 2: Resource Explorer" text with the dynamic version
- Handle loading state (show placeholder or nothing while fetching)
- Handle errors gracefully (fallback to "dev" or hide version if unavailable)

## Files to Modify

1. **[main.go](main.go)**: Add version variable and pass to App struct
2. **[app.go](app.go)**: Add GetVersion() method
3. **[frontend/src/components/Sidebar.tsx](frontend/src/components/Sidebar.tsx)**: Replace hardcoded string with dynamic version

## Technical Details

- The version will be set via `-X main.version={{.Version}}` ldflag during builds (already configured in `.goreleaser.yaml`)
- For development builds (`wails dev`), version will default to "dev"
- For release builds, version will be the git tag (e.g., "v1.0.0")
- The frontend will fetch the version asynchronously on component mount