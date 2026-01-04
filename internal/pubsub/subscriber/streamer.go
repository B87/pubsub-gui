// Package subscriber provides streaming pull functionality for Pub/Sub subscriptions
package subscriber

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"cloud.google.com/go/pubsub/v2"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// MessageStreamer handles streaming pull for a subscription
type MessageStreamer struct {
	ctx            context.Context
	subscriber     *pubsub.Subscriber
	subscriptionID string
	buffer         *MessageBuffer
	autoAck        bool
	cancel         context.CancelFunc
	doneChan       chan struct{}
	errChan        chan error
}

// NewMessageStreamer creates a new MessageStreamer
func NewMessageStreamer(ctx context.Context, subscriber *pubsub.Subscriber, subscriptionID string, buffer *MessageBuffer, autoAck bool) *MessageStreamer {
	streamCtx, cancel := context.WithCancel(ctx)
	return &MessageStreamer{
		ctx:            streamCtx,
		subscriber:     subscriber,
		subscriptionID: subscriptionID,
		buffer:         buffer,
		autoAck:        autoAck,
		cancel:         cancel,
		doneChan:       make(chan struct{}),
		errChan:        make(chan error, 1),
	}
}

// Start begins streaming pull for the subscription
func (ms *MessageStreamer) Start() error {
	if ms.subscriber == nil {
		return fmt.Errorf("subscriber is nil")
	}

	// Start goroutine for Receive callback
	go ms.receiveMessages()

	return nil
}

// receiveMessages handles the streaming pull receive loop
func (ms *MessageStreamer) receiveMessages() {
	defer close(ms.doneChan)

	// Use Receive with a callback function
	err := ms.subscriber.Receive(ms.ctx, func(_ context.Context, msg *pubsub.Message) {
		// Decode and transform message
		pubSubMsg := decodeMessage(msg)

		// Add to buffer
		ms.buffer.AddMessage(pubSubMsg)

		// Emit Wails event for new message
		runtime.EventsEmit(ms.ctx, "message:received", pubSubMsg)

		// Acknowledge if auto-ack enabled
		if ms.autoAck {
			msg.Ack()
		}
		// Otherwise, message remains unacked until:
		// - User manually acks (future feature)
		// - Ack deadline expires (Pub/Sub will redeliver)
	})

	// Handle errors
	if err != nil {
		// Check if error is due to context cancellation (graceful shutdown)
		if err == context.Canceled {
			return
		}

		errStr := err.Error()
		// Check if subscription was deleted (NotFound error) - this is expected during cleanup
		if strings.Contains(errStr, "NotFound") || strings.Contains(errStr, "not found") {
			// If subscription was deleted, this is expected and we should exit gracefully
			// Don't log as error or emit error event for NotFound errors
			return
		}

		// Log error for debugging
		log.Printf("Error receiving messages for subscription %s: %v", ms.subscriptionID, err)

		// Only emit error event if context is still active (not cancelled)
		select {
		case <-ms.ctx.Done():
			// Context cancelled, don't emit error (expected shutdown)
		default:
			// Context still active, emit error for unexpected issues
			runtime.EventsEmit(ms.ctx, "monitor:error", map[string]interface{}{
				"subscriptionID": ms.subscriptionID,
				"error":          err.Error(),
			})
		}

		// Send error to channel (non-blocking)
		select {
		case ms.errChan <- err:
		default:
			// Channel full, error already logged and emitted
		}
	}
}

// Stop gracefully stops streaming pull
func (ms *MessageStreamer) Stop() error {
	// Cancel context to stop Receive loop
	ms.cancel()

	// Wait for goroutine to finish (with timeout)
	select {
	case <-ms.doneChan:
		return nil
	case <-time.After(5 * time.Second):
		return fmt.Errorf("timeout waiting for streamer to stop")
	}
}

// SetAutoAck updates the auto-acknowledge setting
// Note: This only affects new messages, not messages already received
func (ms *MessageStreamer) SetAutoAck(enabled bool) {
	ms.autoAck = enabled
}

// GetAutoAck returns the current auto-ack setting
func (ms *MessageStreamer) GetAutoAck() bool {
	return ms.autoAck
}

// GetBuffer returns the message buffer
func (ms *MessageStreamer) GetBuffer() *MessageBuffer {
	return ms.buffer
}
