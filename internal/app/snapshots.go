// Package app provides handler structs for organizing App methods by domain
package app

import (
	"context"

	"pubsub-gui/internal/auth"
	"pubsub-gui/internal/models"
	"pubsub-gui/internal/pubsub/admin"
)

// SnapshotHandler handles snapshot management operations
type SnapshotHandler struct {
	ctx           context.Context
	clientManager *auth.ClientManager
}

// NewSnapshotHandler creates a new snapshot handler
func NewSnapshotHandler(
	ctx context.Context,
	clientManager *auth.ClientManager,
) *SnapshotHandler {
	return &SnapshotHandler{
		ctx:           ctx,
		clientManager: clientManager,
	}
}

// ListSnapshots returns all snapshots in the project
func (h *SnapshotHandler) ListSnapshots() ([]admin.SnapshotInfo, error) {
	client := h.clientManager.GetClient()
	if client == nil {
		return nil, models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()
	return admin.ListSnapshotsAdmin(h.ctx, client, projectID)
}

// ListSnapshotsForSubscription returns snapshots that can be used with a specific subscription
// (i.e., snapshots from the same topic as the subscription)
func (h *SnapshotHandler) ListSnapshotsForSubscription(subscriptionID string) ([]admin.SnapshotInfo, error) {
	client := h.clientManager.GetClient()
	if client == nil {
		return nil, models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()
	return admin.ListSnapshotsForSubscriptionAdmin(h.ctx, client, projectID, subscriptionID)
}

// GetSnapshot retrieves metadata for a specific snapshot
func (h *SnapshotHandler) GetSnapshot(snapshotID string) (admin.SnapshotInfo, error) {
	client := h.clientManager.GetClient()
	if client == nil {
		return admin.SnapshotInfo{}, models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()
	return admin.GetSnapshotAdmin(h.ctx, client, projectID, snapshotID)
}

// CreateSnapshot creates a new snapshot from a subscription
func (h *SnapshotHandler) CreateSnapshot(subscriptionID, snapshotID string, labels map[string]string) error {
	client := h.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()
	err := admin.CreateSnapshotAdmin(h.ctx, client, projectID, subscriptionID, snapshotID, labels)
	if err != nil {
		return err
	}

	return nil
}

// DeleteSnapshot deletes a snapshot
func (h *SnapshotHandler) DeleteSnapshot(snapshotID string) error {
	client := h.clientManager.GetClient()
	if client == nil {
		return models.ErrNotConnected
	}

	projectID := h.clientManager.GetProjectID()
	err := admin.DeleteSnapshotAdmin(h.ctx, client, projectID, snapshotID)
	if err != nil {
		return err
	}

	return nil
}
