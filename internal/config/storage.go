// Package config provides configuration file management for the Pub/Sub GUI application
package config

import (
	"os"
	"path/filepath"
)

const (
	// ConfigDirName is the directory name where config is stored in user's home directory
	ConfigDirName = ".pubsub-gui"

	// ConfigFileName is the name of the JSON config file
	ConfigFileName = "config.json"
)

// GetConfigDir returns the full path to the configuration directory (~/.pubsub-gui)
func GetConfigDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ConfigDirName), nil
}

// GetConfigPath returns the full path to the config file (~/.pubsub-gui/config.json)
func GetConfigPath() (string, error) {
	configDir, err := GetConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, ConfigFileName), nil
}
