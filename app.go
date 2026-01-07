// Package main provides the Wails application entry point and Go methods exposed to the frontend
package main

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	"cloud.google.com/go/pubsub/v2"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"pubsub-gui/internal/app"
	"pubsub-gui/internal/auth"
	"pubsub-gui/internal/config"
	"pubsub-gui/internal/models"
	"pubsub-gui/internal/pubsub/admin"
	"pubsub-gui/internal/pubsub/publisher"
	"pubsub-gui/internal/pubsub/subscriber"
	versionpkg "pubsub-gui/internal/version"
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
	connection                 *app.ConnectionHandler
	resources                  *app.ResourceHandler
	templates                  *app.TemplateHandler
	topicSubscriptionTemplates *app.TopicSubscriptionTemplateHandler
	monitoring                 *app.MonitoringHandler
	configH                    *app.ConfigHandler

	// Application version
	version string

	// Upgrade check fields
	upgradeCheckMu     sync.Mutex
	lastUpgradeCheck   time.Time
	upgradeCheckTicker *time.Ticker
	upgradeCheckTimer  *time.Timer
	upgradeCheckDone   chan struct{}
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
	a.topicSubscriptionTemplates = app.NewTopicSubscriptionTemplateHandler(
		a.ctx,
		a.clientManager,
		a.config,
		a.configManager,
	)
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

	// Start periodic upgrade checking
	a.StartPeriodicUpgradeCheck()
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

// GetCurrentVersion returns the application version
// This is an alias for GetVersion() to match the upgrade check API
func (a *App) GetCurrentVersion() string {
	return a.GetVersion()
}

// CheckForUpdates checks if a newer version is available
// Updates lastUpgradeCheck timestamp and saves to config
func (a *App) CheckForUpdates() (*versionpkg.UpdateInfo, error) {
	// Set version in version package so CheckForUpdates can use it
	versionpkg.SetVersion(a.GetVersion())

	// Call version.CheckForUpdates()
	updateInfo, err := versionpkg.CheckForUpdates()
	if err != nil {
		return nil, fmt.Errorf("failed to check for updates: %w", err)
	}

	// Update lastUpgradeCheck timestamp
	a.upgradeCheckMu.Lock()
	a.lastUpgradeCheck = time.Now()
	if a.config != nil {
		a.config.LastUpgradeCheck = a.lastUpgradeCheck
	}
	a.upgradeCheckMu.Unlock()

	// Save config
	if a.configManager != nil && a.config != nil {
		if err := a.configManager.SaveConfig(a.config); err != nil {
			// Log error but don't fail the check
			fmt.Printf("Warning: failed to save last upgrade check time: %v\n", err)
		}
	}

	return updateInfo, nil
}

// StartPeriodicUpgradeCheck starts the periodic upgrade checking mechanism
// Checks if auto-check is enabled, calculates interval, and schedules checks
func (a *App) StartPeriodicUpgradeCheck() {
	a.upgradeCheckMu.Lock()
	defer a.upgradeCheckMu.Unlock()

	// Check if auto-check is enabled
	if a.config == nil || !a.config.AutoCheckUpgrades {
		return
	}

	// Calculate interval (default 24 hours)
	intervalHours := a.config.UpgradeCheckInterval
	if intervalHours <= 0 {
		intervalHours = 24
	}
	interval := time.Duration(intervalHours) * time.Hour

	// Check if enough time has passed since last check
	lastCheck := a.config.LastUpgradeCheck
	if !lastCheck.IsZero() {
		timeSinceLastCheck := time.Since(lastCheck)
		if timeSinceLastCheck < interval {
			// Schedule next check for the remaining time
			remainingTime := interval - timeSinceLastCheck
			a.scheduleNextUpgradeCheck(remainingTime)
			return
		}
	}

	// Perform initial check immediately (in background)
	go a.performUpgradeCheck()

	// Schedule periodic checks
	a.scheduleNextUpgradeCheck(interval)
}

// scheduleNextUpgradeCheck schedules the next upgrade check after the specified delay
// Stops existing ticker and timer if any, uses time.AfterFunc for delayed check, then starts periodic ticker
func (a *App) scheduleNextUpgradeCheck(delay time.Duration) {
	a.upgradeCheckMu.Lock()
	defer a.upgradeCheckMu.Unlock()

	// Stop existing ticker if running
	if a.upgradeCheckTicker != nil {
		a.upgradeCheckTicker.Stop()
		a.upgradeCheckTicker = nil
	}

	// Stop existing timer if running
	if a.upgradeCheckTimer != nil {
		a.upgradeCheckTimer.Stop()
		a.upgradeCheckTimer = nil
	}

	// Close existing done channel if any (to signal old goroutine to exit)
	// Use select to avoid panicking if channel is already closed
	if a.upgradeCheckDone != nil {
		select {
		case <-a.upgradeCheckDone:
			// Already closed, do nothing
		default:
			close(a.upgradeCheckDone)
		}
	}

	// Create fresh done channel for new goroutine
	a.upgradeCheckDone = make(chan struct{})

	// Store done channel in local variable for use in closure
	done := a.upgradeCheckDone

	// Use time.AfterFunc for the first delayed check
	a.upgradeCheckTimer = time.AfterFunc(delay, func() {
		// Perform check
		a.performUpgradeCheck()

		// After first check, start periodic ticker
		a.upgradeCheckMu.Lock()

		// Check if we should exit (done channel closed)
		select {
		case <-done:
			a.upgradeCheckMu.Unlock()
			return
		default:
		}

		// Calculate interval for periodic checks
		intervalHours := a.config.UpgradeCheckInterval
		if intervalHours <= 0 {
			intervalHours = 24
		}
		interval := time.Duration(intervalHours) * time.Hour

		// Start periodic ticker
		a.upgradeCheckTicker = time.NewTicker(interval)
		ticker := a.upgradeCheckTicker
		a.upgradeCheckMu.Unlock()

		// Run periodic goroutine with select to allow clean exit
		go func() {
			for {
				select {
				case <-done:
					// Exit when done channel is closed
					return
				case <-ticker.C:
					// Perform periodic check
					a.performUpgradeCheck()
				}
			}
		}()
	})
}

// performUpgradeCheck performs an upgrade check and emits event if update is available
// Calls CheckForUpdates() and emits upgrade:available event if update available and not dismissed
func (a *App) performUpgradeCheck() {
	updateInfo, err := a.CheckForUpdates()
	if err != nil {
		// Log error but don't notify user (silent failure)
		fmt.Printf("Upgrade check failed: %v\n", err)
		return
	}

	// Check if update is available and not dismissed
	if updateInfo != nil && updateInfo.IsUpdateAvailable {
		// Check if this version was already dismissed (with mutex protection)
		a.upgradeCheckMu.Lock()
		dismissedVersion := ""
		if a.config != nil {
			dismissedVersion = a.config.DismissedUpgradeVersion
		}
		a.upgradeCheckMu.Unlock()

		if dismissedVersion == updateInfo.LatestVersion {
			return
		}

		// Emit upgrade:available event
		runtime.EventsEmit(a.ctx, "upgrade:available", updateInfo)
	}
}

// DismissUpgradeNotification dismisses the upgrade notification for a specific version
// Updates config with dismissed version and saves config
func (a *App) DismissUpgradeNotification(version string) error {
	if a.config == nil {
		return fmt.Errorf("config not initialized")
	}

	a.upgradeCheckMu.Lock()
	a.config.DismissedUpgradeVersion = version
	a.upgradeCheckMu.Unlock()

	// Save config
	if a.configManager != nil {
		if err := a.configManager.SaveConfig(a.config); err != nil {
			return fmt.Errorf("failed to save config: %w", err)
		}
	}

	return nil
}

// OpenReleasesPage opens the GitHub releases page in the default browser
// Uses runtime.BrowserOpenURL(ctx, url) to open the URL
func (a *App) OpenReleasesPage(url string) error {
	if url == "" {
		return fmt.Errorf("URL cannot be empty")
	}
	runtime.BrowserOpenURL(a.ctx, url)
	return nil
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
	a.stopAllMonitors()
	time.Sleep(100 * time.Millisecond) // Give monitors a brief moment to start stopping

	// Capture client and projectID BEFORE Close() to avoid race condition
	// The cleanup goroutine will use these captured values
	client := a.clientManager.GetClient()
	projectID := a.clientManager.GetProjectID()

	a.cleanupTemporarySubscriptions(client, projectID)
	a.clearResourceStore()
	a.stopUpgradeCheck()
	return a.clientManager.Close()
}

// stopAllMonitors stops all active monitors asynchronously to avoid blocking
func (a *App) stopAllMonitors() {
	a.monitorsMu.Lock()
	monitorsToStop := make(map[string]*subscriber.MessageStreamer)
	for subscriptionID, streamer := range a.activeMonitors {
		monitorsToStop[subscriptionID] = streamer
		delete(a.activeMonitors, subscriptionID)
	}
	a.monitorsMu.Unlock()

	go func() {
		for subscriptionID, streamer := range monitorsToStop {
			subID := subscriptionID
			s := streamer
			done := make(chan error, 1)
			go func(subID string, s *subscriber.MessageStreamer) {
				done <- s.Stop()
			}(subID, s)

			select {
			case <-done:
			case <-time.After(2 * time.Second):
				fmt.Printf("Warning: timeout stopping monitor %s during disconnect\n", subID)
			}
		}
	}()
}

// cleanupTemporarySubscriptions deletes temporary topic subscriptions asynchronously
// client and projectID are passed in to ensure they are captured before Close() is called
func (a *App) cleanupTemporarySubscriptions(client *pubsub.Client, projectID string) {
	a.monitorsMu.Lock()
	topicMonitorsCopy := make(map[string]string)
	for k, v := range a.topicMonitors {
		topicMonitorsCopy[k] = v
	}
	a.monitorsMu.Unlock()

	if client != nil && len(topicMonitorsCopy) > 0 {
		ctx := a.ctx
		cl := client
		projID := projectID
		go func() {
			for topicID, subID := range topicMonitorsCopy {
				tid := topicID
				sid := subID
				done := make(chan error, 1)
				go func(tid, sid string) {
					done <- admin.DeleteSubscriptionAdmin(ctx, cl, projID, sid)
				}(tid, sid)

				select {
				case <-done:
				case <-time.After(2 * time.Second):
					fmt.Printf("Warning: timeout deleting temporary subscription %s during disconnect\n", sid)
				}
			}
		}()

		a.monitorsMu.Lock()
		for topicID := range topicMonitorsCopy {
			delete(a.topicMonitors, topicID)
		}
		a.monitorsMu.Unlock()
	}
}

// clearResourceStore clears the resource store (initialize to empty slices instead of nil)
func (a *App) clearResourceStore() {
	a.resourceMu.Lock()
	a.topics = []admin.TopicInfo{}
	a.subscriptions = []admin.SubscriptionInfo{}
	a.resourceMu.Unlock()
}

// stopUpgradeCheck stops upgrade check ticker and timer if running
func (a *App) stopUpgradeCheck() {
	timeout := 500 * time.Millisecond
	retryInterval := 50 * time.Millisecond
	deadline := time.Now().Add(timeout)
	lockAcquired := false

	for time.Now().Before(deadline) {
		if a.upgradeCheckMu.TryLock() {
			lockAcquired = true
			break
		}
		time.Sleep(retryInterval)
	}

	if lockAcquired {
		if a.upgradeCheckTicker != nil {
			a.upgradeCheckTicker.Stop()
			a.upgradeCheckTicker = nil
		}
		if a.upgradeCheckTimer != nil {
			a.upgradeCheckTimer.Stop()
			a.upgradeCheckTimer = nil
		}
		if a.upgradeCheckDone != nil {
			select {
			case <-a.upgradeCheckDone:
			default:
				close(a.upgradeCheckDone)
			}
			a.upgradeCheckDone = nil
		}
		a.upgradeCheckMu.Unlock()
	} else {
		fmt.Printf("Warning: timeout acquiring upgrade check lock during disconnect (upgrade check may be stuck)\n")
	}
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

// GetTopicSubscriptionTemplates returns all topic/subscription templates (built-in and custom)
func (a *App) GetTopicSubscriptionTemplates() ([]*models.TopicSubscriptionTemplate, error) {
	return a.topicSubscriptionTemplates.GetTemplates()
}

// GetTopicSubscriptionTemplatesByCategory returns templates filtered by category
func (a *App) GetTopicSubscriptionTemplatesByCategory(category string) ([]*models.TopicSubscriptionTemplate, error) {
	return a.topicSubscriptionTemplates.GetTemplatesByCategory(category)
}

// CreateFromTemplate creates resources from a topic/subscription template
func (a *App) CreateFromTemplate(request models.TemplateCreateRequest) (models.TemplateCreateResult, error) {
	result, err := a.topicSubscriptionTemplates.CreateFromTemplate(&request)
	if err != nil {
		return models.TemplateCreateResult{
			Success: false,
			Error:   err.Error(),
		}, err
	}

	// Defensive check: ensure result is not nil before dereferencing
	if result == nil {
		return models.TemplateCreateResult{
			Success: false,
			Error:   "internal error: CreateFromTemplate returned nil result",
		}, fmt.Errorf("CreateFromTemplate returned nil result")
	}

	// If successful, trigger resource sync and emit event
	if result.Success {
		// Trigger background sync to update local store
		go a.resources.SyncResources()

		// Emit event for frontend
		runtime.EventsEmit(a.ctx, "template:created", map[string]interface{}{
			"templateId":      request.TemplateID,
			"topicId":         result.TopicID,
			"subscriptionIds": result.SubscriptionIDs,
		})
	}

	return *result, nil
}

// SaveCustomTopicSubscriptionTemplate saves a custom topic/subscription template
func (a *App) SaveCustomTopicSubscriptionTemplate(template models.TopicSubscriptionTemplate) error {
	return a.topicSubscriptionTemplates.SaveCustomTemplate(&template)
}

// DeleteCustomTopicSubscriptionTemplate deletes a custom topic/subscription template
func (a *App) DeleteCustomTopicSubscriptionTemplate(templateID string) error {
	return a.topicSubscriptionTemplates.DeleteCustomTemplate(templateID)
}
