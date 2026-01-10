// Package admin provides functions for listing and managing Pub/Sub snapshots
package admin

import (
	"context"
	"fmt"
	"strings"

	"cloud.google.com/go/pubsub/v2"
	pubsubpb "cloud.google.com/go/pubsub/v2/apiv1/pubsubpb"
	"google.golang.org/api/iterator"
)

// SnapshotInfo represents snapshot metadata
type SnapshotInfo struct {
	Name         string            `json:"name"`
	DisplayName  string            `json:"displayName"`
	Topic        string            `json:"topic"`
	Subscription string            `json:"subscription,omitempty"`
	ExpireTime   string            `json:"expireTime"`
	Labels       map[string]string `json:"labels,omitempty"`
}

// ListSnapshotsAdmin lists all snapshots in the project
func ListSnapshotsAdmin(ctx context.Context, client *pubsub.Client, projectID string) ([]SnapshotInfo, error) {
	var snapshots []SnapshotInfo

	req := &pubsubpb.ListSnapshotsRequest{
		Project: "projects/" + projectID,
	}

	it := client.SubscriptionAdminClient.ListSnapshots(ctx, req)

	for {
		snapshot, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to list snapshots: %w", err)
		}

		snapshotInfo := SnapshotInfo{
			Name:        snapshot.Name,
			DisplayName: extractSnapshotDisplayName(snapshot.Name),
			Topic:       snapshot.Topic,
		}

		if snapshot.ExpireTime != nil {
			snapshotInfo.ExpireTime = snapshot.ExpireTime.AsTime().Format("2006-01-02T15:04:05Z07:00")
		}

		if len(snapshot.Labels) > 0 {
			snapshotInfo.Labels = snapshot.Labels
		}

		snapshots = append(snapshots, snapshotInfo)
	}

	return snapshots, nil
}

// ListSnapshotsForSubscriptionAdmin lists snapshots that can be used with a specific subscription
// Note: GCP doesn't directly link snapshots to subscriptions, but snapshots are created from subscriptions
// and can only be used to seek subscriptions that share the same topic
func ListSnapshotsForSubscriptionAdmin(ctx context.Context, client *pubsub.Client, projectID, subscriptionID string) ([]SnapshotInfo, error) {
	// First, get the subscription to find its topic
	subName := subscriptionID
	if !strings.HasPrefix(subscriptionID, "projects/") {
		subName = "projects/" + projectID + "/subscriptions/" + subscriptionID
	}

	getReq := &pubsubpb.GetSubscriptionRequest{
		Subscription: subName,
	}
	sub, err := client.SubscriptionAdminClient.GetSubscription(ctx, getReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}

	// List all snapshots and filter by topic
	allSnapshots, err := ListSnapshotsAdmin(ctx, client, projectID)
	if err != nil {
		return nil, err
	}

	var filteredSnapshots []SnapshotInfo
	for _, snapshot := range allSnapshots {
		// Snapshots can seek subscriptions that share the same topic
		if snapshot.Topic == sub.Topic {
			filteredSnapshots = append(filteredSnapshots, snapshot)
		}
	}

	return filteredSnapshots, nil
}

// GetSnapshotAdmin retrieves metadata for a specific snapshot
func GetSnapshotAdmin(ctx context.Context, client *pubsub.Client, projectID, snapshotID string) (SnapshotInfo, error) {
	snapshotName := snapshotID
	if !strings.HasPrefix(snapshotID, "projects/") {
		snapshotName = "projects/" + projectID + "/snapshots/" + snapshotID
	}

	req := &pubsubpb.GetSnapshotRequest{
		Snapshot: snapshotName,
	}

	snapshot, err := client.SubscriptionAdminClient.GetSnapshot(ctx, req)
	if err != nil {
		return SnapshotInfo{}, fmt.Errorf("failed to get snapshot: %w", err)
	}

	snapshotInfo := SnapshotInfo{
		Name:        snapshot.Name,
		DisplayName: extractSnapshotDisplayName(snapshot.Name),
		Topic:       snapshot.Topic,
	}

	if snapshot.ExpireTime != nil {
		snapshotInfo.ExpireTime = snapshot.ExpireTime.AsTime().Format("2006-01-02T15:04:05Z07:00")
	}

	if len(snapshot.Labels) > 0 {
		snapshotInfo.Labels = snapshot.Labels
	}

	return snapshotInfo, nil
}

// CreateSnapshotAdmin creates a new snapshot from a subscription
func CreateSnapshotAdmin(ctx context.Context, client *pubsub.Client, projectID, subscriptionID, snapshotID string, labels map[string]string) error {
	// Normalize subscription ID
	subName := subscriptionID
	if !strings.HasPrefix(subscriptionID, "projects/") {
		subName = "projects/" + projectID + "/subscriptions/" + subscriptionID
	}

	// Normalize snapshot ID
	snapshotName := snapshotID
	if !strings.HasPrefix(snapshotID, "projects/") {
		snapshotName = "projects/" + projectID + "/snapshots/" + snapshotID
	}

	req := &pubsubpb.CreateSnapshotRequest{
		Name:         snapshotName,
		Subscription: subName,
	}

	if len(labels) > 0 {
		req.Labels = labels
	}

	_, err := client.SubscriptionAdminClient.CreateSnapshot(ctx, req)
	if err != nil {
		return fmt.Errorf("failed to create snapshot %s from subscription %s: %w", snapshotID, subscriptionID, err)
	}

	return nil
}

// DeleteSnapshotAdmin deletes a snapshot
func DeleteSnapshotAdmin(ctx context.Context, client *pubsub.Client, projectID, snapshotID string) error {
	snapshotName := snapshotID
	if !strings.HasPrefix(snapshotID, "projects/") {
		snapshotName = "projects/" + projectID + "/snapshots/" + snapshotID
	}

	req := &pubsubpb.DeleteSnapshotRequest{
		Snapshot: snapshotName,
	}

	err := client.SubscriptionAdminClient.DeleteSnapshot(ctx, req)
	if err != nil {
		return fmt.Errorf("failed to delete snapshot: %w", err)
	}

	return nil
}

// extractSnapshotDisplayName extracts the short name from a full snapshot resource path
func extractSnapshotDisplayName(fullName string) string {
	// Full name format: projects/{project}/snapshots/{snapshot-id}
	parts := strings.Split(fullName, "/")
	if len(parts) >= 4 && parts[2] == "snapshots" {
		return parts[3]
	}
	return fullName
}
