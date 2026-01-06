// Package models defines data structures for connection profiles and application configuration
package models

import (
	"errors"
	"strings"
	"time"
)

// ConnectionProfile represents a saved connection configuration
type ConnectionProfile struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	ProjectID          string `json:"projectId"`
	AuthMethod         string `json:"authMethod"` // "ADC" | "ServiceAccount" | "OAuth"
	ServiceAccountPath string `json:"serviceAccountPath,omitempty"`
	OAuthClientPath    string `json:"oauthClientPath,omitempty"` // Path to OAuth client JSON
	OAuthEmail         string `json:"oauthEmail,omitempty"`      // Google account email (for display)
	EmulatorHost       string `json:"emulatorHost,omitempty"`
	IsDefault          bool   `json:"isDefault"`
	CreatedAt          string `json:"createdAt"`
}

// AppConfig represents the application configuration stored in ~/.pubsub-gui/config.json
type AppConfig struct {
	Profiles                []ConnectionProfile `json:"profiles"`
	ActiveProfileID         string             `json:"activeProfileId,omitempty"`
	MessageBufferSize       int                `json:"messageBufferSize"`
	AutoAck                 bool               `json:"autoAck"`
	Theme                   string             `json:"theme"`     // "light" | "dark" | "auto" | "dracula" | "monokai"
	FontSize                string             `json:"fontSize"`  // "small" | "medium" | "large"
	Templates               []MessageTemplate  `json:"templates"` // Message templates
	AutoCheckUpgrades       bool               `json:"autoCheckUpgrades"`
	UpgradeCheckInterval    int                `json:"upgradeCheckInterval"` // hours
	LastUpgradeCheck        time.Time          `json:"lastUpgradeCheck,omitempty"`
	DismissedUpgradeVersion string             `json:"dismissedUpgradeVersion,omitempty"`
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
	return nil
}

// NewDefaultConfig creates a new AppConfig with default values
func NewDefaultConfig() *AppConfig {
	return &AppConfig{
		Profiles:                []ConnectionProfile{},
		ActiveProfileID:         "",
		MessageBufferSize:       500,
		AutoAck:                 true,
		Theme:                   "auto",
		FontSize:                "medium",
		Templates:               []MessageTemplate{},
		AutoCheckUpgrades:       true,
		UpgradeCheckInterval:    24,
		LastUpgradeCheck:        time.Time{},
		DismissedUpgradeVersion: "",
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
