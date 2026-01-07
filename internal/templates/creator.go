// Package templates provides template system for creating topics and subscriptions with best practices
package templates

import (
	"context"
	"fmt"
	"strings"

	"pubsub-gui/internal/models"
	"pubsub-gui/internal/pubsub/admin"

	"cloud.google.com/go/pubsub/v2"
)

// Creator handles creation of resources from templates
type Creator struct {
	ctx       context.Context
	client    *pubsub.Client
	projectID string
	registry  *Registry
}

// NewCreator creates a new template creator
func NewCreator(ctx context.Context, client *pubsub.Client, projectID string, registry *Registry) *Creator {
	return &Creator{
		ctx:       ctx,
		client:    client,
		projectID: projectID,
		registry:  registry,
	}
}

// CreateFromTemplate creates resources from a template
func (c *Creator) CreateFromTemplate(request *models.TemplateCreateRequest) (*models.TemplateCreateResult, error) {
	// Validate request
	if err := request.Validate(); err != nil {
		return &models.TemplateCreateResult{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	// Get template from registry
	template, err := c.registry.GetTemplate(request.TemplateID)
	if err != nil {
		return &models.TemplateCreateResult{
			Success: false,
			Error:   fmt.Sprintf("template not found: %s", err.Error()),
		}, nil
	}

	// Build resource names
	baseName := strings.ToLower(strings.TrimSpace(request.BaseName))
	envSuffix := ""
	if request.Environment != "" {
		envSuffix = "-" + strings.ToLower(strings.TrimSpace(request.Environment))
	}

	// Build topic name
	topicID := baseName + envSuffix + "-topic"

	// Track created resources for rollback
	var createdResources []string
	var deadLetterTopicID string
	var deadLetterSubID string

	// Step 1: Create dead letter resources if enabled
	if template.DeadLetter != nil && !request.Overrides.DisableDeadLetter {
		dlqTopicID, dlqSubID, err := c.createDeadLetterResources(baseName, envSuffix, template.DeadLetter, request.Overrides)
		if err != nil {
			return &models.TemplateCreateResult{
				Success: false,
				Error:   fmt.Sprintf("failed to create dead letter resources: %s", err.Error()),
			}, nil
		}
		deadLetterTopicID = dlqTopicID
		deadLetterSubID = dlqSubID
		createdResources = append(createdResources, "topic:"+dlqTopicID, "subscription:"+dlqSubID)
	}

	// Step 2: Create main topic
	topicConfig := admin.TopicTemplateConfig{
		MessageRetentionDuration: template.Topic.MessageRetentionDuration,
		Labels:                   template.Topic.Labels,
		KMSKeyName:               template.Topic.KMSKeyName,
	}
	if template.Topic.MessageStoragePolicy != nil {
		topicConfig.MessageStoragePolicy = &admin.MessageStoragePolicy{
			AllowedPersistenceRegions: template.Topic.MessageStoragePolicy.AllowedPersistenceRegions,
		}
	}

	// Apply retention override if provided
	if request.Overrides.MessageRetentionDuration != nil {
		topicConfig.MessageRetentionDuration = *request.Overrides.MessageRetentionDuration
	}

	err = admin.CreateTopicWithConfig(c.ctx, c.client, c.projectID, topicID, topicConfig)
	if err != nil {
		// Rollback: delete created DLQ resources
		c.rollbackResources(createdResources)
		return &models.TemplateCreateResult{
			Success: false,
			Error:   fmt.Sprintf("failed to create topic: %s", err.Error()),
		}, nil
	}
	createdResources = append(createdResources, "topic:"+topicID)

	// Step 3: Create subscriptions
	var subscriptionIDs []string
	var warnings []string
	for _, subTemplate := range template.Subscriptions {
		subID := baseName + envSuffix + "-" + subTemplate.Name

		// Build subscription config
		subConfig := admin.SubscriptionConfig{
			AckDeadline:       subTemplate.AckDeadline,
			RetentionDuration: subTemplate.RetentionDuration,
			EnableOrdering:    subTemplate.EnableOrdering,
			EnableExactlyOnce: subTemplate.EnableExactlyOnce,
			Filter:            subTemplate.Filter,
			Labels:            subTemplate.Labels,
		}

		// Apply ack deadline override if provided
		if request.Overrides.AckDeadline != nil {
			subConfig.AckDeadline = *request.Overrides.AckDeadline
		}

		// Apply expiration policy if provided
		if subTemplate.ExpirationPolicy != nil {
			subConfig.ExpirationPolicy = &admin.ExpirationPolicy{
				TTL: subTemplate.ExpirationPolicy.TTL,
			}
		}

		// Apply retry policy if provided
		if subTemplate.RetryPolicy != nil {
			subConfig.RetryPolicy = &admin.RetryPolicy{
				MinimumBackoff: subTemplate.RetryPolicy.MinimumBackoff,
				MaximumBackoff: subTemplate.RetryPolicy.MaximumBackoff,
			}
		}

		// Apply push config if provided
		if subTemplate.PushConfig != nil {
			subConfig.PushConfig = &admin.PushConfig{
				Endpoint:   subTemplate.PushConfig.Endpoint,
				Attributes: subTemplate.PushConfig.Attributes,
			}
		}

		// Link dead letter policy if configured
		if template.DeadLetter != nil && !request.Overrides.DisableDeadLetter && deadLetterTopicID != "" {
			maxAttempts := template.DeadLetter.MaxDeliveryAttempts
			if request.Overrides.MaxDeliveryAttempts != nil {
				maxAttempts = *request.Overrides.MaxDeliveryAttempts
			}
			deadLetterTopicName := "projects/" + c.projectID + "/topics/" + deadLetterTopicID
			subConfig.DeadLetterPolicy = &admin.DeadLetterPolicyInfo{
				DeadLetterTopic:     deadLetterTopicName,
				MaxDeliveryAttempts: maxAttempts,
			}
		}

		// Create subscription
		err = admin.CreateSubscriptionWithConfig(c.ctx, c.client, c.projectID, topicID, subID, subConfig)
		if err != nil {
			// Log warning but continue (topic is created, user can retry subscription)
			warnings = append(warnings, fmt.Sprintf("failed to create subscription %s: %s", subID, err.Error()))
			continue
		}
		subscriptionIDs = append(subscriptionIDs, subID)
		createdResources = append(createdResources, "subscription:"+subID)
	}

	// Check if at least one subscription was created
	if len(subscriptionIDs) == 0 {
		// Rollback: delete topic and DLQ resources
		c.rollbackResources(createdResources)
		return &models.TemplateCreateResult{
			Success:  false,
			Error:    "failed to create any subscriptions",
			Warnings: warnings,
		}, nil
	}

	return &models.TemplateCreateResult{
		Success:           true,
		TopicID:           topicID,
		SubscriptionIDs:   subscriptionIDs,
		DeadLetterTopicID: deadLetterTopicID,
		DeadLetterSubID:   deadLetterSubID,
		Warnings:          warnings,
	}, nil
}

// createDeadLetterResources creates dead letter topic and subscription
func (c *Creator) createDeadLetterResources(baseName, envSuffix string, dlqConfig *models.DeadLetterTemplateConfig, overrides models.TemplateOverrides) (string, string, error) {
	// Build DLQ resource names
	dlqTopicID := baseName + envSuffix + "-dlq"
	dlqSubID := baseName + envSuffix + "-dlq-sub"

	// Create DLQ topic with simplified config (no retention override needed for DLQ)
	dlqTopicConfig := admin.TopicTemplateConfig{
		MessageRetentionDuration: "168h", // 7 days default for DLQ
	}
	err := admin.CreateTopicWithConfig(c.ctx, c.client, c.projectID, dlqTopicID, dlqTopicConfig)
	if err != nil {
		return "", "", fmt.Errorf("failed to create DLQ topic: %w", err)
	}

	// Create DLQ subscription with long ack deadline for manual inspection
	dlqSubConfig := admin.SubscriptionConfig{
		AckDeadline:       600, // 10 minutes for manual inspection
		RetentionDuration: "7d",
		EnableOrdering:    false,
		EnableExactlyOnce: false,
		// Set expiration policy to auto-delete after 30 days idle
		ExpirationPolicy: &admin.ExpirationPolicy{
			TTL: "720h", // 30 days
		},
	}
	err = admin.CreateSubscriptionWithConfig(c.ctx, c.client, c.projectID, dlqTopicID, dlqSubID, dlqSubConfig)
	if err != nil {
		// Rollback: delete DLQ topic
		_ = admin.DeleteTopicAdmin(c.ctx, c.client, c.projectID, dlqTopicID)
		return "", "", fmt.Errorf("failed to create DLQ subscription: %w", err)
	}

	return dlqTopicID, dlqSubID, nil
}

// rollbackResources deletes created resources in reverse order
func (c *Creator) rollbackResources(resources []string) {
	// Delete in reverse order (subscriptions first, then topics)
	for i := len(resources) - 1; i >= 0; i-- {
		parts := strings.Split(resources[i], ":")
		if len(parts) != 2 {
			continue
		}
		resourceType := parts[0]
		resourceID := parts[1]

		if resourceType == "subscription" {
			_ = admin.DeleteSubscriptionAdmin(c.ctx, c.client, c.projectID, resourceID)
		} else if resourceType == "topic" {
			_ = admin.DeleteTopicAdmin(c.ctx, c.client, c.projectID, resourceID)
		}
	}
}
