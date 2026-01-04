// Package auth handles Google Cloud Pub/Sub authentication and client management
package auth

import (
	"context"
	"sync"

	"cloud.google.com/go/pubsub/v2"
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
		if err := cm.client.Close(); err != nil {
			return err
		}
	}

	cm.client = client
	cm.projectID = projectID

	return nil
}

// Close closes the active Pub/Sub client connection
func (cm *ClientManager) Close() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if cm.client == nil {
		return nil
	}

	err := cm.client.Close()
	cm.client = nil
	cm.projectID = ""

	return err
}
