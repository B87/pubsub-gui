// Package app provides handler structs for organizing App methods by domain
package app

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"pubsub-gui/internal/config"
	"pubsub-gui/internal/models"
	"pubsub-gui/internal/pubsub/subscriber"
)

// ConfigHandler handles application configuration operations
type ConfigHandler struct {
	ctx            context.Context
	config         *models.AppConfig
	configManager  *config.Manager
	activeMonitors map[string]*subscriber.MessageStreamer
	monitorsMu     *sync.RWMutex
}

// NewConfigHandler creates a new config handler
func NewConfigHandler(
	ctx context.Context,
	config *models.AppConfig,
	configManager *config.Manager,
	activeMonitors map[string]*subscriber.MessageStreamer,
	monitorsMu *sync.RWMutex,
) *ConfigHandler {
	return &ConfigHandler{
		ctx:            ctx,
		config:         config,
		configManager:  configManager,
		activeMonitors: activeMonitors,
		monitorsMu:     monitorsMu,
	}
}

// SetAutoAck updates auto-acknowledge setting
func (h *ConfigHandler) SetAutoAck(enabled bool) error {
	if h.config == nil {
		return fmt.Errorf("config not initialized")
	}

	// Update config
	h.config.AutoAck = enabled

	// Save config
	if err := h.configManager.SaveConfig(h.config); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	// Update all active monitors
	h.monitorsMu.RLock()
	for _, streamer := range h.activeMonitors {
		streamer.SetAutoAck(enabled)
	}
	h.monitorsMu.RUnlock()

	return nil
}

// GetAutoAck returns current auto-ack setting
func (h *ConfigHandler) GetAutoAck() (bool, error) {
	if h.config == nil {
		return true, nil // default
	}
	return h.config.AutoAck, nil
}

// UpdateTheme updates the theme setting and saves it to config
func (h *ConfigHandler) UpdateTheme(theme string) error {
	if h.configManager == nil {
		return fmt.Errorf("config manager not initialized")
	}

	// Validate theme value
	if theme != "light" && theme != "dark" && theme != "auto" && theme != "dracula" && theme != "monokai" {
		return fmt.Errorf("theme must be 'light', 'dark', 'auto', 'dracula', or 'monokai'")
	}

	// Load current config to preserve other settings
	if h.config == nil {
		var err error
		h.config, err = h.configManager.LoadConfig()
		if err != nil {
			return fmt.Errorf("failed to load config: %w", err)
		}
	}

	// Store old theme to detect changes
	oldTheme := h.config.Theme

	// Update theme
	h.config.Theme = theme

	// Save config
	if err := h.configManager.SaveConfig(h.config); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	// Emit event if theme changed
	if oldTheme != theme {
		runtime.EventsEmit(h.ctx, "config:theme-changed", theme)
	}

	return nil
}

// UpdateFontSize updates the font size setting and saves it to config
func (h *ConfigHandler) UpdateFontSize(size string) error {
	if h.configManager == nil {
		return fmt.Errorf("config manager not initialized")
	}

	// Validate font size value
	if size != "small" && size != "medium" && size != "large" {
		return fmt.Errorf("fontSize must be 'small', 'medium', or 'large'")
	}

	// Load current config to preserve other settings
	if h.config == nil {
		var err error
		h.config, err = h.configManager.LoadConfig()
		if err != nil {
			return fmt.Errorf("failed to load config: %w", err)
		}
	}

	// Store old font size to detect changes
	oldFontSize := h.config.FontSize

	// Update font size
	h.config.FontSize = size

	// Save config
	if err := h.configManager.SaveConfig(h.config); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	// Emit event if font size changed
	if oldFontSize != size {
		runtime.EventsEmit(h.ctx, "config:font-size-changed", size)
	}

	return nil
}

// GetConfigFileContent returns the raw JSON content of the config file
func (h *ConfigHandler) GetConfigFileContent() (string, error) {
	if h.configManager == nil {
		return "", fmt.Errorf("config manager not initialized")
	}

	// Load current config
	config, err := h.configManager.LoadConfig()
	if err != nil {
		return "", fmt.Errorf("failed to load config: %w", err)
	}

	// Marshal to JSON with indentation
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal config: %w", err)
	}

	return string(data), nil
}

// SaveConfigFileContent saves the raw JSON content to the config file
func (h *ConfigHandler) SaveConfigFileContent(content string) error {
	if h.configManager == nil {
		return fmt.Errorf("config manager not initialized")
	}

	// Validate JSON syntax
	var tempConfig models.AppConfig
	if err := json.Unmarshal([]byte(content), &tempConfig); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}

	// Validate config structure
	if tempConfig.MessageBufferSize < 100 || tempConfig.MessageBufferSize > 10000 {
		return fmt.Errorf("messageBufferSize must be between 100 and 10000")
	}

	if tempConfig.Theme != "light" && tempConfig.Theme != "dark" && tempConfig.Theme != "auto" && tempConfig.Theme != "dracula" && tempConfig.Theme != "monokai" {
		return fmt.Errorf("theme must be 'light', 'dark', 'auto', 'dracula', or 'monokai'")
	}

	if tempConfig.FontSize != "small" && tempConfig.FontSize != "medium" && tempConfig.FontSize != "large" {
		return fmt.Errorf("fontSize must be 'small', 'medium', or 'large'")
	}

	// Store old values to detect changes
	oldTheme := ""
	oldFontSize := ""
	oldAutoAck := false
	if h.config != nil {
		oldTheme = h.config.Theme
		oldFontSize = h.config.FontSize
		oldAutoAck = h.config.AutoAck
	}

	// Save config
	if err := h.configManager.SaveConfig(&tempConfig); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	// Reload config into memory
	h.config = &tempConfig

	// Apply theme changes if theme was modified
	if oldTheme != tempConfig.Theme {
		runtime.EventsEmit(h.ctx, "config:theme-changed", tempConfig.Theme)
	}

	// Apply font size changes if font size was modified
	if oldFontSize != tempConfig.FontSize {
		runtime.EventsEmit(h.ctx, "config:font-size-changed", tempConfig.FontSize)
	}

	// Update auto-ack for all active monitors if it changed
	if oldAutoAck != tempConfig.AutoAck {
		h.monitorsMu.RLock()
		for _, streamer := range h.activeMonitors {
			streamer.SetAutoAck(tempConfig.AutoAck)
		}
		h.monitorsMu.RUnlock()
	}

	return nil
}
