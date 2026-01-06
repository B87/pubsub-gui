// Package test provides mock types for testing
package test

import (
	"pubsub-gui/internal/app"
	"pubsub-gui/internal/models"
	"pubsub-gui/internal/pubsub/admin"
	"pubsub-gui/internal/pubsub/subscriber"
)

// MockClient represents a mock Pub/Sub client
type MockClient struct{}

// MockClientManager is a mock implementation of auth.ClientManager interface
type MockClientManager struct {
	GetClientFunc    func() interface{}
	GetProjectIDFunc func() string
	IsConnectedFunc  func() bool
	CloseFunc        func() error
}

// GetClient returns the mock client
func (m *MockClientManager) GetClient() interface{} {
	if m.GetClientFunc != nil {
		return m.GetClientFunc()
	}
	return nil
}

// GetProjectID returns the mock project ID
func (m *MockClientManager) GetProjectID() string {
	if m.GetProjectIDFunc != nil {
		return m.GetProjectIDFunc()
	}
	return ""
}

// IsConnected returns the mock connected status
func (m *MockClientManager) IsConnected() bool {
	if m.IsConnectedFunc != nil {
		return m.IsConnectedFunc()
	}
	return false
}

// Close closes the mock client
func (m *MockClientManager) Close() error {
	if m.CloseFunc != nil {
		return m.CloseFunc()
	}
	return nil
}

// MockConnectionHandler is a mock for connection handler (for documentation/testing patterns)
// Note: Since handlers are concrete types, these mocks are primarily for reference.
// Tests should use real handlers with mocked dependencies.
type MockConnectionHandler struct {
	GetConnectionStatusFunc       func() app.ConnectionStatus
	ConnectWithADCFunc            func(projectID string) error
	ConnectWithServiceAccountFunc func(projectID, keyPath string) error
	GetProfilesFunc               func() []models.ConnectionProfile
	SaveProfileFunc               func(profile models.ConnectionProfile) error
	DeleteProfileFunc             func(profileID string, disconnect func() error) error
	SwitchProfileFunc             func(profileID string, disconnect func() error) error
}

// MockResourceHandler is a mock for resource handler
type MockResourceHandler struct {
	SyncResourcesFunc           func() error
	ListTopicsFunc              func() ([]admin.TopicInfo, error)
	ListSubscriptionsFunc       func() ([]admin.SubscriptionInfo, error)
	GetTopicMetadataFunc        func(topicID string) (admin.TopicInfo, error)
	GetSubscriptionMetadataFunc func(subID string) (admin.SubscriptionInfo, error)
	CreateTopicFunc             func(topicID string, messageRetentionDuration string, syncResources func()) error
	DeleteTopicFunc             func(topicID string, syncResources func()) error
	CreateSubscriptionFunc      func(topicID string, subID string, ttlSeconds int64, syncResources func()) error
	DeleteSubscriptionFunc      func(subID string, syncResources func()) error
	UpdateSubscriptionFunc      func(subID string, params app.SubscriptionUpdateParams, syncResources func()) error
}

// MockTemplateHandler is a mock for template handler
type MockTemplateHandler struct {
	GetTemplatesFunc   func(topicID string) ([]models.MessageTemplate, error)
	SaveTemplateFunc   func(template models.MessageTemplate) error
	UpdateTemplateFunc func(templateID string, template models.MessageTemplate) error
	DeleteTemplateFunc func(templateID string) error
}

// MockMonitoringHandler is a mock for monitoring handler
type MockMonitoringHandler struct {
	StartMonitorFunc        func(subscriptionID string) error
	StopMonitorFunc         func(subscriptionID string) error
	StartTopicMonitorFunc   func(topicID string, subscriptionID string) error
	StopTopicMonitorFunc    func(topicID string) error
	GetBufferedMessagesFunc func(subscriptionID string) ([]subscriber.PubSubMessage, error)
	ClearMessageBufferFunc  func(subscriptionID string) error
}

// MockConfigHandler is a mock for config handler
type MockConfigHandler struct {
	SetAutoAckFunc            func(enabled bool) error
	GetAutoAckFunc            func() (bool, error)
	UpdateThemeFunc           func(theme string) error
	UpdateFontSizeFunc        func(size string) error
	GetConfigFileContentFunc  func() (string, error)
	SaveConfigFileContentFunc func(content string) error
}

// MockStreamer is a mock for message streamer
type MockStreamer struct {
	Stopped bool
}
