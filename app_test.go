//go:build integration
// +build integration

package test

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"pubsub-gui/test"
)

// setupIntegrationTestApp creates an App instance configured for integration testing with emulator
func setupIntegrationTestApp(t *testing.T) (*App, func()) {
	t.Helper()

	// Start emulator
	_, cleanupEmulator := test.StartEmulator(t)

	// Setup test config directory
	_, cleanupConfig := test.SetupTestConfigDir(t)

	// Create app
	app := NewApp()
	// Use context with longer timeout for integration tests (60 seconds for emulator operations)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	t.Cleanup(cancel)
	app.startup(ctx)

	cleanup := func() {
		app.Disconnect()
		cleanupConfig()
		cleanupEmulator()
	}

	return app, cleanup
}

// TestConnectWithADC_Integration tests connecting to emulator using ADC
func TestConnectWithADC_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	app, cleanup := setupIntegrationTestApp(t)
	defer cleanup()

	projectID := "test-project"

	err := app.ConnectWithADC(projectID)
	if err != nil {
		t.Fatalf("ConnectWithADC() error = %v", err)
	}

	// Verify connection status
	status := app.GetConnectionStatus()
	if !status.IsConnected {
		t.Error("ConnectWithADC() IsConnected = false, want true")
	}
	if status.ProjectID != projectID {
		t.Errorf("ConnectWithADC() ProjectID = %q, want %q", status.ProjectID, projectID)
	}
	if status.EmulatorHost == "" {
		t.Error("ConnectWithADC() EmulatorHost is empty, should be set when using emulator")
	}
}

// TestPublishMessage_Integration tests publishing messages using emulator
func TestPublishMessage_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	app, cleanup := setupIntegrationTestApp(t)
	defer cleanup()

	projectID := "test-project"

	// Connect to emulator
	if err := app.ConnectWithADC(projectID); err != nil {
		t.Fatalf("ConnectWithADC() error = %v", err)
	}

	// Create topic
	topicID := "test-topic"
	if err := app.CreateTopic(topicID, ""); err != nil {
		t.Fatalf("CreateTopic() error = %v", err)
	}

	// Publish message
	payload := `{"test": "data"}`
	attributes := map[string]string{
		"key1": "value1",
		"key2": "value2",
	}

	got, err := app.PublishMessage(topicID, payload, attributes)
	if err != nil {
		t.Fatalf("PublishMessage() error = %v", err)
	}

	if got.MessageID == "" {
		t.Error("PublishMessage() MessageID is empty")
	}
	if got.Timestamp == "" {
		t.Error("PublishMessage() Timestamp is empty")
	}

	// Verify timestamp is valid RFC3339
	_, err = time.Parse(time.RFC3339, got.Timestamp)
	if err != nil {
		t.Errorf("PublishMessage() Timestamp = %q, want valid RFC3339 format", got.Timestamp)
	}
}

// TestCreateTopic_Integration tests topic creation with emulator
func TestCreateTopic_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	app, cleanup := setupIntegrationTestApp(t)
	defer cleanup()

	projectID := "test-project"

	// Connect to emulator
	if err := app.ConnectWithADC(projectID); err != nil {
		t.Fatalf("ConnectWithADC() error = %v", err)
	}

	// Create topic
	topicID := "integration-test-topic"
	if err := app.CreateTopic(topicID, ""); err != nil {
		t.Fatalf("CreateTopic() error = %v", err)
	}

	// Verify topic exists by getting metadata
	topicInfo, err := app.GetTopicMetadata(topicID)
	if err != nil {
		t.Fatalf("GetTopicMetadata() error = %v", err)
	}

	if topicInfo.Name == "" {
		t.Error("GetTopicMetadata() Name is empty")
	}

	// Verify topic appears in list
	topics, err := app.ListTopics()
	if err != nil {
		t.Fatalf("ListTopics() error = %v", err)
	}

	found := false
	for _, topic := range topics {
		if topic.Name == topicInfo.Name {
			found = true
			break
		}
	}
	if !found {
		t.Error("CreateTopic() topic not found in ListTopics()")
	}
}

// TestDeleteTopic_Integration tests topic deletion with emulator
func TestDeleteTopic_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	app, cleanup := setupIntegrationTestApp(t)
	defer cleanup()

	projectID := "test-project"

	// Connect to emulator
	if err := app.ConnectWithADC(projectID); err != nil {
		t.Fatalf("ConnectWithADC() error = %v", err)
	}

	// Create topic
	topicID := "integration-test-topic-delete"
	if err := app.CreateTopic(topicID, ""); err != nil {
		t.Fatalf("CreateTopic() error = %v", err)
	}

	// Delete topic
	if err := app.DeleteTopic(topicID); err != nil {
		t.Fatalf("DeleteTopic() error = %v", err)
	}

	// Verify topic is deleted
	_, err := app.GetTopicMetadata(topicID)
	if err == nil {
		t.Error("DeleteTopic() topic still exists after deletion")
	}
}

// TestCreateSubscription_Integration tests subscription creation with emulator
func TestCreateSubscription_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	app, cleanup := setupIntegrationTestApp(t)
	defer cleanup()

	projectID := "test-project"

	// Connect to emulator
	if err := app.ConnectWithADC(projectID); err != nil {
		t.Fatalf("ConnectWithADC() error = %v", err)
	}

	// Create topic
	topicID := "integration-test-topic-sub"
	if err := app.CreateTopic(topicID, ""); err != nil {
		t.Fatalf("CreateTopic() error = %v", err)
	}

	// Create subscription
	subID := "integration-test-sub"
	ttlSeconds := int64(3600) // 1 hour
	if err := app.CreateSubscription(topicID, subID, ttlSeconds); err != nil {
		t.Fatalf("CreateSubscription() error = %v", err)
	}

	// Verify subscription exists
	subInfo, err := app.GetSubscriptionMetadata(subID)
	if err != nil {
		t.Fatalf("GetSubscriptionMetadata() error = %v", err)
	}

	if subInfo.Name == "" {
		t.Error("GetSubscriptionMetadata() Name is empty")
	}

	// Verify subscription appears in list
	subscriptions, err := app.ListSubscriptions()
	if err != nil {
		t.Fatalf("ListSubscriptions() error = %v", err)
	}

	found := false
	for _, sub := range subscriptions {
		if sub.Name == subInfo.Name {
			found = true
			break
		}
	}
	if !found {
		t.Error("CreateSubscription() subscription not found in ListSubscriptions()")
	}
}

// TestDeleteSubscription_Integration tests subscription deletion with emulator
func TestDeleteSubscription_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	app, cleanup := setupIntegrationTestApp(t)
	defer cleanup()

	projectID := "test-project"

	// Connect to emulator
	if err := app.ConnectWithADC(projectID); err != nil {
		t.Fatalf("ConnectWithADC() error = %v", err)
	}

	// Create topic and subscription
	topicID := "integration-test-topic-sub-delete"
	if err := app.CreateTopic(topicID, ""); err != nil {
		t.Fatalf("CreateTopic() error = %v", err)
	}

	subID := "integration-test-sub-delete"
	if err := app.CreateSubscription(topicID, subID, 3600); err != nil {
		t.Fatalf("CreateSubscription() error = %v", err)
	}

	// Delete subscription
	if err := app.DeleteSubscription(subID); err != nil {
		t.Fatalf("DeleteSubscription() error = %v", err)
	}

	// Verify subscription is deleted
	_, err := app.GetSubscriptionMetadata(subID)
	if err == nil {
		t.Error("DeleteSubscription() subscription still exists after deletion")
	}
}

// TestStartMonitor_Integration tests message monitoring with emulator
func TestStartMonitor_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	app, cleanup := setupIntegrationTestApp(t)
	defer cleanup()

	projectID := "test-project"

	// Connect to emulator
	if err := app.ConnectWithADC(projectID); err != nil {
		t.Fatalf("ConnectWithADC() error = %v", err)
	}

	// Create topic and subscription
	topicID := "integration-test-topic-monitor"
	if err := app.CreateTopic(topicID, ""); err != nil {
		t.Fatalf("CreateTopic() error = %v", err)
	}

	subID := "integration-test-sub-monitor"
	if err := app.CreateSubscription(topicID, subID, 3600); err != nil {
		t.Fatalf("CreateSubscription() error = %v", err)
	}

	// Start monitoring
	if err := app.StartMonitor(subID); err != nil {
		t.Fatalf("StartMonitor() error = %v", err)
	}

	// Publish a message
	payload := `{"test": "monitor"}`
	if _, err := app.PublishMessage(topicID, payload, nil); err != nil {
		t.Fatalf("PublishMessage() error = %v", err)
	}

	// Wait a bit for message to be received
	time.Sleep(1 * time.Second)

	// Get buffered messages
	messages, err := app.GetBufferedMessages(subID)
	if err != nil {
		t.Fatalf("GetBufferedMessages() error = %v", err)
	}

	if len(messages) == 0 {
		t.Error("StartMonitor() no messages received")
	} else {
		// Verify message content
		msg := messages[0]
		if msg.ID == "" {
			t.Error("StartMonitor() message ID is empty")
		}
		if string(msg.Data) != payload {
			t.Errorf("StartMonitor() message Data = %q, want %q", string(msg.Data), payload)
		}
	}

	// Stop monitoring
	if err := app.StopMonitor(subID); err != nil {
		t.Fatalf("StopMonitor() error = %v", err)
	}
}

// TestStartTopicMonitor_Integration tests topic monitoring with auto-created subscription
func TestStartTopicMonitor_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	app, cleanup := setupIntegrationTestApp(t)
	defer cleanup()

	projectID := "test-project"

	// Connect to emulator
	if err := app.ConnectWithADC(projectID); err != nil {
		t.Fatalf("ConnectWithADC() error = %v", err)
	}

	// Create topic
	topicID := "integration-test-topic-monitor-auto"
	if err := app.CreateTopic(topicID, ""); err != nil {
		t.Fatalf("CreateTopic() error = %v", err)
	}

	// Start topic monitoring (auto-creates subscription)
	if err := app.StartTopicMonitor(topicID, ""); err != nil {
		t.Fatalf("StartTopicMonitor() error = %v", err)
	}

	// Publish a message
	payload := `{"test": "topic-monitor"}`
	if _, err := app.PublishMessage(topicID, payload, nil); err != nil {
		t.Fatalf("PublishMessage() error = %v", err)
	}

	// Wait a bit for message to be received
	time.Sleep(1 * time.Second)

	// Verify subscription was created by listing subscriptions
	subscriptions, err := app.ListSubscriptions()
	if err != nil {
		t.Fatalf("ListSubscriptions() error = %v", err)
	}

	// Verify at least one subscription exists (the auto-created one)
	if len(subscriptions) == 0 {
		t.Error("StartTopicMonitor() no subscription created")
	}

	// Stop topic monitoring (should clean up subscription)
	if err := app.StopTopicMonitor(topicID); err != nil {
		t.Fatalf("StopTopicMonitor() error = %v", err)
	}
}

// TestDisconnect_Integration tests disconnect with active monitors
func TestDisconnect_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	app, cleanup := setupIntegrationTestApp(t)
	defer cleanup()

	projectID := "test-project"

	// Connect to emulator
	if err := app.ConnectWithADC(projectID); err != nil {
		t.Fatalf("ConnectWithADC() error = %v", err)
	}

	// Create topic and subscription
	topicID := "integration-test-topic-disconnect"
	if err := app.CreateTopic(topicID, ""); err != nil {
		t.Fatalf("CreateTopic() error = %v", err)
	}

	subID := "integration-test-sub-disconnect"
	if err := app.CreateSubscription(topicID, subID, 3600); err != nil {
		t.Fatalf("CreateSubscription() error = %v", err)
	}

	// Start monitoring
	if err := app.StartMonitor(subID); err != nil {
		t.Fatalf("StartMonitor() error = %v", err)
	}

	// Start topic monitoring
	if err := app.StartTopicMonitor(topicID, ""); err != nil {
		t.Fatalf("StartTopicMonitor() error = %v", err)
	}

	// Disconnect
	if err := app.Disconnect(); err != nil {
		t.Fatalf("Disconnect() error = %v", err)
	}

	// Verify connection is closed
	status := app.GetConnectionStatus()
	if status.IsConnected {
		t.Error("Disconnect() IsConnected = true, want false")
	}

	// Verify resource cache is cleared
	topics, err := app.ListTopics()
	if err != nil {
		t.Fatalf("ListTopics() error = %v", err)
	}
	if len(topics) != 0 {
		t.Errorf("Disconnect() topics length = %d, want 0 (cache cleared)", len(topics))
	}
}

// TestStartup_Integration tests full startup sequence with emulator
func TestStartup_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// Start emulator
	_, cleanupEmulator := test.StartEmulator(t)
	defer cleanupEmulator()

	// Setup test config with active profile
	configDir, cleanupConfig := test.SetupTestConfigDir(t)
	defer cleanupConfig()

	configPath := filepath.Join(configDir, ".pubsub-gui", "config.json")
	configJSON := `{
  "profiles": [{
    "id": "test-profile",
    "name": "Test Profile",
    "projectId": "test-project",
    "authMethod": "ADC",
    "isDefault": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }],
  "activeProfileId": "test-profile",
  "messageBufferSize": 500,
  "autoAck": true,
  "theme": "auto",
  "fontSize": "medium",
  "templates": []
}`

	if err := os.WriteFile(configPath, []byte(configJSON), 0644); err != nil {
		t.Fatalf("failed to write config: %v", err)
	}

	// Create app and startup
	app := NewApp()
	ctx := context.Background()
	app.startup(ctx)

	// Verify handlers are initialized
	if app.resources == nil {
		t.Error("startup() resources handler is nil")
	}
	if app.connection == nil {
		t.Error("startup() connection handler is nil")
	}
	if app.templates == nil {
		t.Error("startup() templates handler is nil")
	}
	if app.monitoring == nil {
		t.Error("startup() monitoring handler is nil")
	}
	if app.configH == nil {
		t.Error("startup() config handler is nil")
	}

	// Verify config is loaded
	if app.config == nil {
		t.Error("startup() config is nil")
	}

	// Verify auto-connect attempted (may succeed or fail, but should not crash)
	status := app.GetConnectionStatus()
	// Status may be connected or not, but should not panic
	_ = status

	// Cleanup
	app.Disconnect()
}
