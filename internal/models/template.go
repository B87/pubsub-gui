// Package models defines data structures for message templates
package models

import (
	"errors"
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
