---
name: Test app.go with emulator support
overview: Create comprehensive test suite for app.go following Go testing best practices, including unit tests for delegation methods and integration tests using the Pub/Sub emulator for real GCP operations.
todos:
  - id: setup-test-infrastructure
    content: Create test directory structure and helper files. Create test/ directory with helpers.go and emulator.go. Implement StartEmulator() function that starts gcloud emulator and returns cleanup function. Implement SetupTestApp() helper that creates App instance with emulator configured. Add test fixtures directory with sample config.json.
    status: pending
  - id: add-cmp-dependency
    content: Add github.com/google/go-cmp/cmp package to go.mod for test comparisons. Run 'go get github.com/google/go-cmp/cmp' and verify it's added to go.mod.
    status: pending
  - id: create-mock-handlers
    content: Create mock handler structs in app_test.go for testing delegation. Implement mockConnectionHandler, mockResourceHandler, mockTemplateHandler, mockMonitoringHandler, and mockConfigHandler with function fields to control behavior. Each mock should implement the same interface as real handlers.
    status: pending
    dependencies:
      - setup-test-infrastructure
  - id: test-newapp
    content: Write TestNewApp() table-driven test. Test that NewApp() initializes activeMonitors and topicMonitors maps correctly. Verify topics and subscriptions are initialized as empty slices (not nil).
    status: pending
    dependencies:
      - setup-test-infrastructure
  - id: test-version-methods
    content: "Write TestSetVersion() and TestGetVersion() table-driven tests. Test cases: empty version returns \"dev\", set version returns correct value, version persists across calls. Use table-driven test pattern with clear test case names."
    status: pending
    dependencies:
      - setup-test-infrastructure
  - id: test-connection-status
    content: Write TestGetConnectionStatus() using mock connection handler. Verify delegation to connection handler. Test both connected and disconnected states. Use cmp package for structure comparison.
    status: pending
    dependencies:
      - create-mock-handlers
  - id: test-delegation-methods
    content: Write unit tests for all delegation methods using mocks. Test ConnectWithADC, ConnectWithServiceAccount, GetProfiles, SaveProfile, DeleteProfile, SwitchProfile, ListTopics, ListSubscriptions, GetTopicMetadata, GetSubscriptionMetadata, CreateTopic, DeleteTopic, CreateSubscription, DeleteSubscription, UpdateSubscription, GetTemplates, SaveTemplate, UpdateTemplate, DeleteTemplate, StartMonitor, StopMonitor, StartTopicMonitor, StopTopicMonitor, GetBufferedMessages, ClearMessageBuffer, SetAutoAck, GetAutoAck, UpdateTheme, UpdateFontSize, GetConfigFileContent. Verify each method calls the correct handler with correct parameters and returns handler's result.
    status: pending
    dependencies:
      - create-mock-handlers
  - id: test-publish-message-unit
    content: Write TestPublishMessage() unit test with mock client manager. Test error case when not connected (returns ErrNotConnected). Test successful delegation to publisher. Verify PublishResult conversion from publisher.PublishResult to app.PublishResult. Use cmp for result comparison.
    status: pending
    dependencies:
      - create-mock-handlers
  - id: test-disconnect-unit
    content: Write TestDisconnect() unit test. Test that Disconnect() stops all active monitors, cleans up topic monitors map, clears resource cache (topics and subscriptions set to empty slices), and closes client manager. Test with nil client (should not panic). Use mocks for streamers.
    status: pending
    dependencies:
      - create-mock-handlers
  - id: test-startup-unit
    content: Write TestStartup() unit test with mocked dependencies. Test handler initialization order (resources first, then connection). Test config loading (success and failure cases). Test auto-connect to active profile (success and failure). Verify handlers are initialized with correct dependencies. Use temp directory for config.
    status: pending
    dependencies:
      - create-mock-handlers
  - id: test-save-config-file-content
    content: Write TestSaveConfigFileContent() unit test. Test JSON validation, config structure validation (messageBufferSize, theme, fontSize), config save and reload, config reference update in App struct. Test error cases (invalid JSON, invalid values). Verify config is reloaded after successful save.
    status: pending
    dependencies:
      - create-mock-handlers
  - id: test-connect-with-emulator
    content: Write TestConnectWithADC_Integration() and TestConnectWithServiceAccount_Integration() using emulator. Start emulator, connect to it, verify connection status. Test both ADC and service account paths with emulator. Clean up emulator after test.
    status: pending
    dependencies:
      - setup-test-infrastructure
  - id: test-publish-message-integration
    content: Write TestPublishMessage_Integration() using emulator. Connect to emulator, create topic, publish message with payload and attributes. Verify PublishResult contains MessageID and Timestamp. Test with different payload types (JSON, plain text). Test with attributes.
    status: pending
    dependencies:
      - test-connect-with-emulator
  - id: test-resource-crud-integration
    content: Write integration tests for resource CRUD operations using emulator. Test CreateTopic, DeleteTopic, CreateSubscription, DeleteSubscription, UpdateSubscription, ListTopics, ListSubscriptions, GetTopicMetadata, GetSubscriptionMetadata. Verify resources are created/deleted correctly and metadata is accurate.
    status: pending
    dependencies:
      - test-connect-with-emulator
  - id: test-monitoring-integration
    content: Write TestStartMonitor_Integration() and TestStopMonitor_Integration() using emulator. Create topic and subscription, start monitoring, publish messages, verify messages are received. Test StartTopicMonitor with auto-create subscription. Test StopTopicMonitor cleans up temporary subscription. Verify GetBufferedMessages and ClearMessageBuffer work correctly.
    status: pending
    dependencies:
      - test-connect-with-emulator
      - test-resource-crud-integration
  - id: test-disconnect-integration
    content: Write TestDisconnect_Integration() using emulator. Connect, create monitors, then disconnect. Verify all monitors are stopped, temporary subscriptions are deleted, resource cache is cleared, and client is closed. Test with active topic monitors.
    status: pending
    dependencies:
      - test-monitoring-integration
  - id: test-startup-integration
    content: "Write TestStartup_Integration() using emulator. Test full startup sequence with emulator: config loading, handler initialization, auto-connect if active profile exists. Verify all handlers are initialized correctly and connection works."
    status: pending
    dependencies:
      - test-connect-with-emulator
  - id: test-error-paths
    content: Write error path tests for all methods. Test ErrNotConnected for methods requiring connection. Test error propagation from handlers. Test invalid inputs (empty strings, nil values). Use errors.Is() to check error types, not exact error messages. Test all methods that can return errors.
    status: pending
    dependencies:
      - test-delegation-methods
  - id: test-concurrent-operations
    content: Write TestConcurrentOperations() if applicable. Test concurrent calls to ListTopics/ListSubscriptions (should be safe with RWMutex). Test concurrent monitor operations. Use sync.WaitGroup and goroutines. Verify no race conditions.
    status: pending
    dependencies:
      - test-delegation-methods
  - id: verify-test-coverage
    content: Run test coverage analysis. Execute 'go test -coverprofile=coverage.out ./app_test.go'. Generate HTML report with 'go tool cover -html=coverage.out'. Verify unit tests achieve 100% coverage of delegation methods. Document coverage gaps if any.
    status: pending
    dependencies:
      - test-error-paths
      - test-concurrent-operations
  - id: add-test-documentation
    content: Add test documentation comments. Document how to run unit tests vs integration tests. Add build tags if needed to separate unit and integration tests. Update README or CLAUDE.md with testing instructions. Document emulator requirements.
    status: pending
    dependencies:
      - verify-test-coverage
---

# Testing Plan for app.go

## Overview

Test `app.go` using a hybrid approach:

- **Unit tests** for delegation methods and simple logic (mock handlers)
- **Integration tests** using the Pub/Sub emulator for real GCP operations
- Follow Go testing best practices from `.cursor/rules/writing-tests.mdc`

## Test Structure

### File Organization

```
app_test.go              # Main test file for app.go
test/
  helpers.go             # Test helpers (emulator setup, mocks)
  emulator.go            # Emulator lifecycle management
  fixtures/              # Test data fixtures
    config.json          # Sample config files
    profiles.json        # Sample connection profiles
```

## Test Categories

### 1. Unit Tests (Mock Handlers)

**Purpose**: Test delegation logic and simple methods without external dependencies.

**Methods to Test**:

- `NewApp()` - App initialization
- `SetVersion()` / `GetVersion()` - Version management
- `GetConnectionStatus()` - Delegation to connection handler
- All delegation methods (verify they call handlers correctly)

**Approach**:

- Create mock handlers using interfaces or test doubles
- Verify delegation calls with correct parameters
- Test error propagation from handlers

**Example Structure**:

```go
type mockConnectionHandler struct {
    getConnectionStatusFunc func() app.ConnectionStatus
    connectWithADCFunc      func(projectID string) error
}

func (m *mockConnectionHandler) GetConnectionStatus() app.ConnectionStatus {
    if m.getConnectionStatusFunc != nil {
        return m.getConnectionStatusFunc()
    }
    return app.ConnectionStatus{}
}
```

### 2. Integration Tests (Pub/Sub Emulator)

**Purpose**: Test real GCP operations using the emulator without requiring credentials.

**Methods to Test**:

- `startup()` - Full initialization with emulator
- `ConnectWithADC()` - Connection with emulator
- `ConnectWithServiceAccount()` - Service account connection (with emulator)
- `Disconnect()` - Cleanup with active monitors
- `PublishMessage()` - Real message publishing
- `CreateTopic()` / `DeleteTopic()` - Resource operations
- `CreateSubscription()` / `DeleteSubscription()` - Subscription operations
- `StartMonitor()` / `StopMonitor()` - Message monitoring
- `StartTopicMonitor()` / `StopTopicMonitor()` - Topic monitoring

**Emulator Setup**:

```go
// test/emulator.go
func startEmulator(t *testing.T) (string, func()) {
    // Start gcloud emulator in background
    // Return emulator host and cleanup function
    return "localhost:8085", cleanup
}

func setupTestApp(t *testing.T) *App {
    emulatorHost, cleanup := startEmulator(t)
    t.Cleanup(cleanup)

    os.Setenv("PUBSUB_EMULATOR_HOST", emulatorHost)
    // ... create and initialize App
}
```

### 3. Test Cases by Method

#### `NewApp()`

- ✅ Returns app with initialized maps
- ✅ Sets empty slices (not nil) for topics/subscriptions

#### `startup()`

- ✅ Initializes all handlers correctly
- ✅ Loads config from file
- ✅ Uses default config if load fails
- ✅ Auto-connects to active profile (with emulator)
- ✅ Handles connection errors gracefully (logs, doesn't crash)

#### `GetConnectionStatus()`

- ✅ Delegates to connection handler
- ✅ Returns correct status structure

#### `SetVersion()` / `GetVersion()`

- ✅ Sets version correctly
- ✅ Returns "dev" if version not set
- ✅ Returns set version

#### `ConnectWithADC()` / `ConnectWithServiceAccount()`

- ✅ Delegates to connection handler
- ✅ Error propagation works correctly

#### `Disconnect()`

- ✅ Stops all active monitors
- ✅ Cleans up temporary subscriptions (with emulator)
- ✅ Clears resource cache
- ✅ Closes client manager
- ✅ Handles nil client gracefully

#### `PublishMessage()`

- ✅ Returns error when not connected
- ✅ Delegates to publisher correctly
- ✅ Converts result types correctly
- ✅ Error propagation works

#### Resource Methods (ListTopics, CreateTopic, etc.)

- ✅ All delegate to resource handler
- ✅ Error propagation works

#### Template Methods

- ✅ All delegate to template handler
- ✅ Error propagation works

#### Monitoring Methods

- ✅ All delegate to monitoring handler
- ✅ Error propagation works

#### Config Methods

- ✅ All delegate to config handler
- ✅ `SaveConfigFileContent()` reloads config after save

## Test Implementation Details

### Table-Driven Tests

Use table-driven tests for similar test cases:

```go
func TestGetVersion(t *testing.T) {
    tests := []struct {
        name    string
        version string
        want    string
    }{
        {
            name:    "returns set version",
            version: "1.0.0",
            want:    "1.0.0",
        },
        {
            name:    "returns dev when empty",
            version: "",
            want:    "dev",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            app := NewApp()
            app.SetVersion(tt.version)
            got := app.GetVersion()
            if got != tt.want {
                t.Errorf("GetVersion() = %q, want %q", got, tt.want)
            }
        })
    }
}
```

### Integration Test Example

```go
func TestPublishMessage_Integration(t *testing.T) {
    app := setupTestApp(t)
    projectID := "test-project"

    // Connect to emulator
    if err := app.ConnectWithADC(projectID); err != nil {
        t.Fatalf("ConnectWithADC() error = %v", err)
    }
    defer app.Disconnect()

    // Create topic
    topicID := "test-topic"
    if err := app.CreateTopic(topicID, ""); err != nil {
        t.Fatalf("CreateTopic() error = %v", err)
    }

    // Publish message
    payload := `{"test": "data"}`
    attributes := map[string]string{"key": "value"}

    got, err := app.PublishMessage(topicID, payload, attributes)
    if err != nil {
        t.Errorf("PublishMessage() error = %v", err)
        return
    }

    if got.MessageID == "" {
        t.Error("PublishMessage() MessageID is empty")
    }
    if got.Timestamp == "" {
        t.Error("PublishMessage() Timestamp is empty")
    }
}
```

### Error Testing

Test error semantics, not exact strings:

```go
func TestPublishMessage_NotConnected(t *testing.T) {
    app := NewApp()
    // Don't connect

    _, err := app.PublishMessage("topic", "payload", nil)
    if err == nil {
        t.Error("PublishMessage() error = nil, want error")
        return
    }

    // Check error type, not exact message
    if !errors.Is(err, models.ErrNotConnected) {
        t.Errorf("PublishMessage() error = %v, want ErrNotConnected", err)
    }
}
```

### Comparison with cmp Package

```go
import "github.com/google/go-cmp/cmp"

func TestGetConnectionStatus(t *testing.T) {
    app := setupTestApp(t)

    want := app.ConnectionStatus{
        IsConnected: true,
        ProjectID:   "test-project",
    }

    got := app.GetConnectionStatus()
    if !cmp.Equal(got, want) {
        t.Errorf("GetConnectionStatus() diff:\n%s", cmp.Diff(want, got))
    }
}
```

## Test Helpers

### Emulator Management

```go
// test/emulator.go
package test

import (
    "context"
    "os/exec"
    "testing"
    "time"
)

func StartEmulator(t *testing.T) (string, func()) {
    t.Helper()

    ctx, cancel := context.WithCancel(context.Background())
    cmd := exec.CommandContext(ctx, "gcloud", "beta", "emulators", "pubsub", "start", "--host-port=localhost:8085")

    if err := cmd.Start(); err != nil {
        t.Fatalf("failed to start emulator: %v", err)
    }

    // Wait for emulator to be ready
    time.Sleep(2 * time.Second)

    cleanup := func() {
        cancel()
        cmd.Wait()
        os.Unsetenv("PUBSUB_EMULATOR_HOST")
    }

    os.Setenv("PUBSUB_EMULATOR_HOST", "localhost:8085")
    return "localhost:8085", cleanup
}
```

### Test App Setup

```go
// test/helpers.go
package test

func SetupTestApp(t *testing.T) *App {
    t.Helper()

    emulatorHost, cleanup := StartEmulator(t)
    t.Cleanup(cleanup)

    // Create temp config directory
    configDir := t.TempDir()
    // ... setup test config

    app := NewApp()
    ctx := context.Background()
    app.startup(ctx)

    return app
}
```

## Test Coverage Goals

- **Unit tests**: 100% coverage of delegation methods
- **Integration tests**: All GCP operations (connect, publish, monitor, CRUD)
- **Error paths**: All error conditions tested
- **Edge cases**: Nil handlers, empty states, concurrent operations

## Running Tests

### Unit Tests Only

```bash
go test -run TestUnit ./app_test.go
```

### Integration Tests Only

```bash
# Requires gcloud emulator
go test -run TestIntegration ./app_test.go
```

### All Tests

```bash
go test ./app_test.go
```

### With Coverage

```bash
go test -coverprofile=coverage.out ./app_test.go
go tool cover -html=coverage.out
```

## Dependencies

### Required for Integration Tests

- Google Cloud SDK (`gcloud` CLI)
- Pub/Sub emulator component: `gcloud components install pubsub-emulator`

### Test Dependencies

- `github.com/google/go-cmp/cmp` - For structure comparisons
- Standard library only for unit tests

## Implementation Order

1. **Create test infrastructure** (`test/helpers.go`, `test/emulator.go`)
2. **Unit tests for simple methods** (version, status)
3. **Unit tests for delegation methods** (with mocks)
4. **Integration tests for connection** (with emulator)
5. **Integration tests for publishing** (with emulator)
6. **Integration tests for monitoring** (with emulator)
7. **Integration tests for resource CRUD** (with emulator)
8. **Error path tests** (all methods)
9. **Concurrency tests** (if applicable)

## Notes

- Emulator tests require `gcloud` CLI to be installed
- Emulator starts on `localhost:8085` by default
- Tests should clean up emulator and environment variables
- Use `t.Helper()` for all test helper functions
- Follow table-driven test pattern for similar test cases
- Use `cmp` package for complex structure comparisons
- Test error types, not exact error messages