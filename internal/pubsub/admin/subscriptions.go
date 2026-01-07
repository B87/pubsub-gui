// Package admin provides functions for listing and managing Pub/Sub topics and subscriptions
package admin

import (
	"context"
	"fmt"
	"strings"
	"time"

	"cloud.google.com/go/pubsub/v2"
	pubsubpb "cloud.google.com/go/pubsub/v2/apiv1/pubsubpb"
	"google.golang.org/api/iterator"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/durationpb"
	fieldmaskpb "google.golang.org/protobuf/types/known/fieldmaskpb"
)

// SubscriptionInfo represents subscription metadata
type SubscriptionInfo struct {
	Name              string                `json:"name"`
	DisplayName       string                `json:"displayName"`
	Topic             string                `json:"topic"`
	AckDeadline       int                   `json:"ackDeadline"`
	RetentionDuration string                `json:"retentionDuration"`
	Filter            string                `json:"filter,omitempty"`
	DeadLetterPolicy  *DeadLetterPolicyInfo `json:"deadLetterPolicy,omitempty"`
	SubscriptionType  string                `json:"subscriptionType"`       // "pull" or "push"
	PushEndpoint      string                `json:"pushEndpoint,omitempty"` // Only for push subscriptions
}

// DeadLetterPolicyInfo represents dead letter queue configuration
type DeadLetterPolicyInfo struct {
	DeadLetterTopic     string `json:"deadLetterTopic"`
	MaxDeliveryAttempts int    `json:"maxDeliveryAttempts"`
}

// ListSubscriptionsAdmin lists all subscriptions in the project using the v2 client
func ListSubscriptionsAdmin(ctx context.Context, client *pubsub.Client, projectID string) ([]SubscriptionInfo, error) {
	var subscriptions []SubscriptionInfo

	req := &pubsubpb.ListSubscriptionsRequest{
		Project: "projects/" + projectID,
	}

	// Use the SubscriptionAdminClient exposed by v2 Client
	it := client.SubscriptionAdminClient.ListSubscriptions(ctx, req)

	for {
		sub, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		subInfo := SubscriptionInfo{
			Name:              sub.Name,
			DisplayName:       extractDisplayName(sub.Name),
			Topic:             sub.Topic,
			AckDeadline:       int(sub.AckDeadlineSeconds),
			RetentionDuration: sub.MessageRetentionDuration.AsDuration().String(),
		}

		// Determine subscription type (pull or push)
		if sub.PushConfig != nil && sub.PushConfig.PushEndpoint != "" {
			subInfo.SubscriptionType = "push"
			subInfo.PushEndpoint = sub.PushConfig.PushEndpoint
		} else {
			subInfo.SubscriptionType = "pull"
		}

		if sub.Filter != "" {
			subInfo.Filter = sub.Filter
		}

		if sub.DeadLetterPolicy != nil {
			subInfo.DeadLetterPolicy = &DeadLetterPolicyInfo{
				DeadLetterTopic:     sub.DeadLetterPolicy.DeadLetterTopic,
				MaxDeliveryAttempts: int(sub.DeadLetterPolicy.MaxDeliveryAttempts),
			}
		}

		subscriptions = append(subscriptions, subInfo)
	}

	return subscriptions, nil
}

// GetSubscriptionMetadataAdmin retrieves metadata for a specific subscription
func GetSubscriptionMetadataAdmin(ctx context.Context, client *pubsub.Client, projectID, subID string) (SubscriptionInfo, error) {
	subName := "projects/" + projectID + "/subscriptions/" + subID

	req := &pubsubpb.GetSubscriptionRequest{
		Subscription: subName,
	}

	sub, err := client.SubscriptionAdminClient.GetSubscription(ctx, req)
	if err != nil {
		return SubscriptionInfo{}, fmt.Errorf("failed to get subscription: %w", err)
	}

	subInfo := SubscriptionInfo{
		Name:              sub.Name,
		DisplayName:       subID,
		Topic:             sub.Topic,
		AckDeadline:       int(sub.AckDeadlineSeconds),
		RetentionDuration: sub.MessageRetentionDuration.AsDuration().String(),
	}

	// Determine subscription type (pull or push)
	if sub.PushConfig != nil && sub.PushConfig.PushEndpoint != "" {
		subInfo.SubscriptionType = "push"
		subInfo.PushEndpoint = sub.PushConfig.PushEndpoint
	} else {
		subInfo.SubscriptionType = "pull"
	}

	if sub.Filter != "" {
		subInfo.Filter = sub.Filter
	}

	if sub.DeadLetterPolicy != nil {
		subInfo.DeadLetterPolicy = &DeadLetterPolicyInfo{
			DeadLetterTopic:     sub.DeadLetterPolicy.DeadLetterTopic,
			MaxDeliveryAttempts: int(sub.DeadLetterPolicy.MaxDeliveryAttempts),
		}
	}

	return subInfo, nil
}

// CreateSubscriptionAdmin creates a new subscription for a topic
func CreateSubscriptionAdmin(ctx context.Context, client *pubsub.Client, projectID, topicID, subID string, ttl time.Duration) error {
	// Normalize subscription ID (extract short name if full path provided)
	shortSubID := subID
	if strings.HasPrefix(subID, "projects/") {
		// Extract subscription ID from full path: projects/{project}/subscriptions/{sub-id}
		parts := strings.Split(subID, "/")
		if len(parts) >= 4 && parts[0] == "projects" && parts[2] == "subscriptions" {
			shortSubID = parts[3]
		}
	}

	// Normalize topic ID (extract short name if full path provided)
	shortTopicID := topicID
	if strings.HasPrefix(topicID, "projects/") {
		// Extract topic ID from full path: projects/{project}/topics/{topic-id}
		parts := strings.Split(topicID, "/")
		if len(parts) >= 4 && parts[0] == "projects" && parts[2] == "topics" {
			shortTopicID = parts[3]
		}
	}

	// Build full resource names
	subName := "projects/" + projectID + "/subscriptions/" + shortSubID
	topicName := "projects/" + projectID + "/topics/" + shortTopicID

	// Verify topic exists before creating subscription
	topicReq := &pubsubpb.GetTopicRequest{
		Topic: topicName,
	}
	_, err := client.TopicAdminClient.GetTopic(ctx, topicReq)
	if err != nil {
		return fmt.Errorf("topic %s does not exist or you don't have permission to access it: %w", topicName, err)
	}

	// Create subscription using Subscription object directly (v2 API pattern)
	req := &pubsubpb.Subscription{
		Name:  subName,
		Topic: topicName,
		// Set expiration policy to automatically delete the subscription after it's been idle for ttl
		ExpirationPolicy: &pubsubpb.ExpirationPolicy{
			Ttl: durationpb.New(ttl),
		},
	}

	_, err = client.SubscriptionAdminClient.CreateSubscription(ctx, req)
	if err != nil {
		// Provide more helpful error message
		return fmt.Errorf("failed to create subscription %s for topic %s: %w. Ensure you have 'pubsub.subscriptions.create' permission", subName, topicName, err)
	}

	return nil
}

// DeleteSubscriptionAdmin deletes a subscription
func DeleteSubscriptionAdmin(ctx context.Context, client *pubsub.Client, projectID, subID string) error {
	subName := subID
	if !strings.HasPrefix(subID, "projects/") {
		subName = "projects/" + projectID + "/subscriptions/" + subID
	}

	deleteReq := &pubsubpb.DeleteSubscriptionRequest{
		Subscription: subName,
	}

	err := client.SubscriptionAdminClient.DeleteSubscription(ctx, deleteReq)
	if err != nil {
		return fmt.Errorf("failed to delete subscription: %w", err)
	}

	return nil
}

// SubscriptionUpdateParams represents parameters for updating a subscription
type SubscriptionUpdateParams struct {
	AckDeadline       *int                  `json:"ackDeadline,omitempty"`
	RetentionDuration *string               `json:"retentionDuration,omitempty"`
	Filter            *string               `json:"filter,omitempty"`
	DeadLetterPolicy  *DeadLetterPolicyInfo `json:"deadLetterPolicy,omitempty"`
	PushEndpoint      *string               `json:"pushEndpoint,omitempty"`
	SubscriptionType  *string               `json:"subscriptionType,omitempty"` // "pull" or "push"
}

// SubscriptionConfig represents full subscription configuration for template-based creation
type SubscriptionConfig struct {
	AckDeadline       int                   `json:"ackDeadline"`                 // Ack deadline in seconds (10-600)
	RetentionDuration string                `json:"retentionDuration,omitempty"` // e.g., "7d"
	ExpirationPolicy  *ExpirationPolicy     `json:"expirationPolicy,omitempty"`  // Auto-delete after idle
	RetryPolicy       *RetryPolicy          `json:"retryPolicy,omitempty"`       // Retry configuration
	EnableOrdering    bool                  `json:"enableOrdering"`              // Enable message ordering
	EnableExactlyOnce bool                  `json:"enableExactlyOnce"`           // Enable exactly-once delivery
	Filter            string                `json:"filter,omitempty"`            // Message filter expression
	PushConfig        *PushConfig           `json:"pushConfig,omitempty"`        // Push subscription config
	DeadLetterPolicy  *DeadLetterPolicyInfo `json:"deadLetterPolicy,omitempty"`  // Dead letter policy
	Labels            map[string]string     `json:"labels,omitempty"`            // Subscription labels
}

// ExpirationPolicy represents subscription expiration policy
type ExpirationPolicy struct {
	TTL string `json:"ttl"` // Time to live, e.g., "24h"
}

// RetryPolicy represents subscription retry policy
type RetryPolicy struct {
	MinimumBackoff string `json:"minimumBackoff"` // e.g., "10s"
	MaximumBackoff string `json:"maximumBackoff"` // e.g., "600s"
}

// PushConfig represents push subscription configuration
type PushConfig struct {
	Endpoint   string            `json:"endpoint"`             // Push endpoint URL
	Attributes map[string]string `json:"attributes,omitempty"` // Push attributes
}

// UpdateSubscriptionAdmin updates a subscription's configuration
func UpdateSubscriptionAdmin(ctx context.Context, client *pubsub.Client, projectID, subID string, params SubscriptionUpdateParams) error {
	// Normalize subscription ID
	subName := subID
	if !strings.HasPrefix(subID, "projects/") {
		subName = "projects/" + projectID + "/subscriptions/" + subID
	}

	// Get current subscription to merge updates
	getReq := &pubsubpb.GetSubscriptionRequest{
		Subscription: subName,
	}
	currentSub, err := client.SubscriptionAdminClient.GetSubscription(ctx, getReq)
	if err != nil {
		return fmt.Errorf("failed to get subscription: %w", err)
	}

	// Create updated subscription (copy current)
	updatedSub := proto.Clone(currentSub).(*pubsubpb.Subscription)
	var updateMask []string

	// Update ack deadline if provided
	if params.AckDeadline != nil {
		updatedSub.AckDeadlineSeconds = int32(*params.AckDeadline)
		updateMask = append(updateMask, "ack_deadline_seconds")
	}

	// Update retention duration if provided
	if params.RetentionDuration != nil {
		duration, err := time.ParseDuration(*params.RetentionDuration)
		if err != nil {
			return fmt.Errorf("invalid retention duration format: %w", err)
		}
		updatedSub.MessageRetentionDuration = durationpb.New(duration)
		updateMask = append(updateMask, "message_retention_duration")
	}

	// Update filter if provided
	if params.Filter != nil {
		updatedSub.Filter = *params.Filter
		updateMask = append(updateMask, "filter")
	}

	// Update dead letter policy if provided
	if params.DeadLetterPolicy != nil {
		if updatedSub.DeadLetterPolicy == nil {
			updatedSub.DeadLetterPolicy = &pubsubpb.DeadLetterPolicy{}
		}
		if params.DeadLetterPolicy.DeadLetterTopic != "" {
			updatedSub.DeadLetterPolicy.DeadLetterTopic = params.DeadLetterPolicy.DeadLetterTopic
		}
		if params.DeadLetterPolicy.MaxDeliveryAttempts > 0 {
			updatedSub.DeadLetterPolicy.MaxDeliveryAttempts = int32(params.DeadLetterPolicy.MaxDeliveryAttempts)
		}
		updateMask = append(updateMask, "dead_letter_policy")
	}

	// Update push config if subscription type or endpoint changed
	if params.SubscriptionType != nil || params.PushEndpoint != nil {
		if *params.SubscriptionType == "push" {
			if updatedSub.PushConfig == nil {
				updatedSub.PushConfig = &pubsubpb.PushConfig{}
			}
			if params.PushEndpoint != nil {
				updatedSub.PushConfig.PushEndpoint = *params.PushEndpoint
			}
			updateMask = append(updateMask, "push_config")
		} else if *params.SubscriptionType == "pull" {
			// Clear push config for pull subscriptions
			updatedSub.PushConfig = nil
			updateMask = append(updateMask, "push_config")
		}
	}

	// If no fields to update, return early
	if len(updateMask) == 0 {
		return fmt.Errorf("no fields specified for update")
	}

	// Create update request with field mask
	updateReq := &pubsubpb.UpdateSubscriptionRequest{
		Subscription: updatedSub,
		UpdateMask: &fieldmaskpb.FieldMask{
			Paths: updateMask,
		},
	}

	_, err = client.SubscriptionAdminClient.UpdateSubscription(ctx, updateReq)
	if err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	return nil
}

// CreateSubscriptionWithConfig creates a new subscription with full configuration support
func CreateSubscriptionWithConfig(ctx context.Context, client *pubsub.Client, projectID, topicID, subID string, config SubscriptionConfig) error {
	// Normalize subscription ID (extract short name if full path provided)
	shortSubID := subID
	if strings.HasPrefix(subID, "projects/") {
		parts := strings.Split(subID, "/")
		if len(parts) >= 4 && parts[0] == "projects" && parts[2] == "subscriptions" {
			shortSubID = parts[3]
		}
	}

	// Normalize topic ID (extract short name if full path provided)
	shortTopicID := topicID
	if strings.HasPrefix(topicID, "projects/") {
		parts := strings.Split(topicID, "/")
		if len(parts) >= 4 && parts[0] == "projects" && parts[2] == "topics" {
			shortTopicID = parts[3]
		}
	}

	// Build full resource names
	subName := "projects/" + projectID + "/subscriptions/" + shortSubID
	topicName := "projects/" + projectID + "/topics/" + shortTopicID

	// Verify topic exists before creating subscription
	topicReq := &pubsubpb.GetTopicRequest{
		Topic: topicName,
	}
	_, err := client.TopicAdminClient.GetTopic(ctx, topicReq)
	if err != nil {
		return fmt.Errorf("topic %s does not exist or you don't have permission to access it: %w", topicName, err)
	}

	// Create subscription using Subscription object directly (v2 API pattern)
	req := &pubsubpb.Subscription{
		Name:  subName,
		Topic: topicName,
	}

	// Set ack deadline
	req.AckDeadlineSeconds = int32(config.AckDeadline)

	// Set retention duration if provided
	if config.RetentionDuration != "" {
		duration, err := time.ParseDuration(config.RetentionDuration)
		if err != nil {
			return fmt.Errorf("invalid retention duration format: %w", err)
		}
		req.MessageRetentionDuration = durationpb.New(duration)
	}

	// Set expiration policy if provided
	if config.ExpirationPolicy != nil && config.ExpirationPolicy.TTL != "" {
		ttl, err := time.ParseDuration(config.ExpirationPolicy.TTL)
		if err != nil {
			return fmt.Errorf("invalid expiration policy TTL format: %w", err)
		}
		req.ExpirationPolicy = &pubsubpb.ExpirationPolicy{
			Ttl: durationpb.New(ttl),
		}
	}

	// Set retry policy if provided
	if config.RetryPolicy != nil {
		minBackoff, err := time.ParseDuration(config.RetryPolicy.MinimumBackoff)
		if err != nil {
			return fmt.Errorf("invalid minimum backoff format: %w", err)
		}
		maxBackoff, err := time.ParseDuration(config.RetryPolicy.MaximumBackoff)
		if err != nil {
			return fmt.Errorf("invalid maximum backoff format: %w", err)
		}
		req.RetryPolicy = &pubsubpb.RetryPolicy{
			MinimumBackoff: durationpb.New(minBackoff),
			MaximumBackoff: durationpb.New(maxBackoff),
		}
	}

	// Set enable ordering
	req.EnableMessageOrdering = config.EnableOrdering

	// Set exactly-once delivery
	req.EnableExactlyOnceDelivery = config.EnableExactlyOnce

	// Set filter if provided
	if config.Filter != "" {
		req.Filter = config.Filter
	}

	// Set push config if provided
	if config.PushConfig != nil && config.PushConfig.Endpoint != "" {
		req.PushConfig = &pubsubpb.PushConfig{
			PushEndpoint: config.PushConfig.Endpoint,
		}
		if len(config.PushConfig.Attributes) > 0 {
			req.PushConfig.Attributes = config.PushConfig.Attributes
		}
	}

	// Set dead letter policy if provided
	if config.DeadLetterPolicy != nil {
		req.DeadLetterPolicy = &pubsubpb.DeadLetterPolicy{
			MaxDeliveryAttempts: int32(config.DeadLetterPolicy.MaxDeliveryAttempts),
		}
		if config.DeadLetterPolicy.DeadLetterTopic != "" {
			req.DeadLetterPolicy.DeadLetterTopic = config.DeadLetterPolicy.DeadLetterTopic
		}
	}

	// Set labels if provided
	if len(config.Labels) > 0 {
		req.Labels = config.Labels
	}

	_, err = client.SubscriptionAdminClient.CreateSubscription(ctx, req)
	if err != nil {
		return fmt.Errorf("failed to create subscription %s for topic %s: %w. Ensure you have 'pubsub.subscriptions.create' permission", subName, topicName, err)
	}

	return nil
}
