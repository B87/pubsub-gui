// Package app provides handler structs for organizing App methods by domain
package app

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"pubsub-gui/internal/auth"
	"pubsub-gui/internal/logger"
	"pubsub-gui/internal/models"
	"pubsub-gui/internal/pubsub/admin"
	"pubsub-gui/internal/pubsub/subscriber"
)

// MonitoringHandler handles message monitoring operations
type MonitoringHandler struct {
	ctx            context.Context
	config         *models.AppConfig
	clientManager  *auth.ClientManager
	activeMonitors map[string]*subscriber.MessageStreamer
	topicMonitors  map[string]string
	monitorsMu     *sync.RWMutex
	resourceMu     *sync.RWMutex
	subscriptions  *[]admin.SubscriptionInfo
}

// NewMonitoringHandler creates a new monitoring handler
func NewMonitoringHandler(
	ctx context.Context,
	config *models.AppConfig,
	clientManager *auth.ClientManager,
	activeMonitors map[string]*subscriber.MessageStreamer,
	topicMonitors map[string]string,
	monitorsMu *sync.RWMutex,
	resourceMu *sync.RWMutex,
	subscriptions *[]admin.SubscriptionInfo,
) *MonitoringHandler {
	return &MonitoringHandler{
		ctx:            ctx,
		config:         config,
		clientManager:  clientManager,
		activeMonitors: activeMonitors,
		topicMonitors:  topicMonitors,
		monitorsMu:     monitorsMu,
		resourceMu:     resourceMu,
		subscriptions:  subscriptions,
	}
}

// StartMonitor starts streaming pull for a subscription
func (h *MonitoringHandler) StartMonitor(subscriptionID string) error {
	// Check connection status
	client := h.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	// Check subscription type - only pull subscriptions can be monitored
	projectID := h.clientManager.GetProjectID()
	subInfo, err := admin.GetSubscriptionMetadataAdmin(h.ctx, client, projectID, subscriptionID)
	if err != nil {
		return fmt.Errorf("failed to get subscription metadata: %w", err)
	}

	if subInfo.SubscriptionType == "push" {
		return fmt.Errorf("monitoring is not supported for push subscriptions. Push subscriptions deliver messages via HTTP POST to an endpoint")
	}

	// Check if already monitoring this subscription
	h.monitorsMu.Lock()
	if _, exists := h.activeMonitors[subscriptionID]; exists {
		h.monitorsMu.Unlock()
		return fmt.Errorf("already monitoring subscription: %s", subscriptionID)
	}
	h.monitorsMu.Unlock()

	// Get subscriber for the subscription
	sub := client.Subscriber(subscriptionID)

	// Get buffer size from config
	bufferSize := 500 // default
	if h.config != nil && h.config.MessageBufferSize > 0 {
		bufferSize = h.config.MessageBufferSize
	}

	// Create message buffer
	buffer := subscriber.NewMessageBuffer(bufferSize)

	// Get auto-ack setting from config
	autoAck := true // default
	if h.config != nil {
		autoAck = h.config.AutoAck
	}

	// Create message streamer
	streamer := subscriber.NewMessageStreamer(h.ctx, sub, subscriptionID, buffer, autoAck)

	// Start streaming
	if err := streamer.Start(); err != nil {
		return fmt.Errorf("failed to start monitor: %w", err)
	}

	// Store active monitor
	h.monitorsMu.Lock()
	h.activeMonitors[subscriptionID] = streamer
	h.monitorsMu.Unlock()

	// Emit monitor started event
	runtime.EventsEmit(h.ctx, "monitor:started", map[string]interface{}{
		"subscriptionID": subscriptionID,
	})

	return nil
}

// StopMonitor stops streaming pull for a subscription
func (h *MonitoringHandler) StopMonitor(subscriptionID string) error {
	h.monitorsMu.Lock()
	streamer, exists := h.activeMonitors[subscriptionID]
	if !exists {
		h.monitorsMu.Unlock()
		return fmt.Errorf("not monitoring subscription: %s", subscriptionID)
	}
	delete(h.activeMonitors, subscriptionID)
	h.monitorsMu.Unlock()

	// Stop the streamer
	if err := streamer.Stop(); err != nil {
		return fmt.Errorf("failed to stop monitor: %w", err)
	}

	// Emit monitor stopped event
	runtime.EventsEmit(h.ctx, "monitor:stopped", map[string]interface{}{
		"subscriptionID": subscriptionID,
	})

	return nil
}

// findExistingMonitoringSubscription searches for an existing subscription
// that matches the monitoring pattern for the given topic
func (h *MonitoringHandler) findExistingMonitoringSubscription(topicID string) (string, error) {
	// Get subscriptions from cached store
	h.resourceMu.RLock()
	subscriptions := *h.subscriptions
	h.resourceMu.RUnlock()

	// If subscriptions is nil (shouldn't happen, but defensive check), treat as empty
	if subscriptions == nil {
		subscriptions = []admin.SubscriptionInfo{}
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
	projectID := h.clientManager.GetProjectID()
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
func (h *MonitoringHandler) StartTopicMonitor(topicID string, subscriptionID string) error {
	// Check connection status
	client := h.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()

	// Check if already monitoring this topic
	h.monitorsMu.Lock()
	if subID, exists := h.topicMonitors[topicID]; exists {
		h.monitorsMu.Unlock()
		return fmt.Errorf("already monitoring topic: %s with subscription %s", topicID, subID)
	}
	h.monitorsMu.Unlock()

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
		subInfo, err := admin.GetSubscriptionMetadataAdmin(h.ctx, client, projectID, shortSubID)
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
		h.monitorsMu.RLock()
		if _, alreadyMonitored := h.activeMonitors[shortSubID]; alreadyMonitored {
			h.monitorsMu.RUnlock()
			return fmt.Errorf("subscription %s is already being monitored", shortSubID)
		}
		h.monitorsMu.RUnlock()

		// Use the provided subscription
		subID = shortSubID
		isNewSubscription = false
	} else {
		// Auto-create mode: Check for existing monitoring subscription
		existingSubID, err := h.findExistingMonitoringSubscription(topicID)
		if err != nil {
			return fmt.Errorf("failed to search for existing subscription: %w", err)
		}

		if existingSubID != "" {
			// Check if the existing subscription is already being monitored
			h.monitorsMu.RLock()
			if _, alreadyMonitored := h.activeMonitors[existingSubID]; alreadyMonitored {
				h.monitorsMu.RUnlock()
				return fmt.Errorf("subscription %s is already being monitored", existingSubID)
			}
			h.monitorsMu.RUnlock()

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
			if err := admin.CreateSubscriptionAdmin(h.ctx, client, projectID, topicID, subID, 24*time.Hour); err != nil {
				return fmt.Errorf("failed to create temporary subscription: %w", err)
			}
			isNewSubscription = true
		}
	}

	// Start monitoring the subscription
	if err := h.StartMonitor(subID); err != nil {
		// Cleanup subscription if it was newly created and monitoring fails to start
		if isNewSubscription {
			_ = admin.DeleteSubscriptionAdmin(h.ctx, client, projectID, subID)
		}
		return fmt.Errorf("failed to start monitor for topic: %w", err)
	}

	// Store mapping
	h.monitorsMu.Lock()
	h.topicMonitors[topicID] = subID
	h.monitorsMu.Unlock()

	return nil
}

// StopTopicMonitor stops monitoring a topic and deletes the temporary subscription
func (h *MonitoringHandler) StopTopicMonitor(topicID string) error {
	h.monitorsMu.Lock()
	subID, exists := h.topicMonitors[topicID]
	if !exists {
		h.monitorsMu.Unlock()
		// Return nil if not found - this happens during fast React re-renders/unmounts
		// where Stop is called before Start finished storing the mapping.
		return nil
	}
	delete(h.topicMonitors, topicID)
	h.monitorsMu.Unlock()

	// Stop the monitor first
	stopErr := h.StopMonitor(subID)
	if stopErr != nil {
		// Log error - streamer may still be running
		logger.Error("Error stopping monitor", "subscriptionID", subID, "error", stopErr)
		// Continue to try deleting subscription, but handle errors gracefully
		// The subscription has TTL so it will be cleaned up eventually if deletion fails
	}

	// Small delay to ensure streamer has fully stopped (if it did stop)
	if stopErr == nil {
		time.Sleep(100 * time.Millisecond)
	}

	// Delete the temporary subscription
	// Handle errors gracefully - subscription might already be deleted or streamer might still be using it
	client := h.clientManager.GetClient()
	if client != nil {
		projectID := h.clientManager.GetProjectID()
		if err := admin.DeleteSubscriptionAdmin(h.ctx, client, projectID, subID); err != nil {
			// Log but don't fail - subscription might already be deleted, will be cleaned up by TTL, or streamer is still using it
			logger.Warn("Failed to delete temporary subscription (will be cleaned up by TTL)", "subscriptionID", subID, "error", err)
		}
	}

	// Return nil even if there were errors - subscription will be cleaned up by TTL
	return nil
}

// GetBufferedMessages returns all messages in the buffer for a subscription
func (h *MonitoringHandler) GetBufferedMessages(subscriptionID string) ([]subscriber.PubSubMessage, error) {
	h.monitorsMu.RLock()
	streamer, exists := h.activeMonitors[subscriptionID]
	h.monitorsMu.RUnlock()

	if !exists {
		return []subscriber.PubSubMessage{}, fmt.Errorf("not monitoring subscription: %s", subscriptionID)
	}

	// Get buffer and return messages
	buffer := streamer.GetBuffer()
	return buffer.GetMessages(), nil
}

// ClearMessageBuffer clears the message buffer for a subscription
func (h *MonitoringHandler) ClearMessageBuffer(subscriptionID string) error {
	h.monitorsMu.RLock()
	streamer, exists := h.activeMonitors[subscriptionID]
	h.monitorsMu.RUnlock()

	if !exists {
		return fmt.Errorf("not monitoring subscription: %s", subscriptionID)
	}

	// Clear buffer
	buffer := streamer.GetBuffer()
	buffer.Clear()

	return nil
}
