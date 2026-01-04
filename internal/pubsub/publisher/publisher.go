// Package publisher provides functions for publishing messages to Pub/Sub topics
package publisher

import (
	"context"
	"fmt"
	"strings"
	"time"

	"cloud.google.com/go/pubsub/v2"
)

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

// PublishMessage publishes a message to a Pub/Sub topic and returns the message ID
func PublishMessage(ctx context.Context, client *pubsub.Client, topicID, payload string, attributes map[string]string) (string, error) {
	if client == nil {
		return "", fmt.Errorf("pub/sub client is nil")
	}

	if topicID == "" {
		return "", fmt.Errorf("topic ID cannot be empty")
	}

	// Get publisher for the topic (can use full name or short name)
	publisher := client.Publisher(topicID)
	defer publisher.Stop()

	// Create message
	msg := &pubsub.Message{
		Data: []byte(payload),
	}

	// Add attributes if provided
	if attributes != nil && len(attributes) > 0 {
		msg.Attributes = attributes
	}

	// Publish message
	result := publisher.Publish(ctx, msg)

	// Wait for publish to complete and get message ID
	messageID, err := result.Get(ctx)
	if err != nil {
		// Provide user-friendly error messages for common issues
		errStr := err.Error()
		if contains(errStr, "PermissionDenied") || contains(errStr, "permission denied") {
			return "", fmt.Errorf("permission denied: you don't have permission to publish to this topic")
		}
		if contains(errStr, "NotFound") || contains(errStr, "not found") {
			return "", fmt.Errorf("topic not found: the topic '%s' does not exist", topicID)
		}
		if contains(errStr, "InvalidArgument") || contains(errStr, "invalid argument") {
			return "", fmt.Errorf("invalid message: check your payload and attributes")
		}
		return "", fmt.Errorf("failed to publish message: %w", err)
	}

	return messageID, nil
}

// PublishResult represents the result of a publish operation
type PublishResult struct {
	MessageID string `json:"messageId"`
	Timestamp string `json:"timestamp"`
}

// PublishMessageWithResult publishes a message and returns a result with message ID and timestamp
func PublishMessageWithResult(ctx context.Context, client *pubsub.Client, topicID, payload string, attributes map[string]string) (PublishResult, error) {
	messageID, err := PublishMessage(ctx, client, topicID, payload, attributes)
	if err != nil {
		return PublishResult{}, err
	}

	return PublishResult{
		MessageID: messageID,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
