// Package models defines data structures for connection profiles and application configuration
package models

import (
	"errors"
	"strings"
	"time"
)

// EmulatorMode represents the emulator configuration mode
type EmulatorMode string

const (
	EmulatorModeOff      EmulatorMode = "off"
	EmulatorModeExternal EmulatorMode = "external"
	EmulatorModeManaged  EmulatorMode = "managed"
)

// ManagedEmulatorConfig contains settings for managed Docker emulator
type ManagedEmulatorConfig struct {
	Port        int    `json:"port"`                  // Host port to expose (default: 8085)
	Image       string `json:"image,omitempty"`       // Docker image (default: google/cloud-sdk:emulators)
	DataDir     string `json:"dataDir,omitempty"`     // Optional data directory for persistence
	AutoStart   bool   `json:"autoStart"`             // Start emulator automatically on connect (default: true)
	AutoStop    bool   `json:"autoStop"`              // Stop emulator on disconnect (default: true)
	BindAddress string `json:"bindAddress,omitempty"` // Bind address (default: 127.0.0.1, use 0.0.0.0 for LAN access)
}

// DefaultManagedEmulatorConfig returns a ManagedEmulatorConfig with default values
func DefaultManagedEmulatorConfig() ManagedEmulatorConfig {
	return ManagedEmulatorConfig{
		Port:        8085,
		Image:       "google/cloud-sdk:emulators",
		AutoStart:   true,
		AutoStop:    true,
		BindAddress: "127.0.0.1",
	}
}

// ConnectionProfile represents a saved connection configuration
type ConnectionProfile struct {
	ID                 string                 `json:"id"`
	Name               string                 `json:"name"`
	ProjectID          string                 `json:"projectId"`
	AuthMethod         string                 `json:"authMethod"` // "ADC" | "ServiceAccount" | "OAuth"
	ServiceAccountPath string                 `json:"serviceAccountPath,omitempty"`
	OAuthClientPath    string                 `json:"oauthClientPath,omitempty"` // Path to OAuth client JSON
	OAuthEmail         string                 `json:"oauthEmail,omitempty"`      // Google account email (for display)
	EmulatorHost       string                 `json:"emulatorHost,omitempty"`    // For external mode (backward compatible)
	EmulatorMode       EmulatorMode           `json:"emulatorMode,omitempty"`    // "off" | "external" | "managed"
	ManagedEmulator    *ManagedEmulatorConfig `json:"managedEmulator,omitempty"` // Settings for managed Docker emulator
	IsDefault          bool                   `json:"isDefault"`
	CreatedAt          string                 `json:"createdAt"`
}

// AppConfig represents the application configuration stored in ~/.pubsub-gui/config.json
type AppConfig struct {
	Profiles                   []ConnectionProfile         `json:"profiles"`
	ActiveProfileID            string                      `json:"activeProfileId,omitempty"`
	MessageBufferSize          int                         `json:"messageBufferSize"`
	AutoAck                    bool                        `json:"autoAck"`
	Theme                      string                      `json:"theme"`                                // "light" | "dark" | "auto" | "dracula" | "monokai" | "nord" | "sienna"
	FontSize                   string                      `json:"fontSize"`                             // "small" | "medium" | "large"
	Templates                  []MessageTemplate           `json:"templates"`                            // Message templates
	TopicSubscriptionTemplates []TopicSubscriptionTemplate `json:"topicSubscriptionTemplates,omitempty"` // Topic/subscription templates
	AutoCheckUpgrades          bool                        `json:"autoCheckUpgrades"`
	UpgradeCheckInterval       int                         `json:"upgradeCheckInterval"` // hours
	LastUpgradeCheck           time.Time                   `json:"lastUpgradeCheck,omitempty"`
	DismissedUpgradeVersion    string                      `json:"dismissedUpgradeVersion,omitempty"`
}

// Validate checks if the ConnectionProfile has all required fields
func (cp *ConnectionProfile) Validate() error {
	if strings.TrimSpace(cp.ID) == "" {
		return errors.New("profile ID cannot be empty")
	}
	if strings.TrimSpace(cp.Name) == "" {
		return errors.New("profile name cannot be empty")
	}
	if strings.TrimSpace(cp.ProjectID) == "" {
		return errors.New("project ID cannot be empty")
	}
	validAuthMethods := []string{"ADC", "ServiceAccount", "OAuth"}
	isValid := false
	for _, method := range validAuthMethods {
		if cp.AuthMethod == method {
			isValid = true
			break
		}
	}
	if !isValid {
		return errors.New("auth method must be 'ADC', 'ServiceAccount', or 'OAuth'")
	}
	if cp.AuthMethod == "ServiceAccount" && strings.TrimSpace(cp.ServiceAccountPath) == "" {
		return errors.New("service account path required when using ServiceAccount auth method")
	}
	if cp.AuthMethod == "OAuth" && strings.TrimSpace(cp.OAuthClientPath) == "" {
		return errors.New("OAuth client path required when using OAuth auth method")
	}

	// Validate emulator mode
	if cp.EmulatorMode != "" {
		switch cp.EmulatorMode {
		case EmulatorModeOff, EmulatorModeExternal, EmulatorModeManaged:
			// Valid
		default:
			return errors.New("emulator mode must be 'off', 'external', or 'managed'")
		}
	}

	// Validate external mode requires emulatorHost
	if cp.EmulatorMode == EmulatorModeExternal && strings.TrimSpace(cp.EmulatorHost) == "" {
		return errors.New("emulator host required when using external emulator mode")
	}

	// Validate managed mode settings
	if cp.EmulatorMode == EmulatorModeManaged && cp.ManagedEmulator != nil {
		if cp.ManagedEmulator.Port < 1 || cp.ManagedEmulator.Port > 65535 {
			return errors.New("managed emulator port must be between 1 and 65535")
		}
		if cp.ManagedEmulator.BindAddress != "" &&
			cp.ManagedEmulator.BindAddress != "127.0.0.1" &&
			cp.ManagedEmulator.BindAddress != "0.0.0.0" {
			return errors.New("managed emulator bind address must be '127.0.0.1' or '0.0.0.0'")
		}
	}

	return nil
}

// GetEffectiveEmulatorMode returns the emulator mode, applying migration logic for backward compatibility
// If emulatorMode is not set, it infers from emulatorHost
func (cp *ConnectionProfile) GetEffectiveEmulatorMode() EmulatorMode {
	if cp.EmulatorMode != "" {
		return cp.EmulatorMode
	}
	// Migration: if emulatorHost is set, treat as external mode
	if cp.EmulatorHost != "" {
		return EmulatorModeExternal
	}
	return EmulatorModeOff
}

// GetEffectiveEmulatorHost returns the emulator host to use for connection
// For managed mode, it constructs the host from BindAddress:Port
// For external mode, it returns EmulatorHost
// For off mode, it returns empty string
func (cp *ConnectionProfile) GetEffectiveEmulatorHost() string {
	mode := cp.GetEffectiveEmulatorMode()
	switch mode {
	case EmulatorModeManaged:
		if cp.ManagedEmulator == nil {
			// Use defaults if not configured
			return "127.0.0.1:8085"
		}
		bindAddr := cp.ManagedEmulator.BindAddress
		if bindAddr == "" || bindAddr == "0.0.0.0" {
			// Always connect to localhost, even if bound to 0.0.0.0
			bindAddr = "127.0.0.1"
		}
		port := cp.ManagedEmulator.Port
		if port == 0 {
			port = 8085
		}
		return bindAddr + ":" + itoa(port)
	case EmulatorModeExternal:
		return cp.EmulatorHost
	default:
		return ""
	}
}

// itoa converts int to string (simple helper to avoid importing strconv)
func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	if i < 0 {
		return "-" + itoa(-i)
	}
	var digits []byte
	for i > 0 {
		digits = append([]byte{byte('0' + i%10)}, digits...)
		i /= 10
	}
	return string(digits)
}

// IsEmulatorEnabled returns true if any emulator mode is active (external or managed)
func (cp *ConnectionProfile) IsEmulatorEnabled() bool {
	mode := cp.GetEffectiveEmulatorMode()
	return mode == EmulatorModeExternal || mode == EmulatorModeManaged
}

// NewDefaultConfig creates a new AppConfig with default values
func NewDefaultConfig() *AppConfig {
	return &AppConfig{
		Profiles:                   []ConnectionProfile{},
		ActiveProfileID:            "",
		MessageBufferSize:          500,
		AutoAck:                    true,
		Theme:                      "auto",
		FontSize:                   "medium",
		Templates:                  []MessageTemplate{},
		TopicSubscriptionTemplates: []TopicSubscriptionTemplate{},
		AutoCheckUpgrades:          true,
		UpgradeCheckInterval:       24,
		LastUpgradeCheck:           time.Time{},
		DismissedUpgradeVersion:    "",
	}
}

// NewConnectionProfile creates a new ConnectionProfile with a generated ID and timestamp
func NewConnectionProfile(name, projectID, authMethod string) *ConnectionProfile {
	return &ConnectionProfile{
		ID:         generateID(),
		Name:       name,
		ProjectID:  projectID,
		AuthMethod: authMethod,
		IsDefault:  false,
		CreatedAt:  time.Now().Format(time.RFC3339),
	}
}

// GenerateID generates a simple unique ID (timestamp-based)
func GenerateID() string {
	return time.Now().Format("20060102150405")
}

// generateID is an alias for GenerateID (kept for backward compatibility)
func generateID() string {
	return GenerateID()
}
