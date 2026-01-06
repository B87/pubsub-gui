// Package app provides handler structs for organizing App methods by domain
package app

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"pubsub-gui/internal/auth"
	"pubsub-gui/internal/models"
	"pubsub-gui/internal/pubsub/admin"
)

// SubscriptionUpdateParams represents parameters for updating a subscription
type SubscriptionUpdateParams struct {
	AckDeadline       *int                        `json:"ackDeadline,omitempty"`
	RetentionDuration *string                     `json:"retentionDuration,omitempty"`
	Filter            *string                     `json:"filter,omitempty"`
	DeadLetterPolicy  *admin.DeadLetterPolicyInfo `json:"deadLetterPolicy,omitempty"`
	PushEndpoint      *string                     `json:"pushEndpoint,omitempty"`
	SubscriptionType  *string                     `json:"subscriptionType,omitempty"`
}

// ResourceHandler handles topic and subscription resource management
type ResourceHandler struct {
	ctx           context.Context
	clientManager *auth.ClientManager
	resourceMu    *sync.RWMutex
	topics        *[]admin.TopicInfo
	subscriptions *[]admin.SubscriptionInfo
}

// NewResourceHandler creates a new resource handler
func NewResourceHandler(
	ctx context.Context,
	clientManager *auth.ClientManager,
	resourceMu *sync.RWMutex,
	topics *[]admin.TopicInfo,
	subscriptions *[]admin.SubscriptionInfo,
) *ResourceHandler {
	return &ResourceHandler{
		ctx:           ctx,
		clientManager: clientManager,
		resourceMu:    resourceMu,
		topics:        topics,
		subscriptions: subscriptions,
	}
}

// SyncResources manually triggers a resource sync (exposed for frontend refresh button)
func (h *ResourceHandler) SyncResources() error {
	if !h.clientManager.IsConnected() {
		return models.ErrNotConnected
	}
	go h.syncResources()
	return nil
}

// syncResources fetches topics and subscriptions from GCP in parallel and updates the local store
// Emits a resources:updated event to notify the frontend
func (h *ResourceHandler) syncResources() {
	client := h.clientManager.GetClient()
	if client == nil {
		return
	}

	projectID := h.clientManager.GetProjectID()
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
		topics, topicsErr = admin.ListTopicsAdmin(h.ctx, client, projectID)
	}()

	go func() {
		defer wg.Done()
		subscriptions, subsErr = admin.ListSubscriptionsAdmin(h.ctx, client, projectID)
	}()

	wg.Wait()

	// Handle partial failures - update what succeeded, emit errors for what failed
	hasErrors := false
	errorDetails := make(map[string]string)

	if topicsErr != nil {
		fmt.Printf("Error syncing topics: %v\n", topicsErr)
		hasErrors = true
		errorDetails["topics"] = topicsErr.Error()
	}

	if subsErr != nil {
		fmt.Printf("Error syncing subscriptions: %v\n", subsErr)
		hasErrors = true
		errorDetails["subscriptions"] = subsErr.Error()
	}

	// Update local store with successful fetches only
	h.resourceMu.Lock()
	if topicsErr == nil {
		*h.topics = topics
	}
	if subsErr == nil {
		*h.subscriptions = subscriptions
	}
	h.resourceMu.Unlock()

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
		runtime.EventsEmit(h.ctx, "resources:updated", updatePayload)
	}

	// Emit error event if any failures occurred
	if hasErrors {
		runtime.EventsEmit(h.ctx, "resources:sync-error", map[string]interface{}{
			"errors": errorDetails,
		})
	}
}

// ListTopics returns all topics in the connected project (from cached store)
func (h *ResourceHandler) ListTopics() ([]admin.TopicInfo, error) {
	h.resourceMu.RLock()
	defer h.resourceMu.RUnlock()

	// Return cached topics if available
	if *h.topics != nil {
		// Return a copy to prevent external modification
		result := make([]admin.TopicInfo, len(*h.topics))
		copy(result, *h.topics)
		return result, nil
	}

	// Fallback to empty array if not synced yet
	return []admin.TopicInfo{}, nil
}

// ListSubscriptions returns all subscriptions in the connected project (from cached store)
func (h *ResourceHandler) ListSubscriptions() ([]admin.SubscriptionInfo, error) {
	h.resourceMu.RLock()
	defer h.resourceMu.RUnlock()

	// Return cached subscriptions if available
	if *h.subscriptions != nil {
		// Return a copy to prevent external modification
		result := make([]admin.SubscriptionInfo, len(*h.subscriptions))
		copy(result, *h.subscriptions)
		return result, nil
	}

	// Fallback to empty array if not synced yet
	return []admin.SubscriptionInfo{}, nil
}

// GetTopicMetadata retrieves metadata for a specific topic
func (h *ResourceHandler) GetTopicMetadata(topicID string) (admin.TopicInfo, error) {
	client := h.clientManager.GetClient()
	if client == nil {
		return admin.TopicInfo{}, models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()
	return admin.GetTopicMetadataAdmin(h.ctx, client, projectID, topicID)
}

// GetSubscriptionMetadata retrieves metadata for a specific subscription
func (h *ResourceHandler) GetSubscriptionMetadata(subID string) (admin.SubscriptionInfo, error) {
	client := h.clientManager.GetClient()
	if client == nil {
		return admin.SubscriptionInfo{}, models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()
	return admin.GetSubscriptionMetadataAdmin(h.ctx, client, projectID, subID)
}

// CreateTopic creates a new topic with optional message retention duration
func (h *ResourceHandler) CreateTopic(topicID string, messageRetentionDuration string, syncResources func()) error {
	client := h.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()
	err := admin.CreateTopicAdmin(h.ctx, client, projectID, topicID, messageRetentionDuration)
	if err != nil {
		return err
	}

	// Trigger background sync to update local store
	if syncResources != nil {
		go syncResources()
	}

	// Emit event for frontend to refresh
	runtime.EventsEmit(h.ctx, "topic:created", map[string]interface{}{
		"topicID": topicID,
	})

	return nil
}

// DeleteTopic deletes a topic
func (h *ResourceHandler) DeleteTopic(topicID string, syncResources func()) error {
	client := h.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()
	err := admin.DeleteTopicAdmin(h.ctx, client, projectID, topicID)
	if err != nil {
		return err
	}

	// Trigger background sync to update local store
	if syncResources != nil {
		go syncResources()
	}

	// Emit event for frontend to refresh
	runtime.EventsEmit(h.ctx, "topic:deleted", map[string]interface{}{
		"topicID": topicID,
	})

	return nil
}

// CreateSubscription creates a new subscription for a topic
func (h *ResourceHandler) CreateSubscription(topicID string, subID string, ttlSeconds int64, syncResources func()) error {
	client := h.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()
	ttl := time.Duration(ttlSeconds) * time.Second
	err := admin.CreateSubscriptionAdmin(h.ctx, client, projectID, topicID, subID, ttl)
	if err != nil {
		return err
	}

	// Trigger background sync to update local store
	if syncResources != nil {
		go syncResources()
	}

	// Emit event for frontend to refresh
	runtime.EventsEmit(h.ctx, "subscription:created", map[string]interface{}{
		"subscriptionID": subID,
	})

	return nil
}

// DeleteSubscription deletes a subscription
func (h *ResourceHandler) DeleteSubscription(subID string, syncResources func()) error {
	client := h.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()
	err := admin.DeleteSubscriptionAdmin(h.ctx, client, projectID, subID)
	if err != nil {
		return err
	}

	// Trigger background sync to update local store
	if syncResources != nil {
		go syncResources()
	}

	// Emit event for frontend to refresh
	runtime.EventsEmit(h.ctx, "subscription:deleted", map[string]interface{}{
		"subscriptionID": subID,
	})

	return nil
}

// UpdateSubscription updates a subscription's configuration
func (h *ResourceHandler) UpdateSubscription(subID string, params SubscriptionUpdateParams, syncResources func()) error {
	client := h.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()

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

	err := admin.UpdateSubscriptionAdmin(h.ctx, client, projectID, subID, adminParams)
	if err != nil {
		return err
	}

	// Trigger background sync to update local store
	if syncResources != nil {
		go syncResources()
	}

	// Emit event for frontend to refresh
	runtime.EventsEmit(h.ctx, "subscription:updated", map[string]interface{}{
		"subscriptionID": subID,
	})

	return nil
}
