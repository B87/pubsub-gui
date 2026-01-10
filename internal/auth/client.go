// Package auth handles Google Cloud Pub/Sub authentication and client management
package auth

import (
	"context"
	"fmt"
	"sync"
	"time"

	"cloud.google.com/go/pubsub/v2"

	"pubsub-gui/internal/logger"
)

// ClientManager manages the active Pub/Sub client connection
type ClientManager struct {
	mu        sync.RWMutex
	client    *pubsub.Client
	projectID string
	ctx       context.Context
}

// NewClientManager creates a new ClientManager
func NewClientManager(ctx context.Context) *ClientManager {
	return &ClientManager{
		ctx: ctx,
	}
}

// GetClient returns the current Pub/Sub client (nil if not connected)
func (cm *ClientManager) GetClient() *pubsub.Client {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.client
}

// GetProjectID returns the current project ID (empty if not connected)
func (cm *ClientManager) GetProjectID() string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.projectID
}

// IsConnected returns true if there's an active client connection
func (cm *ClientManager) IsConnected() bool {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.client != nil
}

// SetClient sets the active Pub/Sub client
// Closes any existing client before setting the new one
func (cm *ClientManager) SetClient(client *pubsub.Client, projectID string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Close existing client if any
	if cm.client != nil {
		oldClient := cm.client
		// Close old client in a goroutine with timeout to prevent blocking
		// if gRPC connections are stuck in IO wait
		done := make(chan error, 1)
		go func() {
			done <- oldClient.Close()
		}()

		select {
		case err := <-done:
			// Log error but don't fail - old client will be cleaned up by GC
			if err != nil {
				logger.Warn("Error closing old client in SetClient", "error", err)
			}
		case <-time.After(2 * time.Second):
			// Timeout - log warning but continue (old client will be cleaned up by GC)
			logger.Warn("Timeout closing old client in SetClient (gRPC connections may be stuck)")
		}
	}

	cm.client = client
	cm.projectID = projectID

	return nil
}

// Close closes the active Pub/Sub client connection
// Uses a timeout to prevent blocking if gRPC connections are stuck
func (cm *ClientManager) Close() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if cm.client == nil {
		return nil
	}

	client := cm.client
	cm.client = nil
	cm.projectID = ""

	// Close client in a goroutine with timeout to prevent blocking
	// if gRPC connections are stuck in IO wait
	done := make(chan error, 1)
	go func() {
		done <- client.Close()
	}()

	select {
	case err := <-done:
		return err
	case <-time.After(2 * time.Second):
		// Timeout - client close is taking too long, likely due to stuck gRPC connections
		// Log warning but don't block - connections will be cleaned up by GC
		return fmt.Errorf("timeout closing client (gRPC connections may be stuck)")
	}
}
