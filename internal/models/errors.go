// Package models defines data structures for connection profiles and application configuration
package models

import "errors"

// Custom error types for better error handling
var (
	// ErrProfileNotFound is returned when a profile with the given ID is not found
	ErrProfileNotFound = errors.New("profile not found")

	// ErrInvalidAuth is returned when authentication fails
	ErrInvalidAuth = errors.New("authentication failed: invalid credentials")

	// ErrEmulatorConnection is returned when unable to connect to the emulator
	ErrEmulatorConnection = errors.New("unable to connect to Pub/Sub emulator")

	// ErrNotConnected is returned when trying to perform operations without an active connection
	ErrNotConnected = errors.New("not connected to Pub/Sub: please connect first")

	// ErrConfigNotFound is returned when the config file doesn't exist
	ErrConfigNotFound = errors.New("config file not found")

	// ErrInvalidConfig is returned when the config file is malformed
	ErrInvalidConfig = errors.New("invalid config file format")

	// ErrServiceAccountNotFound is returned when the service account key file doesn't exist
	ErrServiceAccountNotFound = errors.New("service account key file not found")

	// ErrDuplicateProfile is returned when trying to create a profile with a duplicate name
	ErrDuplicateProfile = errors.New("profile with this name already exists")
)
