// Package config provides configuration file management for the Pub/Sub GUI application
package config

import (
	"encoding/json"
	"os"
	"path/filepath"

	"myproject/internal/models"
)

// Manager handles loading and saving configuration
type Manager struct {
	configPath string
}

// NewManager creates a new config manager
func NewManager() (*Manager, error) {
	configPath, err := GetConfigPath()
	if err != nil {
		return nil, err
	}

	manager := &Manager{
		configPath: configPath,
	}

	// Initialize config directory if it doesn't exist
	if err := manager.InitConfigDir(); err != nil {
		return nil, err
	}

	return manager, nil
}

// InitConfigDir creates the config directory if it doesn't exist
func (m *Manager) InitConfigDir() error {
	configDir := filepath.Dir(m.configPath)

	// Check if directory exists
	if _, err := os.Stat(configDir); os.IsNotExist(err) {
		// Create directory with user-only permissions (0700)
		if err := os.MkdirAll(configDir, 0700); err != nil {
			return err
		}
	}

	return nil
}

// LoadConfig reads the config file and returns the AppConfig
// If the file doesn't exist, returns a default config
func (m *Manager) LoadConfig() (*models.AppConfig, error) {
	// Check if config file exists
	if _, err := os.Stat(m.configPath); os.IsNotExist(err) {
		// Return default config if file doesn't exist
		return models.NewDefaultConfig(), nil
	}

	// Read config file
	data, err := os.ReadFile(m.configPath)
	if err != nil {
		return nil, err
	}

	// Parse JSON
	var config models.AppConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, models.ErrInvalidConfig
	}

	return &config, nil
}

// SaveConfig writes the AppConfig to the config file
// Uses atomic write (temp file + rename) to prevent corruption
func (m *Manager) SaveConfig(config *models.AppConfig) error {
	// Ensure config directory exists
	if err := m.InitConfigDir(); err != nil {
		return err
	}

	// Marshal config to JSON with indentation for readability
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	// Create temp file in same directory for atomic rename
	configDir := filepath.Dir(m.configPath)
	tempFile, err := os.CreateTemp(configDir, "config-*.tmp")
	if err != nil {
		return err
	}
	tempPath := tempFile.Name()
	defer os.Remove(tempPath) // Clean up temp file if rename fails

	// Write data to temp file
	if _, err := tempFile.Write(data); err != nil {
		tempFile.Close()
		return err
	}

	// Close temp file before rename
	if err := tempFile.Close(); err != nil {
		return err
	}

	// Atomic rename temp file to actual config file
	if err := os.Rename(tempPath, m.configPath); err != nil {
		return err
	}

	// Set permissions to user-only (0600)
	if err := os.Chmod(m.configPath, 0600); err != nil {
		return err
	}

	return nil
}

// GetConfigPath returns the full path to the config file
func (m *Manager) GetConfigPath() string {
	return m.configPath
}
