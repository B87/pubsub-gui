// Package auth handles Google Cloud Pub/Sub authentication and client management
package auth

import (
	"context"
	"os"

	"cloud.google.com/go/pubsub/v2"
	"google.golang.org/api/option"
)

// ConnectWithADC creates a Pub/Sub client using Application Default Credentials
// It automatically detects the PUBSUB_EMULATOR_HOST environment variable for local development
func ConnectWithADC(ctx context.Context, projectID string) (*pubsub.Client, error) {
	var opts []option.ClientOption

	// Check if emulator host is set
	emulatorHost := os.Getenv("PUBSUB_EMULATOR_HOST")
	if emulatorHost != "" {
		// When using emulator, we don't need additional options
		// The Pub/Sub client automatically uses the emulator when PUBSUB_EMULATOR_HOST is set
		opts = append(opts, option.WithoutAuthentication())
	}

	// Create Pub/Sub client with ADC (Application Default Credentials)
	// This will use:
	// 1. GOOGLE_APPLICATION_CREDENTIALS env var if set
	// 2. gcloud auth application-default credentials
	// 3. GCE/Cloud Run/Cloud Functions metadata server
	client, err := pubsub.NewClient(ctx, projectID, opts...)
	if err != nil {
		return nil, err
	}

	return client, nil
}
