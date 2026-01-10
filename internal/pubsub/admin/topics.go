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
	"google.golang.org/protobuf/types/known/durationpb"

	"pubsub-gui/internal/models"
)

// TopicInfo represents topic metadata
type TopicInfo struct {
	Name             string `json:"name"`
	DisplayName      string `json:"displayName"`
	MessageRetention string `json:"messageRetention,omitempty"`
}

// ListTopicsAdmin lists all topics in the project using the v2 client
func ListTopicsAdmin(ctx context.Context, client *pubsub.Client, projectID string) ([]TopicInfo, error) {
	var topics []TopicInfo

	req := &pubsubpb.ListTopicsRequest{
		Project: "projects/" + projectID,
	}

	// Use the TopicAdminClient exposed by v2 Client
	it := client.TopicAdminClient.ListTopics(ctx, req)

	for {
		// Check context before each iteration to respect timeout
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		topic, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}

		topicInfo := TopicInfo{
			Name:        topic.Name,
			DisplayName: extractDisplayName(topic.Name),
		}

		// Get message retention if available
		if topic.MessageRetentionDuration != nil {
			topicInfo.MessageRetention = topic.MessageRetentionDuration.AsDuration().String()
		}

		topics = append(topics, topicInfo)
	}

	return topics, nil
}

// GetTopicMetadataAdmin retrieves metadata for a specific topic
func GetTopicMetadataAdmin(ctx context.Context, client *pubsub.Client, projectID, topicID string) (TopicInfo, error) {
	topicName := "projects/" + projectID + "/topics/" + topicID

	req := &pubsubpb.GetTopicRequest{
		Topic: topicName,
	}

	topic, err := client.TopicAdminClient.GetTopic(ctx, req)
	if err != nil {
		return TopicInfo{}, err
	}

	topicInfo := TopicInfo{
		Name:        topic.Name,
		DisplayName: topicID,
	}

	if topic.MessageRetentionDuration != nil {
		topicInfo.MessageRetention = topic.MessageRetentionDuration.AsDuration().String()
	}

	return topicInfo, nil
}

// CreateTopicAdmin creates a new topic with optional message retention duration
func CreateTopicAdmin(ctx context.Context, client *pubsub.Client, projectID, topicID string, messageRetentionDuration string) error {
	// Normalize topic ID (extract short name if full path provided)
	shortTopicID := topicID
	if strings.HasPrefix(topicID, "projects/") {
		// Extract topic ID from full path: projects/{project}/topics/{topic-id}
		parts := strings.Split(topicID, "/")
		if len(parts) >= 4 && parts[0] == "projects" && parts[2] == "topics" {
			shortTopicID = parts[3]
		}
	}

	// Build full resource name
	topicName := "projects/" + projectID + "/topics/" + shortTopicID

	// Create topic using Topic object directly (v2 API pattern)
	req := &pubsubpb.Topic{
		Name: topicName,
	}

	// Set message retention duration if provided
	if messageRetentionDuration != "" {
		duration, err := time.ParseDuration(messageRetentionDuration)
		if err != nil {
			return fmt.Errorf("invalid message retention duration format: %w", err)
		}
		req.MessageRetentionDuration = durationpb.New(duration)
	}

	_, err := client.TopicAdminClient.CreateTopic(ctx, req)
	if err != nil {
		return fmt.Errorf("failed to create topic %s: %w. Ensure you have 'pubsub.topics.create' permission", topicName, err)
	}

	return nil
}

// DeleteTopicAdmin deletes a topic
func DeleteTopicAdmin(ctx context.Context, client *pubsub.Client, projectID, topicID string) error {
	// Normalize topic ID
	topicName := topicID
	if !strings.HasPrefix(topicID, "projects/") {
		topicName = "projects/" + projectID + "/topics/" + topicID
	}

	deleteReq := &pubsubpb.DeleteTopicRequest{
		Topic: topicName,
	}

	err := client.TopicAdminClient.DeleteTopic(ctx, deleteReq)
	if err != nil {
		return fmt.Errorf("failed to delete topic: %w", err)
	}

	return nil
}

// CreateTopicWithConfig creates a new topic with full configuration support
func CreateTopicWithConfig(ctx context.Context, client *pubsub.Client, projectID, topicID string, config models.TopicTemplateConfig) error {
	// Normalize topic ID (extract short name if full path provided)
	shortTopicID := topicID
	if strings.HasPrefix(topicID, "projects/") {
		parts := strings.Split(topicID, "/")
		if len(parts) >= 4 && parts[0] == "projects" && parts[2] == "topics" {
			shortTopicID = parts[3]
		}
	}

	// Build full resource name
	topicName := "projects/" + projectID + "/topics/" + shortTopicID

	// Create topic using Topic object directly (v2 API pattern)
	req := &pubsubpb.Topic{
		Name: topicName,
	}

	// Set message retention duration if provided
	if config.MessageRetentionDuration != "" {
		duration, err := time.ParseDuration(config.MessageRetentionDuration)
		if err != nil {
			return fmt.Errorf("invalid message retention duration format: %w", err)
		}
		req.MessageRetentionDuration = durationpb.New(duration)
	}

	// Set labels if provided
	if len(config.Labels) > 0 {
		req.Labels = config.Labels
	}

	// Set KMS key name if provided
	if config.KMSKeyName != "" {
		req.KmsKeyName = config.KMSKeyName
	}

	// Set message storage policy if provided
	if config.MessageStoragePolicy != nil && len(config.MessageStoragePolicy.AllowedPersistenceRegions) > 0 {
		req.MessageStoragePolicy = &pubsubpb.MessageStoragePolicy{
			AllowedPersistenceRegions: config.MessageStoragePolicy.AllowedPersistenceRegions,
		}
	}

	_, err := client.TopicAdminClient.CreateTopic(ctx, req)
	if err != nil {
		return fmt.Errorf("failed to create topic %s: %w. Ensure you have 'pubsub.topics.create' permission", topicName, err)
	}

	return nil
}

// extractDisplayName extracts the topic/subscription name from the full resource path
// e.g., "projects/my-project/topics/my-topic" -> "my-topic"
func extractDisplayName(fullName string) string {
	parts := strings.Split(fullName, "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return fullName
}
