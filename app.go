// Package main provides the Wails application entry point and Go methods exposed to the frontend
package main

import (
	"context"
	"fmt"
	"os"
	"sync"

	"pubsub-gui/internal/app"
	"pubsub-gui/internal/auth"
	"pubsub-gui/internal/config"
	"pubsub-gui/internal/models"
	"pubsub-gui/internal/pubsub/admin"
	"pubsub-gui/internal/pubsub/publisher"
	"pubsub-gui/internal/pubsub/subscriber"
)

// App struct holds the application state and managers
type App struct {
	ctx            context.Context
	config         *models.AppConfig
	configManager  *config.Manager
	clientManager  *auth.ClientManager
	activeMonitors map[string]*subscriber.MessageStreamer
	topicMonitors  map[string]string // topicID -> temp subscriptionID
	monitorsMu     sync.RWMutex

	// Resource store for synchronized state
	resourceMu    sync.RWMutex
	topics        []admin.TopicInfo
	subscriptions []admin.SubscriptionInfo

	// Handlers
	connection *app.ConnectionHandler
	resources  *app.ResourceHandler
	templates  *app.TemplateHandler
	monitoring *app.MonitoringHandler
	configH    *app.ConfigHandler

	// Application version
	version string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		activeMonitors: make(map[string]*subscriber.MessageStreamer),
		topicMonitors:  make(map[string]string),
	}
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

	// Initialize handlers
	// Note: resources handler must be initialized first as connection handler needs syncResources callback
	a.resources = app.NewResourceHandler(
		a.ctx,
		a.clientManager,
		&a.resourceMu,
		&a.topics,
		&a.subscriptions,
	)
	a.connection = app.NewConnectionHandler(
		a.ctx,
		a.config,
		a.configManager,
		a.clientManager,
		func() { go a.resources.SyncResources() },
	)
	a.templates = app.NewTemplateHandler(a.config, a.configManager)
	a.monitoring = app.NewMonitoringHandler(
		a.ctx,
		a.config,
		a.clientManager,
		a.activeMonitors,
		a.topicMonitors,
		&a.monitorsMu,
		&a.resourceMu,
		&a.subscriptions,
	)
	a.configH = app.NewConfigHandler(
		a.ctx,
		a.config,
		a.configManager,
		a.activeMonitors,
		&a.monitorsMu,
	)

	// Auto-connect to active profile if set (persists across app restarts)
	if a.config.ActiveProfileID != "" {
		// Find the active profile
		for _, profile := range a.config.Profiles {
			if profile.ID == a.config.ActiveProfileID {
				// Attempt to connect (errors are logged but don't prevent startup)
				if err := a.connectWithProfile(&profile); err != nil {
					fmt.Printf("Failed to auto-connect to active profile '%s': %v\n", profile.Name, err)
				} else {
					// Sync resources after successful connection
					go a.resources.SyncResources()
				}
				break
			}
		}
	}
}

// GetConnectionStatus returns the current connection status
func (a *App) GetConnectionStatus() app.ConnectionStatus {
	return a.connection.GetConnectionStatus()
}

// SetVersion sets the application version
func (a *App) SetVersion(v string) {
	a.version = v
}

// GetVersion returns the application version
func (a *App) GetVersion() string {
	if a.version == "" {
		return "dev"
	}
	return a.version
}

// ConnectWithADC connects to Pub/Sub using Application Default Credentials
func (a *App) ConnectWithADC(projectID string) error {
	return a.connection.ConnectWithADC(projectID)
}

// ConnectWithServiceAccount connects to Pub/Sub using a service account JSON key file
func (a *App) ConnectWithServiceAccount(projectID, keyPath string) error {
	return a.connection.ConnectWithServiceAccount(projectID, keyPath)
}

// ConnectWithOAuth connects to Pub/Sub using OAuth2 credentials
func (a *App) ConnectWithOAuth(projectID, oauthClientPath string) error {
	return a.connection.ConnectWithOAuth(projectID, oauthClientPath)
}

// Disconnect closes the current Pub/Sub connection
func (a *App) Disconnect() error {
	// Stop all active monitors before disconnecting
	a.monitorsMu.Lock()
	for subscriptionID, streamer := range a.activeMonitors {
		// Stop streamer (ignore errors during disconnect)
		streamer.Stop()
		delete(a.activeMonitors, subscriptionID)
	}

	// Cleanup temporary topic subscriptions
	client := a.clientManager.GetClient()
	projectID := a.clientManager.GetProjectID()
	if client != nil {
		for topicID, subID := range a.topicMonitors {
			_ = admin.DeleteSubscriptionAdmin(a.ctx, client, projectID, subID)
			delete(a.topicMonitors, topicID)
		}
	}
	a.monitorsMu.Unlock()

	// Clear resource store (initialize to empty slices instead of nil to avoid race conditions)
	a.resourceMu.Lock()
	a.topics = []admin.TopicInfo{}
	a.subscriptions = []admin.SubscriptionInfo{}
	a.resourceMu.Unlock()

	return a.clientManager.Close()
}

// GetProfiles returns all saved connection profiles
func (a *App) GetProfiles() []models.ConnectionProfile {
	return a.connection.GetProfiles()
}

// SaveProfile saves a connection profile to the configuration
func (a *App) SaveProfile(profile models.ConnectionProfile) error {
	return a.connection.SaveProfile(profile)
}

// DeleteProfile removes a connection profile from the configuration
func (a *App) DeleteProfile(profileID string) error {
	return a.connection.DeleteProfile(profileID, a.Disconnect)
}

// SwitchProfile switches to a different connection profile
func (a *App) SwitchProfile(profileID string) error {
	return a.connection.SwitchProfile(profileID, a.Disconnect)
}

// connectWithProfile is a helper method to connect using a profile's settings
func (a *App) connectWithProfile(profile *models.ConnectionProfile) error {
	// Set emulator host if specified in profile
	if profile.EmulatorHost != "" {
		os.Setenv("PUBSUB_EMULATOR_HOST", profile.EmulatorHost)
	}

	switch profile.AuthMethod {
	case "ADC":
		return a.connection.ConnectWithADC(profile.ProjectID)
	case "ServiceAccount":
		return a.connection.ConnectWithServiceAccount(profile.ProjectID, profile.ServiceAccountPath)
	case "OAuth":
		return a.connection.ConnectWithOAuth(profile.ProjectID, profile.OAuthClientPath)
	default:
		return fmt.Errorf("unsupported auth method: %s", profile.AuthMethod)
	}
}

// SyncResources manually triggers a resource sync (exposed for frontend refresh button)
func (a *App) SyncResources() error {
	return a.resources.SyncResources()
}

// syncResources is a helper that calls the resource handler's syncResources
func (a *App) syncResources() {
	go a.resources.SyncResources()
}

// ListTopics returns all topics in the connected project (from cached store)
func (a *App) ListTopics() ([]admin.TopicInfo, error) {
	return a.resources.ListTopics()
}

// ListSubscriptions returns all subscriptions in the connected project (from cached store)
func (a *App) ListSubscriptions() ([]admin.SubscriptionInfo, error) {
	return a.resources.ListSubscriptions()
}

// GetTopicMetadata retrieves metadata for a specific topic
func (a *App) GetTopicMetadata(topicID string) (admin.TopicInfo, error) {
	return a.resources.GetTopicMetadata(topicID)
}

// GetSubscriptionMetadata retrieves metadata for a specific subscription
func (a *App) GetSubscriptionMetadata(subID string) (admin.SubscriptionInfo, error) {
	return a.resources.GetSubscriptionMetadata(subID)
}

// Note: GetTopicSubscriptions, GetSubscriptionsUsingTopicAsDeadLetter, and GetDeadLetterTopicsForTopic
// have been removed. The frontend now filters relationships locally from the synchronized resource store
// for instant updates without API roundtrips.

// CreateTopic creates a new topic with optional message retention duration
func (a *App) CreateTopic(topicID string, messageRetentionDuration string) error {
	return a.resources.CreateTopic(topicID, messageRetentionDuration, a.syncResources)
}

// DeleteTopic deletes a topic
func (a *App) DeleteTopic(topicID string) error {
	return a.resources.DeleteTopic(topicID, a.syncResources)
}

// SubscriptionUpdateParams represents parameters for updating a subscription
type SubscriptionUpdateParams = app.SubscriptionUpdateParams

// CreateSubscription creates a new subscription for a topic
func (a *App) CreateSubscription(topicID string, subID string, ttlSeconds int64) error {
	return a.resources.CreateSubscription(topicID, subID, ttlSeconds, a.syncResources)
}

// DeleteSubscription deletes a subscription
func (a *App) DeleteSubscription(subID string) error {
	return a.resources.DeleteSubscription(subID, a.syncResources)
}

// UpdateSubscription updates a subscription's configuration
func (a *App) UpdateSubscription(subID string, params SubscriptionUpdateParams) error {
	return a.resources.UpdateSubscription(subID, params, a.syncResources)
}

// GetTemplates returns all templates, optionally filtered by topicID
// If topicID is empty, returns all templates
// If topicID is provided, returns templates linked to that topic + global templates (no topicID)
func (a *App) GetTemplates(topicID string) ([]models.MessageTemplate, error) {
	return a.templates.GetTemplates(topicID)
}

// SaveTemplate saves a message template to the configuration
func (a *App) SaveTemplate(template models.MessageTemplate) error {
	return a.templates.SaveTemplate(template)
}

// UpdateTemplate updates an existing template
func (a *App) UpdateTemplate(templateID string, template models.MessageTemplate) error {
	return a.templates.UpdateTemplate(templateID, template)
}

// DeleteTemplate removes a template from the configuration
func (a *App) DeleteTemplate(templateID string) error {
	return a.templates.DeleteTemplate(templateID)
}

// PublishResult represents the result of a publish operation
type PublishResult struct {
	MessageID string `json:"messageId"`
	Timestamp string `json:"timestamp"`
}

// PublishMessage publishes a message to a Pub/Sub topic
func (a *App) PublishMessage(topicID, payload string, attributes map[string]string) (PublishResult, error) {
	// Check connection status
	client := a.clientManager.GetClient()
	if client == nil {
		return PublishResult{}, models.ErrNotConnected
	}

	// Publish message
	pubResult, err := publisher.PublishMessageWithResult(a.ctx, client, topicID, payload, attributes)
	if err != nil {
		return PublishResult{}, fmt.Errorf("failed to publish message: %w", err)
	}

	// Convert publisher.PublishResult to app.PublishResult
	return PublishResult{
		MessageID: pubResult.MessageID,
		Timestamp: pubResult.Timestamp,
	}, nil
}

// StartMonitor starts streaming pull for a subscription
func (a *App) StartMonitor(subscriptionID string) error {
	return a.monitoring.StartMonitor(subscriptionID)
}

// StopMonitor stops streaming pull for a subscription
func (a *App) StopMonitor(subscriptionID string) error {
	return a.monitoring.StopMonitor(subscriptionID)
}

// StartTopicMonitor creates a temporary subscription and starts monitoring a topic
// If subscriptionID is provided and not empty, it uses that existing subscription instead of creating a new one
func (a *App) StartTopicMonitor(topicID string, subscriptionID string) error {
	return a.monitoring.StartTopicMonitor(topicID, subscriptionID)
}

// StopTopicMonitor stops monitoring a topic and deletes the temporary subscription
func (a *App) StopTopicMonitor(topicID string) error {
	return a.monitoring.StopTopicMonitor(topicID)
}

// GetBufferedMessages returns all messages in the buffer for a subscription
func (a *App) GetBufferedMessages(subscriptionID string) ([]subscriber.PubSubMessage, error) {
	return a.monitoring.GetBufferedMessages(subscriptionID)
}

// ClearMessageBuffer clears the message buffer for a subscription
func (a *App) ClearMessageBuffer(subscriptionID string) error {
	return a.monitoring.ClearMessageBuffer(subscriptionID)
}

// SetAutoAck updates auto-acknowledge setting
func (a *App) SetAutoAck(enabled bool) error {
	return a.configH.SetAutoAck(enabled)
}

// GetAutoAck returns current auto-ack setting
func (a *App) GetAutoAck() (bool, error) {
	return a.configH.GetAutoAck()
}

// UpdateTheme updates the theme setting and saves it to config
func (a *App) UpdateTheme(theme string) error {
	return a.configH.UpdateTheme(theme)
}

// UpdateFontSize updates the font size setting and saves it to config
func (a *App) UpdateFontSize(size string) error {
	return a.configH.UpdateFontSize(size)
}

// GetConfigFileContent returns the raw JSON content of the config file
func (a *App) GetConfigFileContent() (string, error) {
	return a.configH.GetConfigFileContent()
}

// SaveConfigFileContent saves the raw JSON content to the config file
func (a *App) SaveConfigFileContent(content string) error {
	err := a.configH.SaveConfigFileContent(content)
	// Update a.config reference if save succeeded
	if err == nil {
		// Reload config to sync with handler
		cfg, loadErr := a.configManager.LoadConfig()
		if loadErr == nil {
			a.config = cfg
		}
	}
	return err
}
