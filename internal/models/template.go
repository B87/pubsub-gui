// Package models defines data structures for message templates and topic/subscription templates
package models

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

// MessageTemplate represents a saved message template
type MessageTemplate struct {
	ID         string            `json:"id"`                // UUID v7 or timestamp-based ID
	Name       string            `json:"name"`              // User-defined name
	TopicID    string            `json:"topicId,omitempty"` // Optional: linked topic
	Payload    string            `json:"payload"`           // Message payload (string)
	Attributes map[string]string `json:"attributes"`        // Key-value attributes
	CreatedAt  string            `json:"createdAt"`         // ISO 8601 timestamp
	UpdatedAt  string            `json:"updatedAt"`         // ISO 8601 timestamp
}

// Validate ensures the template has required fields
func (mt *MessageTemplate) Validate() error {
	if strings.TrimSpace(mt.ID) == "" {
		return errors.New("template ID cannot be empty")
	}
	if strings.TrimSpace(mt.Name) == "" {
		return errors.New("template name cannot be empty")
	}
	if strings.TrimSpace(mt.Payload) == "" {
		return errors.New("template payload cannot be empty")
	}
	return nil
}

// NewMessageTemplate creates a new MessageTemplate with a generated ID and timestamps
func NewMessageTemplate(name, payload string, attributes map[string]string) *MessageTemplate {
	now := time.Now().Format(time.RFC3339)
	return &MessageTemplate{
		ID:         generateID(),
		Name:       name,
		Payload:    payload,
		Attributes: attributes,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
}

// TopicSubscriptionTemplate represents a template for creating topics and subscriptions with best practices
type TopicSubscriptionTemplate struct {
	ID            string                       `json:"id"`                   // Template identifier
	Name          string                       `json:"name"`                 // Display name
	Description   string                       `json:"description"`          // Human-readable description
	Category      string                       `json:"category"`             // "production", "development", "specialized"
	IsBuiltIn     bool                         `json:"isBuiltIn"`            // Whether this is a built-in template
	Topic         TopicTemplateConfig          `json:"topic"`                // Topic configuration
	Subscriptions []SubscriptionTemplateConfig `json:"subscriptions"`        // Subscription configurations
	DeadLetter    *DeadLetterTemplateConfig    `json:"deadLetter,omitempty"` // Optional dead letter config
}

// TopicTemplateConfig represents topic configuration in a template
type TopicTemplateConfig struct {
	MessageRetentionDuration string                `json:"messageRetentionDuration,omitempty"` // e.g., "168h" for 7 days
	Labels                   map[string]string     `json:"labels,omitempty"`                   // Topic labels
	KMSKeyName               string                `json:"kmsKeyName,omitempty"`               // KMS key for encryption
	MessageStoragePolicy     *MessageStoragePolicy `json:"messageStoragePolicy,omitempty"`     // Regional storage policy
}

// MessageStoragePolicy represents message storage policy for topics
type MessageStoragePolicy struct {
	AllowedPersistenceRegions []string `json:"allowedPersistenceRegions,omitempty"` // GCP regions
}

// SubscriptionTemplateConfig represents subscription configuration in a template
type SubscriptionTemplateConfig struct {
	Name              string            `json:"name"`                        // Subscription name suffix (e.g., "sub", "worker")
	AckDeadline       int               `json:"ackDeadline"`                 // Ack deadline in seconds (10-600)
	RetentionDuration string            `json:"retentionDuration,omitempty"` // e.g., "7d"
	ExpirationPolicy  *ExpirationPolicy `json:"expirationPolicy,omitempty"`  // Auto-delete after idle
	RetryPolicy       *RetryPolicy      `json:"retryPolicy,omitempty"`       // Retry configuration
	EnableOrdering    bool              `json:"enableOrdering"`              // Enable message ordering
	EnableExactlyOnce bool              `json:"enableExactlyOnce"`           // Enable exactly-once delivery
	Filter            string            `json:"filter,omitempty"`            // Message filter expression
	PushConfig        *PushConfig       `json:"pushConfig,omitempty"`        // Push subscription config
	Labels            map[string]string `json:"labels,omitempty"`            // Subscription labels
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

// DeadLetterTemplateConfig represents dead letter queue configuration
type DeadLetterTemplateConfig struct {
	MaxDeliveryAttempts int `json:"maxDeliveryAttempts"` // 5-100
}

// TemplateCreateRequest represents a request to create resources from a template
type TemplateCreateRequest struct {
	TemplateID  string            `json:"templateId"`            // Template to use
	BaseName    string            `json:"baseName"`              // Base name for resources (e.g., "orders")
	Environment string            `json:"environment,omitempty"` // Optional environment suffix (e.g., "prod", "dev")
	Overrides   TemplateOverrides `json:"overrides,omitempty"`   // Optional configuration overrides
}

// TemplateOverrides allows customizing template settings
type TemplateOverrides struct {
	MessageRetentionDuration *string `json:"messageRetentionDuration,omitempty"` // Override topic retention
	AckDeadline              *int    `json:"ackDeadline,omitempty"`              // Override subscription ack deadline
	MaxDeliveryAttempts      *int    `json:"maxDeliveryAttempts,omitempty"`      // Override DLQ max attempts
	DisableDeadLetter        bool    `json:"disableDeadLetter"`                  // Disable DLQ creation
}

// TemplateCreateResult represents the result of creating resources from a template
type TemplateCreateResult struct {
	Success           bool     `json:"success"`                     // Whether creation succeeded
	TopicID           string   `json:"topicId"`                     // Created topic ID
	SubscriptionIDs   []string `json:"subscriptionIds"`             // Created subscription IDs
	DeadLetterTopicID string   `json:"deadLetterTopicId,omitempty"` // Created DLQ topic ID (if any)
	DeadLetterSubID   string   `json:"deadLetterSubId,omitempty"`   // Created DLQ subscription ID (if any)
	Warnings          []string `json:"warnings,omitempty"`          // Warnings (e.g., partial failures)
	Error             string   `json:"error,omitempty"`             // Error message if failed
}

// Validate validates a TopicSubscriptionTemplate
func (t *TopicSubscriptionTemplate) Validate() error {
	if err := t.validateBasicFields(); err != nil {
		return err
	}
	if err := t.validateTopicConfig(); err != nil {
		return err
	}
	if err := t.validateSubscriptions(); err != nil {
		return err
	}
	if err := t.validateDeadLetterConfig(); err != nil {
		return err
	}
	return nil
}

// validateBasicFields validates ID, Name, and Subscriptions count
func (t *TopicSubscriptionTemplate) validateBasicFields() error {
	if strings.TrimSpace(t.ID) == "" {
		return errors.New("template ID cannot be empty")
	}
	if strings.TrimSpace(t.Name) == "" {
		return errors.New("template name cannot be empty")
	}
	if len(t.Subscriptions) == 0 {
		return errors.New("template must have at least one subscription")
	}
	return nil
}

// validateTopicConfig validates topic configuration
func (t *TopicSubscriptionTemplate) validateTopicConfig() error {
	if t.Topic.MessageRetentionDuration == "" {
		return nil
	}
	duration, err := time.ParseDuration(t.Topic.MessageRetentionDuration)
	if err != nil {
		return fmt.Errorf("invalid topic retention duration: %w", err)
	}
	minRetention := 10 * time.Minute
	maxRetention := 31 * 24 * time.Hour
	if duration < minRetention || duration > maxRetention {
		return fmt.Errorf("topic retention must be between 10 minutes and 31 days")
	}
	return nil
}

// validateSubscriptions validates all subscription configurations
func (t *TopicSubscriptionTemplate) validateSubscriptions() error {
	for i, sub := range t.Subscriptions {
		if err := t.validateSubscriptionConfig(i, sub); err != nil {
			return err
		}
	}
	return nil
}

// validateSubscriptionConfig validates a single subscription configuration
func (t *TopicSubscriptionTemplate) validateSubscriptionConfig(index int, sub SubscriptionTemplateConfig) error {
	if strings.TrimSpace(sub.Name) == "" {
		return fmt.Errorf("subscription %d name cannot be empty", index)
	}
	if sub.AckDeadline < 10 || sub.AckDeadline > 600 {
		return fmt.Errorf("subscription %d ack deadline must be between 10 and 600 seconds", index)
	}
	if sub.RetryPolicy != nil {
		if err := t.validateRetryPolicy(index, sub.RetryPolicy); err != nil {
			return err
		}
	}
	return nil
}

// validateRetryPolicy validates retry policy configuration
func (t *TopicSubscriptionTemplate) validateRetryPolicy(index int, policy *RetryPolicy) error {
	minBackoff, err := time.ParseDuration(policy.MinimumBackoff)
	if err != nil {
		return fmt.Errorf("subscription %d invalid minimum backoff: %w", index, err)
	}
	maxBackoff, err := time.ParseDuration(policy.MaximumBackoff)
	if err != nil {
		return fmt.Errorf("subscription %d invalid maximum backoff: %w", index, err)
	}
	if minBackoff >= maxBackoff {
		return fmt.Errorf("subscription %d minimum backoff must be less than maximum backoff", index)
	}
	return nil
}

// validateDeadLetterConfig validates dead letter configuration
func (t *TopicSubscriptionTemplate) validateDeadLetterConfig() error {
	if t.DeadLetter == nil {
		return nil
	}
	if t.DeadLetter.MaxDeliveryAttempts < 5 || t.DeadLetter.MaxDeliveryAttempts > 100 {
		return errors.New("dead letter max delivery attempts must be between 5 and 100")
	}
	return nil
}

// Validate validates a TemplateCreateRequest
func (r *TemplateCreateRequest) Validate() error {
	if strings.TrimSpace(r.TemplateID) == "" {
		return errors.New("template ID cannot be empty")
	}
	if err := r.validateBaseName(); err != nil {
		return err
	}
	return nil
}

// validateBaseName validates the base name format
func (r *TemplateCreateRequest) validateBaseName() error {
	if strings.TrimSpace(r.BaseName) == "" {
		return errors.New("base name cannot be empty")
	}
	// Validate base name format (lowercase, alphanumeric, hyphens only)
	baseName := strings.ToLower(strings.TrimSpace(r.BaseName))
	if baseName != r.BaseName {
		return errors.New("base name must be lowercase")
	}
	if err := r.validateBaseNameCharacters(baseName); err != nil {
		return err
	}
	return nil
}

// validateBaseNameCharacters validates that base name contains only allowed characters
func (r *TemplateCreateRequest) validateBaseNameCharacters(baseName string) error {
	for _, char := range baseName {
		if !r.isValidBaseNameChar(char) {
			return errors.New("base name must contain only lowercase letters, numbers, and hyphens")
		}
	}
	return nil
}

// isValidBaseNameChar checks if a character is valid for base name
func (r *TemplateCreateRequest) isValidBaseNameChar(char rune) bool {
	return (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char == '-'
}
