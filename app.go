package main

import (
	"context"
	"fmt"
	"os"

	"myproject/internal/auth"
	"myproject/internal/config"
	"myproject/internal/models"
	"myproject/internal/pubsub/admin"
)

// App struct holds the application state and managers
type App struct {
	ctx           context.Context
	config        *models.AppConfig
	configManager *config.Manager
	clientManager *auth.ClientManager
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
// Initializes config manager, loads config, and auto-connects to default profile
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Initialize client manager
	a.clientManager = auth.NewClientManager(ctx)

	// Initialize config manager
	configMgr, err := config.NewManager()
	if err != nil {
		fmt.Printf("Error initializing config manager: %v\n", err)
		return
	}
	a.configManager = configMgr

	// Load configuration
	cfg, err := a.configManager.LoadConfig()
	if err != nil {
		fmt.Printf("Error loading config: %v\n", err)
		// Use default config if load fails
		cfg = models.NewDefaultConfig()
	}
	a.config = cfg

	// Auto-connect to default profile if set
	if a.config.ActiveProfileID != "" {
		// Find the active profile
		for _, profile := range a.config.Profiles {
			if profile.ID == a.config.ActiveProfileID && profile.IsDefault {
				// Attempt to connect (errors are logged but don't prevent startup)
				if err := a.connectWithProfile(&profile); err != nil {
					fmt.Printf("Failed to auto-connect to default profile '%s': %v\n", profile.Name, err)
				}
				break
			}
		}
	}
}

// ConnectionStatus represents the current connection status
type ConnectionStatus struct {
	IsConnected  bool   `json:"isConnected"`
	ProjectID    string `json:"projectId"`
	AuthMethod   string `json:"authMethod,omitempty"`
	EmulatorHost string `json:"emulatorHost,omitempty"`
}

// GetConnectionStatus returns the current connection status
func (a *App) GetConnectionStatus() ConnectionStatus {
	emulatorHost := os.Getenv("PUBSUB_EMULATOR_HOST")

	return ConnectionStatus{
		IsConnected:  a.clientManager.IsConnected(),
		ProjectID:    a.clientManager.GetProjectID(),
		EmulatorHost: emulatorHost,
	}
}

// ConnectWithADC connects to Pub/Sub using Application Default Credentials
func (a *App) ConnectWithADC(projectID string) error {
	if projectID == "" {
		return fmt.Errorf("project ID cannot be empty")
	}

	client, err := auth.ConnectWithADC(a.ctx, projectID)
	if err != nil {
		return fmt.Errorf("failed to connect with ADC: %w", err)
	}

	if err := a.clientManager.SetClient(client, projectID); err != nil {
		return fmt.Errorf("failed to set client: %w", err)
	}

	return nil
}

// ConnectWithServiceAccount connects to Pub/Sub using a service account JSON key file
func (a *App) ConnectWithServiceAccount(projectID, keyPath string) error {
	if projectID == "" {
		return fmt.Errorf("project ID cannot be empty")
	}

	if keyPath == "" {
		return fmt.Errorf("service account key path cannot be empty")
	}

	client, err := auth.ConnectWithServiceAccount(a.ctx, projectID, keyPath)
	if err != nil {
		return fmt.Errorf("failed to connect with service account: %w", err)
	}

	if err := a.clientManager.SetClient(client, projectID); err != nil {
		return fmt.Errorf("failed to set client: %w", err)
	}

	return nil
}

// Disconnect closes the current Pub/Sub connection
func (a *App) Disconnect() error {
	return a.clientManager.Close()
}

// GetProfiles returns all saved connection profiles
func (a *App) GetProfiles() []models.ConnectionProfile {
	if a.config == nil {
		return []models.ConnectionProfile{}
	}
	return a.config.Profiles
}

// SaveProfile saves a connection profile to the configuration
func (a *App) SaveProfile(profile models.ConnectionProfile) error {
	// Validate profile
	if err := profile.Validate(); err != nil {
		return fmt.Errorf("invalid profile: %w", err)
	}

	// Check for duplicate names (excluding the profile itself if updating)
	for _, p := range a.config.Profiles {
		if p.Name == profile.Name && p.ID != profile.ID {
			return models.ErrDuplicateProfile
		}
	}

	// If this profile is set as default, unset all other defaults
	if profile.IsDefault {
		for i := range a.config.Profiles {
			a.config.Profiles[i].IsDefault = false
		}
		a.config.ActiveProfileID = profile.ID
	}

	// Find and update existing profile, or add new one
	found := false
	for i, p := range a.config.Profiles {
		if p.ID == profile.ID {
			a.config.Profiles[i] = profile
			found = true
			break
		}
	}

	if !found {
		a.config.Profiles = append(a.config.Profiles, profile)
	}

	// Save configuration
	return a.configManager.SaveConfig(a.config)
}

// DeleteProfile removes a connection profile from the configuration
func (a *App) DeleteProfile(profileID string) error {
	if profileID == "" {
		return fmt.Errorf("profile ID cannot be empty")
	}

	// Find and remove the profile
	newProfiles := make([]models.ConnectionProfile, 0)
	found := false
	for _, p := range a.config.Profiles {
		if p.ID == profileID {
			found = true
			// Disconnect if this is the active profile
			if a.config.ActiveProfileID == profileID {
				a.Disconnect()
				a.config.ActiveProfileID = ""
			}
		} else {
			newProfiles = append(newProfiles, p)
		}
	}

	if !found {
		return models.ErrProfileNotFound
	}

	a.config.Profiles = newProfiles

	// Save configuration
	return a.configManager.SaveConfig(a.config)
}

// SwitchProfile switches to a different connection profile
func (a *App) SwitchProfile(profileID string) error {
	if profileID == "" {
		return fmt.Errorf("profile ID cannot be empty")
	}

	// Find the profile
	var targetProfile *models.ConnectionProfile
	for i, p := range a.config.Profiles {
		if p.ID == profileID {
			targetProfile = &a.config.Profiles[i]
			break
		}
	}

	if targetProfile == nil {
		return models.ErrProfileNotFound
	}

	// Disconnect current connection
	if a.clientManager.IsConnected() {
		if err := a.Disconnect(); err != nil {
			return fmt.Errorf("failed to disconnect current profile: %w", err)
		}
	}

	// Connect with the new profile
	if err := a.connectWithProfile(targetProfile); err != nil {
		return fmt.Errorf("failed to connect to profile: %w", err)
	}

	// Update active profile ID
	a.config.ActiveProfileID = profileID

	// Save configuration
	return a.configManager.SaveConfig(a.config)
}

// connectWithProfile is a helper method to connect using a profile's settings
func (a *App) connectWithProfile(profile *models.ConnectionProfile) error {
	// Set emulator host if specified in profile
	if profile.EmulatorHost != "" {
		os.Setenv("PUBSUB_EMULATOR_HOST", profile.EmulatorHost)
	}

	switch profile.AuthMethod {
	case "ADC":
		return a.ConnectWithADC(profile.ProjectID)
	case "ServiceAccount":
		return a.ConnectWithServiceAccount(profile.ProjectID, profile.ServiceAccountPath)
	default:
		return fmt.Errorf("unsupported auth method: %s", profile.AuthMethod)
	}
}

// ListTopics returns all topics in the connected project
func (a *App) ListTopics() ([]admin.TopicInfo, error) {
	client := a.clientManager.GetClient()
	if client == nil {
		return nil, models.ErrNotConnected
	}

	projectID := a.clientManager.GetProjectID()
	return admin.ListTopicsAdmin(a.ctx, client, projectID)
}

// ListSubscriptions returns all subscriptions in the connected project
func (a *App) ListSubscriptions() ([]admin.SubscriptionInfo, error) {
	client := a.clientManager.GetClient()
	if client == nil {
		return nil, models.ErrNotConnected
	}

	projectID := a.clientManager.GetProjectID()
	return admin.ListSubscriptionsAdmin(a.ctx, client, projectID)
}

// GetTopicMetadata retrieves metadata for a specific topic
func (a *App) GetTopicMetadata(topicID string) (admin.TopicInfo, error) {
	client := a.clientManager.GetClient()
	if client == nil {
		return admin.TopicInfo{}, models.ErrNotConnected
	}

	projectID := a.clientManager.GetProjectID()
	return admin.GetTopicMetadataAdmin(a.ctx, client, projectID, topicID)
}

// GetSubscriptionMetadata retrieves metadata for a specific subscription
func (a *App) GetSubscriptionMetadata(subID string) (admin.SubscriptionInfo, error) {
	client := a.clientManager.GetClient()
	if client == nil {
		return admin.SubscriptionInfo{}, models.ErrNotConnected
	}

	projectID := a.clientManager.GetProjectID()
	return admin.GetSubscriptionMetadataAdmin(a.ctx, client, projectID, subID)
}
