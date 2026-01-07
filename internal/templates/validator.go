// Package templates provides template system for creating topics and subscriptions with best practices
package templates

import (
	"fmt"
	"time"

	"pubsub-gui/internal/models"
)

// ValidateTemplate validates a topic/subscription template
func ValidateTemplate(template *models.TopicSubscriptionTemplate) error {
	if template == nil {
		return fmt.Errorf("template cannot be nil")
	}

	// Validate basic fields
	if template.ID == "" {
		return fmt.Errorf("template ID cannot be empty")
	}
	if template.Name == "" {
		return fmt.Errorf("template name cannot be empty")
	}
	if len(template.Subscriptions) == 0 {
		return fmt.Errorf("template must have at least one subscription")
	}

	// Validate topic config
	if err := validateTopicConfig(&template.Topic); err != nil {
		return fmt.Errorf("invalid topic config: %w", err)
	}

	// Validate subscriptions
	for i, sub := range template.Subscriptions {
		if err := validateSubscriptionConfig(&sub, i); err != nil {
			return fmt.Errorf("subscription %d: %w", i, err)
		}
	}

	// Validate dead letter config if present
	if template.DeadLetter != nil {
		if err := validateDeadLetterConfig(template.DeadLetter); err != nil {
			return fmt.Errorf("invalid dead letter config: %w", err)
		}
	}

	return nil
}

// validateTopicConfig validates topic configuration
func validateTopicConfig(config *models.TopicTemplateConfig) error {
	// Validate retention duration (10 minutes to 31 days)
	if config.MessageRetentionDuration != "" {
		duration, err := time.ParseDuration(config.MessageRetentionDuration)
		if err != nil {
			return fmt.Errorf("invalid retention duration format: %w", err)
		}
		minRetention := 10 * time.Minute
		maxRetention := 31 * 24 * time.Hour
		if duration < minRetention || duration > maxRetention {
			return fmt.Errorf("retention duration must be between 10 minutes and 31 days, got %v", duration)
		}
	}
	return nil
}

// validateSubscriptionConfig validates subscription configuration
func validateSubscriptionConfig(config *models.SubscriptionTemplateConfig, index int) error {
	// Validate name
	if config.Name == "" {
		return fmt.Errorf("subscription name cannot be empty")
	}

	// Validate ack deadline (10-600 seconds)
	if config.AckDeadline < 10 || config.AckDeadline > 600 {
		return fmt.Errorf("ack deadline must be between 10 and 600 seconds, got %d", config.AckDeadline)
	}

	// Validate retention duration if provided
	if config.RetentionDuration != "" {
		duration, err := time.ParseDuration(config.RetentionDuration)
		if err != nil {
			return fmt.Errorf("invalid retention duration format: %w", err)
		}
		// Subscription retention can be up to 7 days
		maxRetention := 7 * 24 * time.Hour
		if duration > maxRetention {
			return fmt.Errorf("subscription retention duration cannot exceed 7 days, got %v", duration)
		}
	}

	// Validate retry policy if provided
	if config.RetryPolicy != nil {
		minBackoff, err := time.ParseDuration(config.RetryPolicy.MinimumBackoff)
		if err != nil {
			return fmt.Errorf("invalid minimum backoff format: %w", err)
		}
		maxBackoff, err := time.ParseDuration(config.RetryPolicy.MaximumBackoff)
		if err != nil {
			return fmt.Errorf("invalid maximum backoff format: %w", err)
		}
		if minBackoff >= maxBackoff {
			return fmt.Errorf("minimum backoff (%v) must be less than maximum backoff (%v)", minBackoff, maxBackoff)
		}
	}

	// Validate expiration policy if provided
	if config.ExpirationPolicy != nil && config.ExpirationPolicy.TTL != "" {
		_, err := time.ParseDuration(config.ExpirationPolicy.TTL)
		if err != nil {
			return fmt.Errorf("invalid expiration policy TTL format: %w", err)
		}
	}

	return nil
}

// validateDeadLetterConfig validates dead letter queue configuration
func validateDeadLetterConfig(config *models.DeadLetterTemplateConfig) error {
	// Validate max delivery attempts (5-100)
	if config.MaxDeliveryAttempts < 5 || config.MaxDeliveryAttempts > 100 {
		return fmt.Errorf("max delivery attempts must be between 5 and 100, got %d", config.MaxDeliveryAttempts)
	}
	return nil
}
