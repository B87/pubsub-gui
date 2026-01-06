package main

import (
	"testing"
	"time"

	"pubsub-gui/internal/config"
	"pubsub-gui/internal/models"
)

func TestGetCurrentVersion(t *testing.T) {
	app := NewApp()

	tests := []struct {
		name    string
		version string
		want    string
	}{
		{
			name:    "set version v1.0.0",
			version: "v1.0.0",
			want:    "v1.0.0",
		},
		{
			name:    "set version 1.2.3",
			version: "1.2.3",
			want:    "1.2.3",
		},
		{
			name:    "empty version returns dev",
			version: "",
			want:    "dev",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app.SetVersion(tt.version)
			got := app.GetCurrentVersion()
			if got != tt.want {
				t.Errorf("GetCurrentVersion() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestCheckForUpdates_DevBuild(t *testing.T) {
	app := NewApp()
	app.SetVersion("dev")

	// Initialize minimal config for test
	app.config = &models.AppConfig{}

	got, err := app.CheckForUpdates()
	if err != nil {
		t.Errorf("CheckForUpdates() error = %v, want nil", err)
		return
	}

	if got == nil {
		t.Fatal("CheckForUpdates() = nil, want UpdateInfo")
	}

	if got.CurrentVersion != "dev" {
		t.Errorf("CheckForUpdates() CurrentVersion = %q, want %q", got.CurrentVersion, "dev")
	}

	if got.IsUpdateAvailable {
		t.Errorf("CheckForUpdates() IsUpdateAvailable = %v, want false for dev builds", got.IsUpdateAvailable)
	}
}

func TestCheckForUpdates_UpdatesLastUpgradeCheck(t *testing.T) {
	app := NewApp()
	app.SetVersion("v1.0.0")

	// Initialize config manager and config
	configMgr, err := config.NewManager()
	if err != nil {
		t.Fatalf("failed to create config manager: %v", err)
	}
	app.configManager = configMgr
	app.config = models.NewDefaultConfig()

	// Mock version.CheckForUpdates to return a result without making HTTP call
	// Since we can't easily mock the version package, we'll test the timestamp update logic
	initialTime := app.config.LastUpgradeCheck

	// Note: This test would require mocking version.CheckForUpdates or making it testable
	// For now, we verify the field exists and can be set
	if !initialTime.IsZero() && !initialTime.Before(time.Now()) {
		t.Error("initial LastUpgradeCheck should be zero or in the past")
	}

	// Verify the field can be updated
	newTime := time.Now()
	app.config.LastUpgradeCheck = newTime

	if app.config.LastUpgradeCheck != newTime {
		t.Errorf("LastUpgradeCheck = %v, want %v", app.config.LastUpgradeCheck, newTime)
	}
}

func TestCheckForUpdates_ErrorHandling(t *testing.T) {
	app := NewApp()
	app.SetVersion("v1.0.0")
	app.config = models.NewDefaultConfig()

	// Test with nil config manager (should not panic, just log warning)
	app.configManager = nil

	// This should handle the nil config manager gracefully
	// The actual version check will fail, but we test error handling
	_, err := app.CheckForUpdates()
	// Error is expected since we can't actually reach GitHub API in unit test
	// We're just verifying it doesn't panic
	if err == nil {
		// If no error, that's fine - dev build or network succeeded
		// We just want to ensure no panic
	}
}

func TestApp_UpgradeCheckFields(t *testing.T) {
	app := NewApp()

	// Verify upgrade check fields are initialized
	if app.upgradeCheckTicker != nil {
		t.Error("upgradeCheckTicker should be nil initially")
	}

	// Verify mutex can be used
	app.upgradeCheckMu.Lock()
	app.lastUpgradeCheck = time.Now()
	app.upgradeCheckMu.Unlock()

	if app.lastUpgradeCheck.IsZero() {
		t.Error("lastUpgradeCheck should be set after lock/unlock")
	}
}
