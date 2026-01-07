// Package app provides handler structs for organizing App methods by domain
package app

import (
	"context"
	"fmt"

	"pubsub-gui/internal/auth"
	"pubsub-gui/internal/config"
	"pubsub-gui/internal/models"
	"pubsub-gui/internal/templates"
)

// TopicSubscriptionTemplateHandler handles topic/subscription template operations
// This is separate from TemplateHandler which handles message templates
type TopicSubscriptionTemplateHandler struct {
	ctx           context.Context
	clientManager *auth.ClientManager
	config        *models.AppConfig
	configManager *config.Manager
	registry      *templates.Registry
}

// NewTopicSubscriptionTemplateHandler creates a new topic/subscription template handler
func NewTopicSubscriptionTemplateHandler(ctx context.Context, clientManager *auth.ClientManager, config *models.AppConfig, configManager *config.Manager) *TopicSubscriptionTemplateHandler {
	registry := templates.NewRegistry()

	handler := &TopicSubscriptionTemplateHandler{
		ctx:           ctx,
		clientManager: clientManager,
		config:        config,
		configManager: configManager,
		registry:      registry,
	}

	// Load custom templates from config
	if config != nil && len(config.TopicSubscriptionTemplates) > 0 {
		customTemplates := make([]*models.TopicSubscriptionTemplate, 0, len(config.TopicSubscriptionTemplates))
		for i := range config.TopicSubscriptionTemplates {
			customTemplates = append(customTemplates, &config.TopicSubscriptionTemplates[i])
		}
		_ = registry.LoadCustomTemplates(customTemplates)
	}

	return handler
}

// GetTemplates returns all templates (built-in and custom)
func (h *TopicSubscriptionTemplateHandler) GetTemplates() ([]*models.TopicSubscriptionTemplate, error) {
	return h.registry.ListTemplates(), nil
}

// GetTemplatesByCategory returns templates filtered by category
func (h *TopicSubscriptionTemplateHandler) GetTemplatesByCategory(category string) ([]*models.TopicSubscriptionTemplate, error) {
	return h.registry.ListTemplatesByCategory(category), nil
}

// GetTemplate returns a specific template by ID
func (h *TopicSubscriptionTemplateHandler) GetTemplate(id string) (*models.TopicSubscriptionTemplate, error) {
	return h.registry.GetTemplate(id)
}

// CreateFromTemplate creates resources from a template
func (h *TopicSubscriptionTemplateHandler) CreateFromTemplate(request *models.TemplateCreateRequest) (*models.TemplateCreateResult, error) {
	// Check connection
	client := h.clientManager.GetClient()
	if client == nil {
		return &models.TemplateCreateResult{
			Success: false,
			Error:   "not connected to a project",
		}, nil
	}

	projectID := h.clientManager.GetProjectID()
	if projectID == "" {
		return &models.TemplateCreateResult{
			Success: false,
			Error:   "project ID not available",
		}, nil
	}

	// Create creator and execute template
	creator := templates.NewCreator(h.ctx, client, projectID, h.registry)
	return creator.CreateFromTemplate(request)
}

// SaveCustomTemplate saves a custom template to the configuration
func (h *TopicSubscriptionTemplateHandler) SaveCustomTemplate(template *models.TopicSubscriptionTemplate) error {
	// Validate template
	if err := template.Validate(); err != nil {
		return err
	}

	// Ensure it's marked as custom
	template.IsBuiltIn = false

	// Add to registry
	if err := h.registry.AddCustomTemplate(template); err != nil {
		return err
	}

	// Update config: find and update existing template, or add new one
	if h.config == nil {
		return fmt.Errorf("config is nil")
	}

	found := false
	for i, t := range h.config.TopicSubscriptionTemplates {
		if t.ID == template.ID {
			h.config.TopicSubscriptionTemplates[i] = *template
			found = true
			break
		}
	}

	if !found {
		h.config.TopicSubscriptionTemplates = append(h.config.TopicSubscriptionTemplates, *template)
	}

	// Save configuration
	return h.configManager.SaveConfig(h.config)
}

// DeleteCustomTemplate removes a custom template
func (h *TopicSubscriptionTemplateHandler) DeleteCustomTemplate(id string) error {
	// Delete from registry
	if err := h.registry.DeleteCustomTemplate(id); err != nil {
		return err
	}

	// Remove from config
	if h.config == nil {
		return fmt.Errorf("config is nil")
	}

	newTemplates := make([]models.TopicSubscriptionTemplate, 0)
	for _, t := range h.config.TopicSubscriptionTemplates {
		if t.ID != id {
			newTemplates = append(newTemplates, t)
		}
	}
	h.config.TopicSubscriptionTemplates = newTemplates

	// Save configuration
	return h.configManager.SaveConfig(h.config)
}
