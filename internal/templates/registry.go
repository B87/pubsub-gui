// Package templates provides template system for creating topics and subscriptions with best practices
package templates

import (
	"fmt"
	"sync"

	"pubsub-gui/internal/models"
)

// Registry manages topic/subscription templates (built-in and custom)
type Registry struct {
	mu               sync.RWMutex
	builtInTemplates map[string]*models.TopicSubscriptionTemplate
	customTemplates  map[string]*models.TopicSubscriptionTemplate
}

// NewRegistry creates a new template registry with built-in templates loaded
func NewRegistry() *Registry {
	r := &Registry{
		builtInTemplates: make(map[string]*models.TopicSubscriptionTemplate),
		customTemplates:  make(map[string]*models.TopicSubscriptionTemplate),
	}

	// Load built-in templates
	builtIns := GetBuiltInTemplates()
	for _, template := range builtIns {
		r.builtInTemplates[template.ID] = template
	}

	return r
}

// GetTemplate retrieves a template by ID (checks built-in first, then custom)
func (r *Registry) GetTemplate(id string) (*models.TopicSubscriptionTemplate, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Check built-in templates first
	if template, exists := r.builtInTemplates[id]; exists {
		return template, nil
	}

	// Check custom templates
	if template, exists := r.customTemplates[id]; exists {
		return template, nil
	}

	return nil, fmt.Errorf("template not found: %s", id)
}

// ListTemplates returns all templates (built-in and custom)
func (r *Registry) ListTemplates() []*models.TopicSubscriptionTemplate {
	r.mu.RLock()
	defer r.mu.RUnlock()

	templates := make([]*models.TopicSubscriptionTemplate,
		0, len(r.builtInTemplates)+len(r.customTemplates))

	// Add built-in templates
	for _, template := range r.builtInTemplates {
		templates = append(templates, template)
	}

	// Add custom templates
	for _, template := range r.customTemplates {
		templates = append(templates, template)
	}

	return templates
}

// ListTemplatesByCategory returns templates filtered by category
func (r *Registry) ListTemplatesByCategory(category string) []*models.TopicSubscriptionTemplate {
	r.mu.RLock()
	defer r.mu.RUnlock()

	templates := make([]*models.TopicSubscriptionTemplate,
		0, len(r.builtInTemplates)+len(r.customTemplates))

	// Check built-in templates
	for _, template := range r.builtInTemplates {
		if template.Category == category {
			templates = append(templates, template)
		}
	}

	// Check custom templates
	for _, template := range r.customTemplates {
		if template.Category == category {
			templates = append(templates, template)
		}
	}

	return templates
}

// AddCustomTemplate adds a custom template to the registry
func (r *Registry) AddCustomTemplate(template *models.TopicSubscriptionTemplate) error {
	// Validate template
	if err := template.Validate(); err != nil {
		return fmt.Errorf("invalid template: %w", err)
	}

	// Ensure it's marked as custom
	template.IsBuiltIn = false

	r.mu.Lock()
	defer r.mu.Unlock()

	// Check if ID conflicts with built-in template
	if _, exists := r.builtInTemplates[template.ID]; exists {
		return fmt.Errorf("cannot override built-in template: %s", template.ID)
	}

	r.customTemplates[template.ID] = template
	return nil
}

// DeleteCustomTemplate removes a custom template (cannot delete built-in templates)
func (r *Registry) DeleteCustomTemplate(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Check if it's a built-in template
	if _, exists := r.builtInTemplates[id]; exists {
		return fmt.Errorf("cannot delete built-in template: %s", id)
	}

	// Delete custom template
	if _, exists := r.customTemplates[id]; !exists {
		return fmt.Errorf("custom template not found: %s", id)
	}

	delete(r.customTemplates, id)
	return nil
}

// GetCustomTemplates returns all custom templates (for persistence)
func (r *Registry) GetCustomTemplates() []*models.TopicSubscriptionTemplate {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var templates []*models.TopicSubscriptionTemplate
	for _, template := range r.customTemplates {
		templates = append(templates, template)
	}
	return templates
}

// LoadCustomTemplates loads custom templates into the registry (for startup)
func (r *Registry) LoadCustomTemplates(templates []*models.TopicSubscriptionTemplate) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, template := range templates {
		// Validate template
		if err := template.Validate(); err != nil {
			return fmt.Errorf("invalid custom template %s: %w", template.ID, err)
		}

		// Ensure it's marked as custom
		template.IsBuiltIn = false

		// Check for conflicts with built-in templates
		if _, exists := r.builtInTemplates[template.ID]; exists {
			return fmt.Errorf("custom template ID conflicts with built-in template: %s", template.ID)
		}

		r.customTemplates[template.ID] = template
	}

	return nil
}
