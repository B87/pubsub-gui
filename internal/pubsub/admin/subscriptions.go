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
