// Package test provides test helpers for app.go testing
package test

import (
	"os"
	"path/filepath"
	"testing"
)

// SetupTestConfigDir creates a temporary config directory and returns the path and cleanup function
func SetupTestConfigDir(t *testing.T) (string, func()) {
	t.Helper()

	// Create temp config directory
	configDir := t.TempDir()
	configPath := filepath.Join(configDir, ".pubsub-gui", "config.json")

	// Create config directory
	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		t.Fatalf("failed to create config directory: %v", err)
	}

	// Create default config
	cfgJSON := `{
  "profiles": [],
  "activeProfileId": "",
  "messageBufferSize": 500,
  "autoAck": true,
  "theme": "auto",
  "fontSize": "medium",
  "templates": []
}`

	if err := os.WriteFile(configPath, []byte(cfgJSON), 0644); err != nil {
		t.Fatalf("failed to write test config: %v", err)
	}

	// Set config directory environment variable
	originalHome := os.Getenv("HOME")
	os.Setenv("HOME", configDir)

	cleanup := func() {
		os.Setenv("HOME", originalHome)
	}

	return configDir, cleanup
}
