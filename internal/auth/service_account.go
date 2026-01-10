// Package auth handles Google Cloud Pub/Sub authentication and client management
package auth

import (
	"context"
	"os"

	"cloud.google.com/go/pubsub/v2"

	"pubsub-gui/internal/models"
)

// ConnectWithServiceAccount creates a Pub/Sub client using a service account JSON key file
// It validates that the key file exists before attempting to create the client
// If emulatorHost is provided, connects to the emulator instead of production
func ConnectWithServiceAccount(ctx context.Context, projectID, keyPath string, emulatorHost string) (*pubsub.Client, error) {
	// Validate that the service account key file exists
	if _, err := os.Stat(keyPath); os.IsNotExist(err) {
		return nil, models.ErrServiceAccountNotFound
	}

	// If emulator host is provided, ignore the service account key and use emulator
	if emulatorHost != "" {
		return ConnectWithADC(ctx, projectID, emulatorHost)
	}

	// Create Pub/Sub client with service account credentials
	// Set GOOGLE_APPLICATION_CREDENTIALS environment variable temporarily
	// This is the standard way to authenticate with a service account key file
	originalCreds := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", keyPath)
	defer func() {
		if originalCreds != "" {
			os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", originalCreds)
		} else {
			os.Unsetenv("GOOGLE_APPLICATION_CREDENTIALS")
		}
	}()

	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, err
	}

	return client, nil
}
