// Package subscriber provides streaming pull functionality for Pub/Sub subscriptions
package subscriber

import (
	"sync"
	"time"

	"cloud.google.com/go/pubsub/v2"
)

// PubSubMessage represents a received message from Pub/Sub
type PubSubMessage struct {
	ID              string            `json:"id"`
	PublishTime     string            `json:"publishTime"` // ISO 8601
	ReceiveTime     string            `json:"receiveTime"` // ISO 8601 (local)
	Data            string            `json:"data"`        // Decoded payload
	Attributes      map[string]string `json:"attributes"`
	DeliveryAttempt *int              `json:"deliveryAttempt,omitempty"`
	OrderingKey     string            `json:"orderingKey,omitempty"`
}

// MessageBuffer manages a FIFO buffer of messages
type MessageBuffer struct {
	messages []PubSubMessage
	maxSize  int
	mu       sync.RWMutex
}

// NewMessageBuffer creates a new MessageBuffer with the specified max size
func NewMessageBuffer(maxSize int) *MessageBuffer {
	if maxSize <= 0 {
		maxSize = 500 // Default size
	}
	return &MessageBuffer{
		messages: make([]PubSubMessage, 0),
		maxSize:  maxSize,
	}
}

// AddMessage adds a message to the buffer (FIFO)
// If the buffer is full, the oldest message is removed
func (mb *MessageBuffer) AddMessage(msg PubSubMessage) {
	mb.mu.Lock()
	defer mb.mu.Unlock()

	// Add to end
	mb.messages = append(mb.messages, msg)

	// Remove oldest if over limit
	if len(mb.messages) > mb.maxSize {
		mb.messages = mb.messages[1:]
	}
}

// GetMessages returns all messages (for search/display)
// Returns a copy to prevent race conditions
func (mb *MessageBuffer) GetMessages() []PubSubMessage {
	mb.mu.RLock()
	defer mb.mu.RUnlock()

	// Return copy to prevent race conditions
	result := make([]PubSubMessage, len(mb.messages))
	copy(result, mb.messages)
	return result
}

// Clear removes all messages from the buffer
func (mb *MessageBuffer) Clear() {
	mb.mu.Lock()
	defer mb.mu.Unlock()
	mb.messages = []PubSubMessage{}
}

// Size returns the current number of messages in the buffer
func (mb *MessageBuffer) Size() int {
	mb.mu.RLock()
	defer mb.mu.RUnlock()
	return len(mb.messages)
}

// SetMaxSize updates the maximum buffer size
func (mb *MessageBuffer) SetMaxSize(maxSize int) {
	mb.mu.Lock()
	defer mb.mu.Unlock()
	mb.maxSize = maxSize

	// Trim messages if current size exceeds new max
	if len(mb.messages) > maxSize {
		mb.messages = mb.messages[len(mb.messages)-maxSize:]
	}
}

// decodeMessage decodes a Pub/Sub message to our PubSubMessage format
func decodeMessage(msg *pubsub.Message) PubSubMessage {
	// Decode payload (base64 → string)
	data := string(msg.Data)

	// Format timestamps
	publishTime := msg.PublishTime.Format(time.RFC3339)
	receiveTime := time.Now().Format(time.RFC3339)

	// Extract delivery attempt if available
	var deliveryAttempt *int
	if msg.DeliveryAttempt != nil && *msg.DeliveryAttempt > 0 {
		attempt := int(*msg.DeliveryAttempt)
		deliveryAttempt = &attempt
	}

	// Ensure attributes is never nil (empty map instead)
	attributes := msg.Attributes
	if attributes == nil {
		attributes = make(map[string]string)
	}

	return PubSubMessage{
		ID:              msg.ID,
		PublishTime:     publishTime,
		ReceiveTime:     receiveTime,
		Data:            data,
		Attributes:      attributes,
		DeliveryAttempt: deliveryAttempt,
		OrderingKey:     msg.OrderingKey,
	}
}
