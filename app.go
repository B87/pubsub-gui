// Package main provides the Wails application entry point and Go methods exposed to the frontend
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"myproject/internal/auth"
	"myproject/internal/config"
	"myproject/internal/models"
	"myproject/internal/pubsub/admin"
	"myproject/internal/pubsub/publisher"
	"myproject/internal/pubsub/subscriber"
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
					go a.syncResources()
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

	// Sync resources after successful connection
	go a.syncResources()

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

	// Sync resources after successful connection
	go a.syncResources()

	return nil
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

	// Clear resource store
	a.resourceMu.Lock()
	a.topics = nil
	a.subscriptions = nil
	a.resourceMu.Unlock()

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

	// If this profile is set as default, unset all other defaults
	if profile.IsDefault {
		for i := range a.config.Profiles {
			a.config.Profiles[i].IsDefault = false
		}
	}

	// Set as active profile if it's new or if it's marked as default
	// This ensures newly created profiles become active
	if !found || profile.IsDefault {
		a.config.ActiveProfileID = profile.ID
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

	// Sync resources after profile switch (connectWithProfile already triggers sync, but ensure it happens)
	go a.syncResources()

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

// SyncResources manually triggers a resource sync (exposed for frontend refresh button)
func (a *App) SyncResources() error {
	if !a.clientManager.IsConnected() {
		return models.ErrNotConnected
	}
	go a.syncResources()
	return nil
}

// syncResources fetches topics and subscriptions from GCP in parallel and updates the local store
// Emits a resources:updated event to notify the frontend
func (a *App) syncResources() {
	client := a.clientManager.GetClient()
	if client == nil {
		return
	}

	projectID := a.clientManager.GetProjectID()
	if projectID == "" {
		return
	}

	// Fetch topics and subscriptions in parallel
	var topics []admin.TopicInfo
	var subscriptions []admin.SubscriptionInfo
	var topicsErr, subsErr error

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		topics, topicsErr = admin.ListTopicsAdmin(a.ctx, client, projectID)
	}()

	go func() {
		defer wg.Done()
		subscriptions, subsErr = admin.ListSubscriptionsAdmin(a.ctx, client, projectID)
	}()

	wg.Wait()

	// Handle partial failures - update what succeeded, emit errors for what failed
	hasErrors := false
	errorDetails := make(map[string]string)

	if topicsErr != nil {
		fmt.Printf("Error syncing topics: %v\n", topicsErr)
		hasErrors = true
		errorDetails["topics"] = topicsErr.Error()
		// Don't update topics on error - keep existing cache or leave empty
	}

	if subsErr != nil {
		fmt.Printf("Error syncing subscriptions: %v\n", subsErr)
		hasErrors = true
		errorDetails["subscriptions"] = subsErr.Error()
		// Don't update subscriptions on error - keep existing cache or leave empty
	}

	// Update local store with successful fetches only
	a.resourceMu.Lock()
	if topicsErr == nil {
		a.topics = topics
	}
	if subsErr == nil {
		a.subscriptions = subscriptions
	}
	a.resourceMu.Unlock()

	// Emit event to frontend with updated resources (only include successful fetches)
	updatePayload := make(map[string]interface{})
	if topicsErr == nil {
		updatePayload["topics"] = topics
	}
	if subsErr == nil {
		updatePayload["subscriptions"] = subscriptions
	}

	// Only emit update event if we have at least one successful fetch
	if len(updatePayload) > 0 {
		runtime.EventsEmit(a.ctx, "resources:updated", updatePayload)
	}

	// Emit error event if any failures occurred
	if hasErrors {
		runtime.EventsEmit(a.ctx, "resources:sync-error", map[string]interface{}{
			"errors": errorDetails,
		})
	}
}

// ListTopics returns all topics in the connected project (from cached store)
func (a *App) ListTopics() ([]admin.TopicInfo, error) {
	a.resourceMu.RLock()
	defer a.resourceMu.RUnlock()

	// Return cached topics if available
	if a.topics != nil {
		// Return a copy to prevent external modification
		result := make([]admin.TopicInfo, len(a.topics))
		copy(result, a.topics)
		return result, nil
	}

	// Fallback to empty array if not synced yet
	return []admin.TopicInfo{}, nil
}

// ListSubscriptions returns all subscriptions in the connected project (from cached store)
func (a *App) ListSubscriptions() ([]admin.SubscriptionInfo, error) {
	a.resourceMu.RLock()
	defer a.resourceMu.RUnlock()

	// Return cached subscriptions if available
	if a.subscriptions != nil {
		// Return a copy to prevent external modification
		result := make([]admin.SubscriptionInfo, len(a.subscriptions))
		copy(result, a.subscriptions)
		return result, nil
	}

	// Fallback to empty array if not synced yet
	return []admin.SubscriptionInfo{}, nil
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

// Note: GetTopicSubscriptions, GetSubscriptionsUsingTopicAsDeadLetter, and GetDeadLetterTopicsForTopic
// have been removed. The frontend now filters relationships locally from the synchronized resource store
// for instant updates without API roundtrips.

// CreateTopic creates a new topic with optional message retention duration
func (a *App) CreateTopic(topicID string, messageRetentionDuration string) error {
	client := a.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := a.clientManager.GetProjectID()
	err := admin.CreateTopicAdmin(a.ctx, client, projectID, topicID, messageRetentionDuration)
	if err != nil {
		return err
	}

	// Trigger background sync to update local store
	go a.syncResources()

	// Emit event for frontend to refresh
	runtime.EventsEmit(a.ctx, "topic:created", map[string]interface{}{
		"topicID": topicID,
	})

	return nil
}

// DeleteTopic deletes a topic
func (a *App) DeleteTopic(topicID string) error {
	client := a.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := a.clientManager.GetProjectID()
	err := admin.DeleteTopicAdmin(a.ctx, client, projectID, topicID)
	if err != nil {
		return err
	}

	// Trigger background sync to update local store
	go a.syncResources()

	// Emit event for frontend to refresh
	runtime.EventsEmit(a.ctx, "topic:deleted", map[string]interface{}{
		"topicID": topicID,
	})

	return nil
}

// SubscriptionUpdateParams represents parameters for updating a subscription
type SubscriptionUpdateParams struct {
	AckDeadline       *int                        `json:"ackDeadline,omitempty"`
	RetentionDuration *string                     `json:"retentionDuration,omitempty"`
	Filter            *string                     `json:"filter,omitempty"`
	DeadLetterPolicy  *admin.DeadLetterPolicyInfo `json:"deadLetterPolicy,omitempty"`
	PushEndpoint      *string                     `json:"pushEndpoint,omitempty"`
	SubscriptionType  *string                     `json:"subscriptionType,omitempty"`
}

// CreateSubscription creates a new subscription for a topic
func (a *App) CreateSubscription(topicID string, subID string, ttlSeconds int64) error {
	client := a.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := a.clientManager.GetProjectID()
	ttl := time.Duration(ttlSeconds) * time.Second
	err := admin.CreateSubscriptionAdmin(a.ctx, client, projectID, topicID, subID, ttl)
	if err != nil {
		return err
	}

	// Trigger background sync to update local store
	go a.syncResources()

	// Emit event for frontend to refresh
	runtime.EventsEmit(a.ctx, "subscription:created", map[string]interface{}{
		"subscriptionID": subID,
	})

	return nil
}

// DeleteSubscription deletes a subscription
func (a *App) DeleteSubscription(subID string) error {
	client := a.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := a.clientManager.GetProjectID()
	err := admin.DeleteSubscriptionAdmin(a.ctx, client, projectID, subID)
	if err != nil {
		return err
	}

	// Trigger background sync to update local store
	go a.syncResources()

	// Emit event for frontend to refresh
	runtime.EventsEmit(a.ctx, "subscription:deleted", map[string]interface{}{
		"subscriptionID": subID,
	})

	return nil
}

// UpdateSubscription updates a subscription's configuration
func (a *App) UpdateSubscription(subID string, params SubscriptionUpdateParams) error {
	client := a.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := a.clientManager.GetProjectID()

	// Convert to admin.SubscriptionUpdateParams
	adminParams := admin.SubscriptionUpdateParams{
		AckDeadline:       params.AckDeadline,
		RetentionDuration: params.RetentionDuration,
		Filter:            params.Filter,
		PushEndpoint:      params.PushEndpoint,
		SubscriptionType:  params.SubscriptionType,
	}
	if params.DeadLetterPolicy != nil {
		adminParams.DeadLetterPolicy = params.DeadLetterPolicy
	}

	err := admin.UpdateSubscriptionAdmin(a.ctx, client, projectID, subID, adminParams)
	if err != nil {
		return err
	}

	// Trigger background sync to update local store
	go a.syncResources()

	// Emit event for frontend to refresh
	runtime.EventsEmit(a.ctx, "subscription:updated", map[string]interface{}{
		"subscriptionID": subID,
	})

	return nil
}

// GetTemplates returns all templates, optionally filtered by topicID
// If topicID is empty, returns all templates
// If topicID is provided, returns templates linked to that topic + global templates (no topicID)
func (a *App) GetTemplates(topicID string) ([]models.MessageTemplate, error) {
	if a.config == nil {
		return []models.MessageTemplate{}, nil
	}

	if topicID == "" {
		// Return all templates
		return a.config.Templates, nil
	}

	// Filter templates: include if no topicID (global) or matches current topic
	filtered := []models.MessageTemplate{}
	for _, t := range a.config.Templates {
		if t.TopicID == "" || t.TopicID == topicID {
			filtered = append(filtered, t)
		}
	}

	return filtered, nil
}

// SaveTemplate saves a message template to the configuration
func (a *App) SaveTemplate(template models.MessageTemplate) error {
	// Generate ID if not provided
	if template.ID == "" {
		template.ID = models.GenerateID()
	}

	// Set timestamps if not provided
	now := time.Now().Format(time.RFC3339)
	if template.CreatedAt == "" {
		template.CreatedAt = now
	}
	template.UpdatedAt = now

	// Validate template
	if err := template.Validate(); err != nil {
		return fmt.Errorf("invalid template: %w", err)
	}

	// Check for duplicate names (excluding the template itself if updating)
	for _, t := range a.config.Templates {
		if t.Name == template.Name && t.ID != template.ID {
			return models.ErrDuplicateTemplate
		}
	}

	// Find and update existing template, or add new one
	found := false
	for i, t := range a.config.Templates {
		if t.ID == template.ID {
			a.config.Templates[i] = template
			found = true
			break
		}
	}

	if !found {
		a.config.Templates = append(a.config.Templates, template)
	}

	// Save configuration
	return a.configManager.SaveConfig(a.config)
}

// UpdateTemplate updates an existing template
func (a *App) UpdateTemplate(templateID string, template models.MessageTemplate) error {
	if templateID == "" {
		return fmt.Errorf("template ID cannot be empty")
	}

	// Set the ID to match
	template.ID = templateID
	template.UpdatedAt = time.Now().Format(time.RFC3339)

	// Validate template
	if err := template.Validate(); err != nil {
		return fmt.Errorf("invalid template: %w", err)
	}

	// Find and update existing template
	found := false
	for i, t := range a.config.Templates {
		if t.ID == templateID {
			// Preserve CreatedAt
			template.CreatedAt = t.CreatedAt
			a.config.Templates[i] = template
			found = true
			break
		}
	}

	if !found {
		return models.ErrTemplateNotFound
	}

	// Check for duplicate names (excluding the template itself)
	for _, t := range a.config.Templates {
		if t.Name == template.Name && t.ID != templateID {
			return models.ErrDuplicateTemplate
		}
	}

	// Save configuration
	return a.configManager.SaveConfig(a.config)
}

// DeleteTemplate removes a template from the configuration
func (a *App) DeleteTemplate(templateID string) error {
	if templateID == "" {
		return fmt.Errorf("template ID cannot be empty")
	}

	// Find and remove the template
	newTemplates := make([]models.MessageTemplate, 0)
	found := false
	for _, t := range a.config.Templates {
		if t.ID == templateID {
			found = true
		} else {
			newTemplates = append(newTemplates, t)
		}
	}

	if !found {
		return models.ErrTemplateNotFound
	}

	a.config.Templates = newTemplates

	// Save configuration
	return a.configManager.SaveConfig(a.config)
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
	// Check connection status
	client := a.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	// Check subscription type - only pull subscriptions can be monitored
	projectID := a.clientManager.GetProjectID()
	subInfo, err := admin.GetSubscriptionMetadataAdmin(a.ctx, client, projectID, subscriptionID)
	if err != nil {
		return fmt.Errorf("failed to get subscription metadata: %w", err)
	}

	if subInfo.SubscriptionType == "push" {
		return fmt.Errorf("monitoring is not supported for push subscriptions. Push subscriptions deliver messages via HTTP POST to an endpoint")
	}

	// Check if already monitoring this subscription
	a.monitorsMu.Lock()
	if _, exists := a.activeMonitors[subscriptionID]; exists {
		a.monitorsMu.Unlock()
		return fmt.Errorf("already monitoring subscription: %s", subscriptionID)
	}
	a.monitorsMu.Unlock()

	// Get subscriber for the subscription
	sub := client.Subscriber(subscriptionID)

	// Get buffer size from config
	bufferSize := 500 // default
	if a.config != nil && a.config.MessageBufferSize > 0 {
		bufferSize = a.config.MessageBufferSize
	}

	// Create message buffer
	buffer := subscriber.NewMessageBuffer(bufferSize)

	// Get auto-ack setting from config
	autoAck := true // default
	if a.config != nil {
		autoAck = a.config.AutoAck
	}

	// Create message streamer
	streamer := subscriber.NewMessageStreamer(a.ctx, sub, subscriptionID, buffer, autoAck)

	// Start streaming
	if err := streamer.Start(); err != nil {
		return fmt.Errorf("failed to start monitor: %w", err)
	}

	// Store active monitor
	a.monitorsMu.Lock()
	a.activeMonitors[subscriptionID] = streamer
	a.monitorsMu.Unlock()

	// Emit monitor started event
	runtime.EventsEmit(a.ctx, "monitor:started", map[string]interface{}{
		"subscriptionID": subscriptionID,
	})

	return nil
}

// StopMonitor stops streaming pull for a subscription
func (a *App) StopMonitor(subscriptionID string) error {
	a.monitorsMu.Lock()
	streamer, exists := a.activeMonitors[subscriptionID]
	if !exists {
		a.monitorsMu.Unlock()
		return fmt.Errorf("not monitoring subscription: %s", subscriptionID)
	}
	delete(a.activeMonitors, subscriptionID)
	a.monitorsMu.Unlock()

	// Stop the streamer
	if err := streamer.Stop(); err != nil {
		return fmt.Errorf("failed to stop monitor: %w", err)
	}

	// Emit monitor stopped event
	runtime.EventsEmit(a.ctx, "monitor:stopped", map[string]interface{}{
		"subscriptionID": subscriptionID,
	})

	return nil
}

// findExistingMonitoringSubscription searches for an existing subscription
// that matches the monitoring pattern for the given topic
func (a *App) findExistingMonitoringSubscription(topicID string) (string, error) {
	// Get subscriptions from cached store
	a.resourceMu.RLock()
	subscriptions := a.subscriptions
	a.resourceMu.RUnlock()

	if subscriptions == nil {
		return "", fmt.Errorf("subscriptions not yet synced")
	}

	// Extract short topic name
	topicName := topicID
	if parts := strings.Split(topicID, "/"); len(parts) > 0 {
		topicName = parts[len(parts)-1]
	}
	shortTopic := topicName
	if len(shortTopic) > 20 {
		shortTopic = shortTopic[:20]
	}

	// Build pattern prefix
	patternPrefix := fmt.Sprintf("ps-gui-mon-%s-", shortTopic)

	// Normalize topic ID for comparison
	projectID := a.clientManager.GetProjectID()
	normalizedTopicID := topicID
	if !strings.HasPrefix(topicID, "projects/") {
		normalizedTopicID = fmt.Sprintf("projects/%s/topics/%s", projectID, topicID)
	}

	// Search for matching subscription
	for _, sub := range subscriptions {
		// Extract subscription ID from full name
		subID := sub.DisplayName
		if strings.HasPrefix(sub.Name, "projects/") {
			parts := strings.Split(sub.Name, "/")
			if len(parts) >= 4 && parts[2] == "subscriptions" {
				subID = parts[3]
			}
		}

		// Check if it matches the pattern and is linked to the target topic
		if strings.HasPrefix(subID, patternPrefix) && sub.Topic == normalizedTopicID {
			// Verify it's a pull subscription (required for monitoring)
			if sub.SubscriptionType == "pull" {
				return subID, nil
			}
		}
	}

	return "", nil // No existing subscription found
}

// StartTopicMonitor creates a temporary subscription and starts monitoring a topic
// If subscriptionID is provided and not empty, it uses that existing subscription instead of creating a new one
func (a *App) StartTopicMonitor(topicID string, subscriptionID string) error {
	// Check connection status
	client := a.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := a.clientManager.GetProjectID()

	// Check if already monitoring this topic
	a.monitorsMu.Lock()
	if subID, exists := a.topicMonitors[topicID]; exists {
		a.monitorsMu.Unlock()
		// If it exists but not in activeMonitors, something is inconsistent
		// but let's just return error for now
		return fmt.Errorf("already monitoring topic: %s with subscription %s", topicID, subID)
	}
	a.monitorsMu.Unlock()

	var subID string
	var isNewSubscription bool

	// If subscriptionID is provided, validate and use it
	if subscriptionID != "" {
		// Normalize subscription ID (extract short name if full path provided)
		shortSubID := subscriptionID
		if strings.HasPrefix(subscriptionID, "projects/") {
			// Extract subscription ID from full path: projects/{project}/subscriptions/{sub-id}
			parts := strings.Split(subscriptionID, "/")
			if len(parts) >= 4 && parts[0] == "projects" && parts[2] == "subscriptions" {
				shortSubID = parts[3]
			}
		}

		// Validate subscription exists and is a pull subscription
		subInfo, err := admin.GetSubscriptionMetadataAdmin(a.ctx, client, projectID, shortSubID)
		if err != nil {
			return fmt.Errorf("failed to get subscription metadata: %w", err)
		}

		// Check subscription type - only pull subscriptions can be monitored
		if subInfo.SubscriptionType == "push" {
			return fmt.Errorf("monitoring is not supported for push subscriptions. Push subscriptions deliver messages via HTTP POST to an endpoint")
		}

		// Normalize topic ID for comparison
		normalizedTopicID := topicID
		if !strings.HasPrefix(topicID, "projects/") {
			normalizedTopicID = fmt.Sprintf("projects/%s/topics/%s", projectID, topicID)
		}

		// Verify subscription is subscribed to the target topic
		if subInfo.Topic != normalizedTopicID {
			return fmt.Errorf("subscription %s is not subscribed to topic %s", shortSubID, topicID)
		}

		// Check if the subscription is already being monitored
		a.monitorsMu.RLock()
		if _, alreadyMonitored := a.activeMonitors[shortSubID]; alreadyMonitored {
			a.monitorsMu.RUnlock()
			return fmt.Errorf("subscription %s is already being monitored", shortSubID)
		}
		a.monitorsMu.RUnlock()

		// Use the provided subscription
		subID = shortSubID
		isNewSubscription = false
	} else {
		// Auto-create mode: Check for existing monitoring subscription
		existingSubID, err := a.findExistingMonitoringSubscription(topicID)
		if err != nil {
			return fmt.Errorf("failed to search for existing subscription: %w", err)
		}

		if existingSubID != "" {
			// Check if the existing subscription is already being monitored
			a.monitorsMu.RLock()
			if _, alreadyMonitored := a.activeMonitors[existingSubID]; alreadyMonitored {
				a.monitorsMu.RUnlock()
				return fmt.Errorf("subscription %s is already being monitored", existingSubID)
			}
			a.monitorsMu.RUnlock()

			// Reuse existing subscription
			subID = existingSubID
			isNewSubscription = false
		} else {
			// Generate a unique subscription ID for monitoring
			// Format: ps-gui-mon-{short-topic}-{random}
			// Extract the actual topic name from the full resource path if necessary
			topicName := topicID
			if parts := strings.Split(topicID, "/"); len(parts) > 0 {
				topicName = parts[len(parts)-1]
			}

			shortTopic := topicName
			if len(shortTopic) > 20 {
				shortTopic = shortTopic[:20]
			}
			subID = fmt.Sprintf("ps-gui-mon-%s-%d", shortTopic, time.Now().UnixNano()%1000000)

			// Create temporary subscription with 24h TTL
			if err := admin.CreateSubscriptionAdmin(a.ctx, client, projectID, topicID, subID, 24*time.Hour); err != nil {
				return fmt.Errorf("failed to create temporary subscription: %w", err)
			}
			isNewSubscription = true
		}
	}

	// Start monitoring the subscription
	if err := a.StartMonitor(subID); err != nil {
		// Cleanup subscription if it was newly created and monitoring fails to start
		if isNewSubscription {
			_ = admin.DeleteSubscriptionAdmin(a.ctx, client, projectID, subID)
		}
		return fmt.Errorf("failed to start monitor for topic: %w", err)
	}

	// Store mapping
	a.monitorsMu.Lock()
	a.topicMonitors[topicID] = subID
	a.monitorsMu.Unlock()

	return nil
}

// StopTopicMonitor stops monitoring a topic and deletes the temporary subscription
func (a *App) StopTopicMonitor(topicID string) error {
	a.monitorsMu.Lock()
	subID, exists := a.topicMonitors[topicID]
	if !exists {
		a.monitorsMu.Unlock()
		// Return nil if not found - this happens during fast React re-renders/unmounts
		// where Stop is called before Start finished storing the mapping.
		return nil
	}
	delete(a.topicMonitors, topicID)
	a.monitorsMu.Unlock()

	// Stop the monitor first
	stopErr := a.StopMonitor(subID)
	if stopErr != nil {
		// Log error - streamer may still be running
		fmt.Printf("Error stopping monitor %s: %v\n", subID, stopErr)
		// Continue to try deleting subscription, but handle errors gracefully
		// The subscription has TTL so it will be cleaned up eventually if deletion fails
	}

	// Small delay to ensure streamer has fully stopped (if it did stop)
	if stopErr == nil {
		time.Sleep(100 * time.Millisecond)
	}

	// Delete the temporary subscription
	// Handle errors gracefully - subscription might already be deleted or streamer might still be using it
	client := a.clientManager.GetClient()
	if client != nil {
		projectID := a.clientManager.GetProjectID()
		if err := admin.DeleteSubscriptionAdmin(a.ctx, client, projectID, subID); err != nil {
			// Log but don't fail - subscription might already be deleted, will be cleaned up by TTL, or streamer is still using it
			fmt.Printf("Warning: failed to delete temporary subscription %s: %v (will be cleaned up by TTL)\n", subID, err)
		}
	}

	// Return nil even if there were errors - subscription will be cleaned up by TTL
	return nil
}

// GetBufferedMessages returns all messages in the buffer for a subscription
func (a *App) GetBufferedMessages(subscriptionID string) ([]subscriber.PubSubMessage, error) {
	a.monitorsMu.RLock()
	streamer, exists := a.activeMonitors[subscriptionID]
	a.monitorsMu.RUnlock()

	if !exists {
		return []subscriber.PubSubMessage{}, fmt.Errorf("not monitoring subscription: %s", subscriptionID)
	}

	// Get buffer and return messages
	buffer := streamer.GetBuffer()
	return buffer.GetMessages(), nil
}

// ClearMessageBuffer clears the message buffer for a subscription
func (a *App) ClearMessageBuffer(subscriptionID string) error {
	a.monitorsMu.RLock()
	streamer, exists := a.activeMonitors[subscriptionID]
	a.monitorsMu.RUnlock()

	if !exists {
		return fmt.Errorf("not monitoring subscription: %s", subscriptionID)
	}

	// Clear buffer
	buffer := streamer.GetBuffer()
	buffer.Clear()

	return nil
}

// SetAutoAck updates auto-acknowledge setting
func (a *App) SetAutoAck(enabled bool) error {
	if a.config == nil {
		return fmt.Errorf("config not initialized")
	}

	// Update config
	a.config.AutoAck = enabled

	// Save config
	if err := a.configManager.SaveConfig(a.config); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	// Update all active monitors
	a.monitorsMu.RLock()
	for _, streamer := range a.activeMonitors {
		streamer.SetAutoAck(enabled)
	}
	a.monitorsMu.RUnlock()

	return nil
}

// GetAutoAck returns current auto-ack setting
func (a *App) GetAutoAck() (bool, error) {
	if a.config == nil {
		return true, nil // default
	}
	return a.config.AutoAck, nil
}

// GetConfigFileContent returns the raw JSON content of the config file
func (a *App) GetConfigFileContent() (string, error) {
	if a.configManager == nil {
		return "", fmt.Errorf("config manager not initialized")
	}

	// Load current config
	config, err := a.configManager.LoadConfig()
	if err != nil {
		return "", fmt.Errorf("failed to load config: %w", err)
	}

	// Marshal to JSON with indentation
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal config: %w", err)
	}

	return string(data), nil
}

// SaveConfigFileContent saves the raw JSON content to the config file
func (a *App) SaveConfigFileContent(content string) error {
	if a.configManager == nil {
		return fmt.Errorf("config manager not initialized")
	}

	// Validate JSON syntax
	var tempConfig models.AppConfig
	if err := json.Unmarshal([]byte(content), &tempConfig); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}

	// Validate config structure
	if tempConfig.MessageBufferSize < 100 || tempConfig.MessageBufferSize > 10000 {
		return fmt.Errorf("messageBufferSize must be between 100 and 10000")
	}

	if tempConfig.Theme != "light" && tempConfig.Theme != "dark" && tempConfig.Theme != "auto" && tempConfig.Theme != "dracula" && tempConfig.Theme != "monokai" {
		return fmt.Errorf("theme must be 'light', 'dark', 'auto', 'dracula', or 'monokai'")
	}

	if tempConfig.FontSize != "small" && tempConfig.FontSize != "medium" && tempConfig.FontSize != "large" {
		return fmt.Errorf("fontSize must be 'small', 'medium', or 'large'")
	}

	// Store old values to detect changes
	oldTheme := ""
	oldFontSize := ""
	oldAutoAck := false
	if a.config != nil {
		oldTheme = a.config.Theme
		oldFontSize = a.config.FontSize
		oldAutoAck = a.config.AutoAck
	}

	// Save config
	if err := a.configManager.SaveConfig(&tempConfig); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	// Reload config into memory
	a.config = &tempConfig

	// Apply theme changes if theme was modified
	if oldTheme != tempConfig.Theme {
		// Emit event to frontend to apply theme change
		// Frontend will handle theme application using Wails runtime methods
		runtime.EventsEmit(a.ctx, "config:theme-changed", tempConfig.Theme)
	}

	// Apply font size changes if font size was modified
	if oldFontSize != tempConfig.FontSize {
		// Emit event to frontend to apply font size change
		runtime.EventsEmit(a.ctx, "config:font-size-changed", tempConfig.FontSize)
	}

	// Update auto-ack for all active monitors if it changed
	if oldAutoAck != tempConfig.AutoAck {
		a.monitorsMu.RLock()
		for _, streamer := range a.activeMonitors {
			streamer.SetAutoAck(tempConfig.AutoAck)
		}
		a.monitorsMu.RUnlock()
	}

	return nil
}
