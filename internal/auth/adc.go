// Package auth handles Google Cloud Pub/Sub authentication and client management
package auth

import (
	"context"
	"os"

	"cloud.google.com/go/pubsub/v2"
	"google.golang.org/api/option"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// ConnectWithADC creates a Pub/Sub client using Application Default Credentials
// If emulatorHost is provided, connects to the emulator instead of production
func ConnectWithADC(ctx context.Context, projectID string, emulatorHost string) (*pubsub.Client, error) {
	var opts []option.ClientOption

	// If emulator host is provided, use it directly (don't check env var)
	if emulatorHost != "" {
		// Use emulator endpoint with insecure connection (no TLS)
		opts = append(opts, option.WithEndpoint(emulatorHost))
		opts = append(opts, option.WithoutAuthentication())
		opts = append(opts, option.WithGRPCDialOption(grpc.WithTransportCredentials(insecure.NewCredentials())))
	} else {
		// Fall back to env var for external tooling compatibility
		if envHost := os.Getenv("PUBSUB_EMULATOR_HOST"); envHost != "" {
			opts = append(opts, option.WithEndpoint(envHost))
			opts = append(opts, option.WithoutAuthentication())
			opts = append(opts, option.WithGRPCDialOption(grpc.WithTransportCredentials(insecure.NewCredentials())))
		}
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
