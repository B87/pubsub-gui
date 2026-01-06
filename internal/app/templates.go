// Package app provides handler structs for organizing App methods by domain
package app

import (
	"time"

	"pubsub-gui/internal/config"
	"pubsub-gui/internal/models"
)

// TemplateHandler handles message template operations
type TemplateHandler struct {
	config        *models.AppConfig
	configManager *config.Manager
}

// NewTemplateHandler creates a new template handler
func NewTemplateHandler(config *models.AppConfig, configManager *config.Manager) *TemplateHandler {
	return &TemplateHandler{
		config:        config,
		configManager: configManager,
	}
}

// GetTemplates returns all templates, optionally filtered by topicID
// If topicID is empty, returns all templates
// If topicID is provided, returns templates linked to that topic + global templates (no topicID)
func (h *TemplateHandler) GetTemplates(topicID string) ([]models.MessageTemplate, error) {
	if h.config == nil {
		return []models.MessageTemplate{}, nil
	}

	if topicID == "" {
		// Return all templates
		return h.config.Templates, nil
	}

	// Filter templates: include if no topicID (global) or matches current topic
	filtered := []models.MessageTemplate{}
	for _, t := range h.config.Templates {
		if t.TopicID == "" || t.TopicID == topicID {
			filtered = append(filtered, t)
		}
	}

	return filtered, nil
}

// SaveTemplate saves a message template to the configuration
func (h *TemplateHandler) SaveTemplate(template models.MessageTemplate) error {
	// Generate ID if not provided
	if template.ID == "" {
		template.ID = models.GenerateID()
	}

	// Set timestamps if not provided
	now := time.Now().Format(time.RFC3339)
	if template.CreatedAt == "" {
		template.CreatedAt = now
	}
	template.UpdatedAt = now

	// Validate template
	if err := template.Validate(); err != nil {
		return err
	}

	// Check for duplicate names (excluding the template itself if updating)
	for _, t := range h.config.Templates {
		if t.Name == template.Name && t.ID != template.ID {
			return models.ErrDuplicateTemplate
		}
	}

	// Find and update existing template, or add new one
	found := false
	for i, t := range h.config.Templates {
		if t.ID == template.ID {
			h.config.Templates[i] = template
			found = true
			break
		}
	}

	if !found {
		h.config.Templates = append(h.config.Templates, template)
	}

	// Save configuration
	return h.configManager.SaveConfig(h.config)
}

// UpdateTemplate updates an existing template
func (h *TemplateHandler) UpdateTemplate(templateID string, template models.MessageTemplate) error {
	if templateID == "" {
		return models.ErrTemplateNotFound
	}

	// Set the ID to match
	template.ID = templateID
	template.UpdatedAt = time.Now().Format(time.RFC3339)

	// Validate template
	if err := template.Validate(); err != nil {
		return err
	}

	// Find and update existing template
	found := false
	for i, t := range h.config.Templates {
		if t.ID == templateID {
			// Preserve CreatedAt
			template.CreatedAt = t.CreatedAt
			h.config.Templates[i] = template
			found = true
			break
		}
	}

	if !found {
		return models.ErrTemplateNotFound
	}

	// Check for duplicate names (excluding the template itself)
	for _, t := range h.config.Templates {
		if t.Name == template.Name && t.ID != templateID {
			return models.ErrDuplicateTemplate
		}
	}

	// Save configuration
	return h.configManager.SaveConfig(h.config)
}

// DeleteTemplate removes a template from the configuration
func (h *TemplateHandler) DeleteTemplate(templateID string) error {
	if templateID == "" {
		return models.ErrTemplateNotFound
	}

	// Find and remove the template
	newTemplates := make([]models.MessageTemplate, 0)
	found := false
	for _, t := range h.config.Templates {
		if t.ID == templateID {
			found = true
		} else {
			newTemplates = append(newTemplates, t)
		}
	}

	if !found {
		return models.ErrTemplateNotFound
	}

	h.config.Templates = newTemplates

	// Save configuration
	return h.configManager.SaveConfig(h.config)
}
