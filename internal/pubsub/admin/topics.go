// Package admin provides functions for listing and managing Pub/Sub topics and subscriptions
package admin

import (
	"context"
	"strings"

	"cloud.google.com/go/pubsub/v2"
	pubsubpb "cloud.google.com/go/pubsub/v2/apiv1/pubsubpb"
	"google.golang.org/api/iterator"
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

// extractDisplayName extracts the topic/subscription name from the full resource path
// e.g., "projects/my-project/topics/my-topic" -> "my-topic"
func extractDisplayName(fullName string) string {
	parts := strings.Split(fullName, "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return fullName
}
