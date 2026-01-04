// Package admin provides functions for listing and managing Pub/Sub topics and subscriptions
package admin

import (
	"context"
	"fmt"

	"cloud.google.com/go/pubsub/v2"
	pubsubpb "cloud.google.com/go/pubsub/v2/apiv1/pubsubpb"
	"google.golang.org/api/iterator"
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
