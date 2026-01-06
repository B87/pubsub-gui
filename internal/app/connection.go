// Package app provides handler structs for organizing App methods by domain
package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"pubsub-gui/internal/auth"
	"pubsub-gui/internal/config"
	"pubsub-gui/internal/models"
)

// ConnectionStatus represents the current connection status
type ConnectionStatus struct {
	IsConnected  bool   `json:"isConnected"`
	ProjectID    string `json:"projectId"`
	AuthMethod   string `json:"authMethod,omitempty"`
	EmulatorHost string `json:"emulatorHost,omitempty"`
}

// ConnectionHandler handles connection and profile management
type ConnectionHandler struct {
	ctx           context.Context
	config        *models.AppConfig
	configManager *config.Manager
	clientManager *auth.ClientManager
	syncResources func() // Callback to trigger resource sync
}

// NewConnectionHandler creates a new connection handler
func NewConnectionHandler(
	ctx context.Context,
	config *models.AppConfig,
	configManager *config.Manager,
	clientManager *auth.ClientManager,
	syncResources func(),
) *ConnectionHandler {
	return &ConnectionHandler{
		ctx:           ctx,
		config:        config,
		configManager: configManager,
		clientManager: clientManager,
		syncResources: syncResources,
	}
}

// GetConnectionStatus returns the current connection status
func (h *ConnectionHandler) GetConnectionStatus() ConnectionStatus {
	emulatorHost := os.Getenv("PUBSUB_EMULATOR_HOST")

	return ConnectionStatus{
		IsConnected:  h.clientManager.IsConnected(),
		ProjectID:    h.clientManager.GetProjectID(),
		EmulatorHost: emulatorHost,
	}
}

// ConnectWithADC connects to Pub/Sub using Application Default Credentials
func (h *ConnectionHandler) ConnectWithADC(projectID string) error {
	if projectID == "" {
		return fmt.Errorf("project ID cannot be empty")
	}

	client, err := auth.ConnectWithADC(h.ctx, projectID)
	if err != nil {
		return fmt.Errorf("failed to connect with ADC: %w", err)
	}

	if err := h.clientManager.SetClient(client, projectID); err != nil {
		return fmt.Errorf("failed to set client: %w", err)
	}

	// Sync resources after successful connection
	if h.syncResources != nil {
		go h.syncResources()
	}

	return nil
}

// ConnectWithServiceAccount connects to Pub/Sub using a service account JSON key file
func (h *ConnectionHandler) ConnectWithServiceAccount(projectID, keyPath string) error {
	if projectID == "" {
		return fmt.Errorf("project ID cannot be empty")
	}

	if keyPath == "" {
		return fmt.Errorf("service account key path cannot be empty")
	}

	client, err := auth.ConnectWithServiceAccount(h.ctx, projectID, keyPath)
	if err != nil {
		return fmt.Errorf("failed to connect with service account: %w", err)
	}

	if err := h.clientManager.SetClient(client, projectID); err != nil {
		return fmt.Errorf("failed to set client: %w", err)
	}

	// Sync resources after successful connection
	if h.syncResources != nil {
		go h.syncResources()
	}

	return nil
}

// ConnectWithOAuth connects to Pub/Sub using OAuth2 credentials
func (h *ConnectionHandler) ConnectWithOAuth(projectID, oauthClientPath string) error {
	if projectID == "" {
		return fmt.Errorf("project ID cannot be empty")
	}

	if oauthClientPath == "" {
		return fmt.Errorf("OAuth client path cannot be empty")
	}

	// Get config directory for token store
	configDir := filepath.Dir(h.configManager.GetConfigPath())

	// Create token store
	tokenStore, err := auth.NewTokenStore(configDir)
	if err != nil {
		return fmt.Errorf("failed to initialize token store: %w", err)
	}

	// Get or create profile ID for token storage
	profileID := h.getOrCreateOAuthProfileID(projectID, oauthClientPath)

	// Connect with OAuth
	client, userEmail, err := auth.ConnectWithOAuth(h.ctx, projectID, oauthClientPath, profileID, tokenStore)
	if err != nil {
		return err
	}

	if err := h.clientManager.SetClient(client, projectID); err != nil {
		client.Close()
		return fmt.Errorf("failed to set client: %w", err)
	}

	// Sync resources after successful connection
	if h.syncResources != nil {
		go h.syncResources()
	}

	// Emit connection success event with OAuth metadata
	runtime.EventsEmit(h.ctx, "connection:success", map[string]interface{}{
		"projectId":  projectID,
		"authMethod": "OAuth",
		"userEmail":   userEmail,
	})

	return nil
}

// getOrCreateOAuthProfileID finds existing profile or generates new ID for OAuth connection
func (h *ConnectionHandler) getOrCreateOAuthProfileID(projectID, oauthClientPath string) string {
	// Find existing profile with matching project and OAuth client
	for _, profile := range h.config.Profiles {
		if profile.AuthMethod == "OAuth" &&
			profile.ProjectID == projectID &&
			profile.OAuthClientPath == oauthClientPath {
			return profile.ID
		}
	}

	// Generate new profile ID
	return models.GenerateID()
}

// GetProfiles returns all saved connection profiles
func (h *ConnectionHandler) GetProfiles() []models.ConnectionProfile {
	if h.config == nil {
		return []models.ConnectionProfile{}
	}
	return h.config.Profiles
}

// SaveProfile saves a connection profile to the configuration
func (h *ConnectionHandler) SaveProfile(profile models.ConnectionProfile) error {
	// Validate profile
	if err := profile.Validate(); err != nil {
		return fmt.Errorf("invalid profile: %w", err)
	}

	// Check for duplicate names (excluding the profile itself if updating)
	for _, p := range h.config.Profiles {
		if p.Name == profile.Name && p.ID != profile.ID {
			return models.ErrDuplicateProfile
		}
	}

	// Find and update existing profile, or add new one
	found := false
	for i, p := range h.config.Profiles {
		if p.ID == profile.ID {
			h.config.Profiles[i] = profile
			found = true
			break
		}
	}

	if !found {
		h.config.Profiles = append(h.config.Profiles, profile)
	}

	// If this profile is set as default, unset all other defaults
	if profile.IsDefault {
		for i := range h.config.Profiles {
			h.config.Profiles[i].IsDefault = false
		}
	}

	// Set as active profile if it's new or if it's marked as default
	// This ensures newly created profiles become active
	if !found || profile.IsDefault {
		h.config.ActiveProfileID = profile.ID
	}

	// Save configuration
	return h.configManager.SaveConfig(h.config)
}

// DeleteProfile removes a connection profile from the configuration
// disconnect callback should be provided to handle disconnection if needed
func (h *ConnectionHandler) DeleteProfile(profileID string, disconnect func() error) error {
	if profileID == "" {
		return fmt.Errorf("profile ID cannot be empty")
	}

	// Find and remove the profile
	newProfiles := make([]models.ConnectionProfile, 0)
	var deletedProfile *models.ConnectionProfile
	found := false
	for _, p := range h.config.Profiles {
		if p.ID == profileID {
			found = true
			deletedProfile = &p
			// Disconnect if this is the active profile
			if h.config.ActiveProfileID == profileID {
				if disconnect != nil {
					disconnect()
				}
				h.config.ActiveProfileID = ""
			}
		} else {
			newProfiles = append(newProfiles, p)
		}
	}

	if !found {
		return models.ErrProfileNotFound
	}

	// Delete OAuth token if this was an OAuth profile
	if deletedProfile != nil && deletedProfile.AuthMethod == "OAuth" {
		configDir := filepath.Dir(h.configManager.GetConfigPath())
		tokenStore, err := auth.NewTokenStore(configDir)
		if err == nil {
			// Non-fatal error - continue even if token store creation fails
			tokenStore.DeleteToken(profileID)
		}
	}

	h.config.Profiles = newProfiles

	// Save configuration
	return h.configManager.SaveConfig(h.config)
}

// SwitchProfile switches to a different connection profile
// disconnect callback should be provided to handle disconnection if needed
func (h *ConnectionHandler) SwitchProfile(profileID string, disconnect func() error) error {
	if profileID == "" {
		return fmt.Errorf("profile ID cannot be empty")
	}

	// Find the profile
	var targetProfile *models.ConnectionProfile
	for i, p := range h.config.Profiles {
		if p.ID == profileID {
			targetProfile = &h.config.Profiles[i]
			break
		}
	}

	if targetProfile == nil {
		return models.ErrProfileNotFound
	}

	// Disconnect current connection
	if h.clientManager.IsConnected() {
		if disconnect != nil {
			if err := disconnect(); err != nil {
				return fmt.Errorf("failed to disconnect current profile: %w", err)
			}
		}
	}

	// Connect with the new profile
	if err := h.connectWithProfile(targetProfile); err != nil {
		return fmt.Errorf("failed to connect to profile: %w", err)
	}

	// Sync resources after profile switch
	if h.syncResources != nil {
		go h.syncResources()
	}

	// Update active profile ID
	h.config.ActiveProfileID = profileID

	// Save configuration
	return h.configManager.SaveConfig(h.config)
}

// connectWithProfile is a helper method to connect using a profile's settings
func (h *ConnectionHandler) connectWithProfile(profile *models.ConnectionProfile) error {
	// Set emulator host if specified in profile
	if profile.EmulatorHost != "" {
		os.Setenv("PUBSUB_EMULATOR_HOST", profile.EmulatorHost)
	}

	switch profile.AuthMethod {
	case "ADC":
		return h.ConnectWithADC(profile.ProjectID)
	case "ServiceAccount":
		return h.ConnectWithServiceAccount(profile.ProjectID, profile.ServiceAccountPath)
	case "OAuth":
		return h.ConnectWithOAuth(profile.ProjectID, profile.OAuthClientPath)
	default:
		return fmt.Errorf("unsupported auth method: %s", profile.AuthMethod)
	}
}
