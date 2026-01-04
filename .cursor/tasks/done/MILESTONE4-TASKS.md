# Milestone 4: Subscription Monitor - Task Definition

**Version:** 1.0
**Target:** Week 5-6
**Status:** Planning

---

## Overview

Milestone 4 implements the **Subscription Monitor** feature, enabling users to stream and view messages from Pub/Sub subscriptions in real-time. The system uses Google Cloud Pub/Sub's **streaming pull** API to receive messages with low latency, manages an in-memory message buffer, and provides a performant UI with virtual scrolling to handle large message volumes.

### Core Deliverables

1. **Streaming Pull Implementation** - Go backend using Pub/Sub streaming pull API
2. **Message Buffer Management** - FIFO buffer with configurable size limit (default: 500)
3. **Auto-Acknowledge Toggle** - Control whether messages are auto-acked or require manual ack
4. **Virtual Scrolling UI** - High-performance message list that handles 500+ messages
5. **Message Search** - Real-time search within buffered messages (payload + attributes)
6. **Copy Actions** - Copy payload and message ID to clipboard
7. **Clear Buffer** - Remove all buffered messages from memory

---

## Streaming Pull Architecture

### 1. Backend Streaming Implementation

#### 1.1 Go Backend Structure

**Package:** `internal/pubsub/subscriber/`

```
internal/pubsub/subscriber/
├── streamer.go          # Main streaming pull implementation
├── buffer.go            # Message buffer management (FIFO)
└── monitor.go           # Monitor lifecycle (start/stop)
```

#### 1.2 Streaming Pull Pattern

The Go Pub/Sub client library provides a **streaming pull** API that uses gRPC streaming to receive messages with low latency. The implementation uses:

- **`subscription.Receive()`** - Starts a streaming pull that receives messages via a callback
- **Goroutines** - Handle concurrent message processing
- **Channels** - Communicate between goroutines and Wails event system
- **Context cancellation** - Graceful shutdown of streaming pull

**Key Components:**

```go
// internal/pubsub/subscriber/streamer.go

type MessageStreamer struct {
    ctx          context.Context
    subscription *pubsub.Subscription
    buffer       *MessageBuffer
    autoAck      bool
    messageChan  chan *pubsub.Message
    errorChan    chan error
    doneChan     chan struct{}
}

// Start begins streaming pull
func (ms *MessageStreamer) Start() error {
    // Start goroutine for Receive callback
    // Emit messages to Wails events
    // Handle errors and retries
}

// Stop gracefully stops streaming pull
func (ms *MessageStreamer) Stop() error {
    // Cancel context
    // Close channels
    // Wait for goroutine completion
}
```

#### 1.3 Message Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User clicks "Start Monitoring"                            │
│    → Frontend calls StartMonitor(subscriptionID)             │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Backend creates MessageStreamer                           │
│    → Initializes subscription client                         │
│    → Creates message buffer (size from config)               │
│    → Sets auto-ack flag from config                          │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend starts streaming pull                              │
│    → Calls subscription.Receive(ctx, callback)               │
│    → Starts goroutine for message processing                 │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Messages arrive via callback                             │
│    → Decode payload (base64 → string)                        │
│    → Extract attributes, message ID, timestamps             │
│    → Add to buffer (FIFO, remove oldest if full)              │
│    → Acknowledge message (if auto-ack enabled)               │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Backend emits Wails event                                 │
│    → runtime.EventsEmit(ctx, "message:received", message)   │
│    → Frontend receives event and adds to UI                  │
└─────────────────────────────────────────────────────────────┘
```

### 2. Message Buffer System

#### 2.1 Buffer Data Structure

**Go Model:** `internal/pubsub/subscriber/buffer.go`

```go
// MessageBuffer manages a FIFO buffer of messages
type MessageBuffer struct {
    messages []PubSubMessage
    maxSize  int
    mu       sync.RWMutex
}

// PubSubMessage represents a received message
type PubSubMessage struct {
    ID              string            `json:"id"`
    PublishTime     string            `json:"publishTime"`     // ISO 8601
    ReceiveTime     string            `json:"receiveTime"`     // ISO 8601 (local)
    Data            string            `json:"data"`            // Decoded payload
    Attributes      map[string]string `json:"attributes"`
    DeliveryAttempt *int              `json:"deliveryAttempt,omitempty"`
    OrderingKey     string            `json:"orderingKey,omitempty"`
}

// AddMessage adds a message to the buffer (FIFO)
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
func (mb *MessageBuffer) GetMessages() []PubSubMessage {
    mb.mu.RLock()
    defer mb.mu.RUnlock()

    // Return copy to prevent race conditions
    result := make([]PubSubMessage, len(mb.messages))
    copy(result, mb.messages)
    return result
}

// Clear removes all messages
func (mb *MessageBuffer) Clear() {
    mb.mu.Lock()
    defer mb.mu.Unlock()
    mb.messages = []PubSubMessage{}
}
```

#### 2.2 Buffer Configuration

Buffer size is configurable via `AppConfig.MessageBufferSize` (default: 500):

- **Storage:** In-memory only (not persisted to disk)
- **Behavior:** FIFO (First In, First Out) - oldest messages removed when limit reached
- **Thread Safety:** Uses `sync.RWMutex` for concurrent access
- **Scope:** One buffer per active subscription monitor

**Configuration Source:**
```go
// Loaded from ~/.pubsub-gui/config.json
{
  "messageBufferSize": 500  // Configurable, default 500
}
```

### 3. Auto-Acknowledge System

#### 3.1 Acknowledge Behavior

**Default:** Auto-acknowledge enabled (prevents redelivery storms)

**Configuration:**
- Stored in `AppConfig.AutoAck` (default: `true`)
- Can be toggled via UI toggle switch
- Change persists to config file

#### 3.2 Acknowledge Flow

```go
// In message callback
func (ms *MessageStreamer) handleMessage(msg *pubsub.Message) {
    // Decode and process message
    pubSubMsg := decodeMessage(msg)

    // Add to buffer
    ms.buffer.AddMessage(pubSubMsg)

    // Emit to frontend
    runtime.EventsEmit(ms.ctx, "message:received", pubSubMsg)

    // Acknowledge if auto-ack enabled
    if ms.autoAck {
        msg.Ack()
    }
    // Otherwise, message remains unacked until:
    // - User manually acks (future feature)
    // - Ack deadline expires (Pub/Sub will redeliver)
}
```

#### 3.3 Toggle Auto-Ack

**User Flow:**
1. User toggles "Auto-acknowledge" switch in UI
2. Frontend calls `SetAutoAck(enabled bool)` Go method
3. Backend updates `AppConfig.AutoAck`
4. Backend saves config file
5. New messages respect the new setting

**Note:** Changing auto-ack does not affect messages already received (they're already acked or not)

---

## UI Components

### 4. Message List with Virtual Scrolling

#### 4.1 Virtual Scrolling Library

**Recommendation:** Use `react-window` or `@tanstack/react-virtual` for virtual scrolling

**Why Virtual Scrolling:**
- Renders only visible messages (e.g., 20-30 at a time)
- Maintains performance with 500+ messages
- Smooth scrolling experience
- Low memory footprint

#### 4.2 Message Card Component

**Component:** `frontend/src/components/MessageCard.tsx`

**Structure:**
```
┌─────────────────────────────────────────────────┐
│ Message Card (Collapsible)                      │
├─────────────────────────────────────────────────┤
│ Header:                                          │
│   - Message ID (truncated) + copy button        │
│   - Received timestamp (local time)              │
│   - Delivery attempt count (if available)        │
│   - Expand/collapse button                       │
├─────────────────────────────────────────────────┤
│ Collapsed View:                                  │
│   - Payload preview (first 100 chars)           │
│   - Attribute count                              │
├─────────────────────────────────────────────────┤
│ Expanded View:                                  │
│   - Full payload (with JSON syntax highlighting)│
│   - Attributes table (key-value pairs)          │
│   - Copy payload button                          │
│   - Copy message ID button                       │
└─────────────────────────────────────────────────┘
```

#### 4.3 Subscription Monitor Component

**Component:** `frontend/src/components/SubscriptionMonitor.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Subscription Monitor Header                                  │
│   - Subscription name                                        │
│   - Start/Stop Monitoring button                            │
│   - Auto-ack toggle                                          │
│   - Clear buffer button                                      │
│   - Message count indicator                                  │
├─────────────────────────────────────────────────────────────┤
│ Search Bar                                                   │
│   - Search input (filters payload + attributes)             │
│   - Clear search button                                      │
├─────────────────────────────────────────────────────────────┤
│ Message List (Virtual Scrolling)                            │
│   ┌─────────────────────────────────────────────────────┐ │
│   │ Message Card 1 (newest)                               │ │
│   ├─────────────────────────────────────────────────────┤ │
│   │ Message Card 2                                        │ │
│   ├─────────────────────────────────────────────────────┤ │
│   │ ... (only visible messages rendered)                 │ │
│   └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5. Search Implementation

#### 5.1 Search Functionality

**Scope:** Search within buffered messages only (not live stream)

**Search Fields:**
- Message payload (full text search)
- Message attributes (key and value)

**Search Behavior:**
- **Real-time:** Filters as user types (debounced for performance)
- **Case-insensitive:** Search is case-insensitive
- **Partial match:** Matches any substring in payload or attributes
- **Client-side:** All filtering done in frontend (no backend calls)

#### 5.2 Search Implementation

```typescript
// frontend/src/hooks/useMessageSearch.ts

function useMessageSearch(messages: PubSubMessage[], searchQuery: string) {
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) {
      return messages;
    }

    const query = searchQuery.toLowerCase();

    return messages.filter(msg => {
      // Search in payload
      if (msg.data.toLowerCase().includes(query)) {
        return true;
      }

      // Search in attributes (keys and values)
      for (const [key, value] of Object.entries(msg.attributes)) {
        if (key.toLowerCase().includes(query) ||
            value.toLowerCase().includes(query)) {
          return true;
        }
      }

      return false;
    });
  }, [messages, searchQuery]);

  return filteredMessages;
}
```

**Performance:**
- Uses `useMemo` to avoid re-filtering on every render
- Debounce search input (300ms) to reduce filtering frequency
- Virtual scrolling ensures only filtered results are rendered

---

## Wails Communication Pattern

### 6. Backend Methods (Frontend → Backend)

```go
// app.go

// StartMonitor starts streaming pull for a subscription
func (a *App) StartMonitor(subscriptionID string) error

// StopMonitor stops streaming pull for a subscription
func (a *App) StopMonitor(subscriptionID string) error

// GetBufferedMessages returns all messages in buffer
func (a *App) GetBufferedMessages() ([]PubSubMessage, error)

// ClearMessageBuffer clears the message buffer
func (a *App) ClearMessageBuffer() error

// SetAutoAck updates auto-acknowledge setting
func (a *App) SetAutoAck(enabled bool) error

// GetAutoAck returns current auto-ack setting
func (a *App) GetAutoAck() (bool, error)
```

### 7. Wails Events (Backend → Frontend)

```go
// Message received
runtime.EventsEmit(ctx, "message:received", PubSubMessage{
    ID:          "...",
    PublishTime: "...",
    ReceiveTime: "...",
    Data:        "...",
    Attributes:  map[string]string{...},
})

// Monitor started
runtime.EventsEmit(ctx, "monitor:started", map[string]interface{}{
    "subscriptionID": "...",
})

// Monitor stopped
runtime.EventsEmit(ctx, "monitor:stopped", map[string]interface{}{
    "subscriptionID": "...",
})

// Monitor error
runtime.EventsEmit(ctx, "monitor:error", map[string]interface{}{
    "subscriptionID": "...",
    "error":         "...",
})
```

### 8. Frontend Event Handling

```typescript
// frontend/src/components/SubscriptionMonitor.tsx

import { EventsOn } from "../wailsjs/runtime/runtime";

useEffect(() => {
  // Listen for new messages
  const unsubscribe = EventsOn("message:received", (message: PubSubMessage) => {
    setMessages(prev => {
      // Add to beginning (newest first)
      const updated = [message, ...prev];
      // Enforce buffer limit (remove oldest if needed)
      return updated.slice(0, bufferSize);
    });
  });

  return () => unsubscribe();
}, [bufferSize]);
```

---

## Implementation Tasks

### Backend Tasks

#### Task 4.1: Create Subscriber Package Structure
- [ ] Create `internal/pubsub/subscriber/` directory
- [ ] Create `buffer.go` with `MessageBuffer` struct and methods
- [ ] Create `streamer.go` with `MessageStreamer` struct
- [ ] Create `monitor.go` for monitor lifecycle management

#### Task 4.2: Implement Message Buffer
- [ ] Implement `MessageBuffer` with FIFO logic
- [ ] Add thread-safe operations (mutex)
- [ ] Implement `AddMessage()`, `GetMessages()`, `Clear()`
- [ ] Add buffer size limit enforcement

#### Task 4.3: Implement Streaming Pull
- [ ] Implement `MessageStreamer.Start()` using `subscription.Receive()`
- [ ] Implement message decoding (base64 → string)
- [ ] Implement message transformation to `PubSubMessage`
- [ ] Implement auto-ack logic
- [ ] Implement Wails event emission for new messages

#### Task 4.4: Implement Monitor Lifecycle
- [ ] Implement `StartMonitor(subscriptionID)` in `app.go`
- [ ] Implement `StopMonitor(subscriptionID)` in `app.go`
- [ ] Store active monitors in `App` struct (map of subscriptionID → MessageStreamer)
- [ ] Handle graceful shutdown on disconnect

#### Task 4.5: Implement Buffer Management Methods
- [ ] Add `GetBufferedMessages()` to `app.go`
- [ ] Add `ClearMessageBuffer()` to `app.go`
- [ ] Add `SetAutoAck(enabled)` to `app.go`
- [ ] Add `GetAutoAck()` to `app.go`

#### Task 4.6: Error Handling & Retry Logic
- [ ] Implement retry logic for transient errors
- [ ] Emit `monitor:error` events for user-facing errors
- [ ] Handle connection loss and reconnection
- [ ] Log errors appropriately

### Frontend Tasks

#### Task 4.7: Message TypeScript Types
- [ ] Add `PubSubMessage` interface to `frontend/src/types/index.ts`
- [ ] Update Wails bindings (run `wails dev` to regenerate)

#### Task 4.8: Message Card Component
- [ ] Create `frontend/src/components/MessageCard.tsx`
- [ ] Implement collapsible message card
- [ ] Add payload preview (collapsed) and full payload (expanded)
- [ ] Add attributes display (key-value table)
- [ ] Add copy payload button
- [ ] Add copy message ID button
- [ ] Implement JSON syntax highlighting (if JSON detected)

#### Task 4.9: Subscription Monitor Component
- [ ] Create `frontend/src/components/SubscriptionMonitor.tsx`
- [ ] Add "Start Monitoring" / "Stop Monitoring" button
- [ ] Add auto-ack toggle switch
- [ ] Add clear buffer button
- [ ] Add message count indicator
- [ ] Integrate with `SubscriptionDetails` component

#### Task 4.10: Virtual Scrolling Implementation
- [ ] Install virtual scrolling library (`react-window` or `@tanstack/react-virtual`)
- [ ] Implement virtual scrolling in message list
- [ ] Configure item height (fixed or dynamic)
- [ ] Test performance with 500+ messages

#### Task 4.11: Search Implementation
- [ ] Create `useMessageSearch` hook
- [ ] Add search input to `SubscriptionMonitor`
- [ ] Implement debounced search (300ms)
- [ ] Filter messages by payload and attributes
- [ ] Update virtual scrolling with filtered results

#### Task 4.12: Wails Event Integration
- [ ] Set up `EventsOn` listeners for `message:received`
- [ ] Set up `EventsOn` listeners for `monitor:started`, `monitor:stopped`, `monitor:error`
- [ ] Update message list state on events
- [ ] Handle error states in UI

#### Task 4.13: UI Polish
- [ ] Add loading indicator while connecting
- [ ] Add error banner for stream disconnections
- [ ] Add empty state when no messages
- [ ] Add "No messages match search" state
- [ ] Style message cards with Tailwind CSS
- [ ] Add smooth animations for new messages

### Integration Tasks

#### Task 4.14: Integrate Monitor with Subscription Details
- [ ] Update `SubscriptionDetails.tsx` to show monitor UI
- [ ] Add tab or section for "Monitor" view
- [ ] Handle subscription selection → start monitoring flow

#### Task 4.15: Buffer Size Configuration
- [ ] Ensure buffer size is loaded from config
- [ ] Update buffer when config changes
- [ ] Document buffer size setting in UI (optional: show in monitor header)

---

## Acceptance Criteria

### Functional Requirements

- [ ] **AC1:** User can start monitoring a subscription with "Start Monitoring" button
- [ ] **AC2:** Messages appear in UI within 2 seconds of publish time
- [ ] **AC3:** User can stop monitoring with "Stop Monitoring" button
- [ ] **AC4:** Message buffer limits to configured size (default: 500)
- [ ] **AC5:** Oldest messages are removed when buffer is full (FIFO)
- [ ] **AC6:** Auto-ack toggle controls whether messages are auto-acknowledged
- [ ] **AC7:** Auto-ack setting persists across app restarts
- [ ] **AC8:** User can search within buffered messages (payload + attributes)
- [ ] **AC9:** Search filters messages in real-time (< 100ms)
- [ ] **AC10:** User can copy message payload to clipboard
- [ ] **AC11:** User can copy message ID to clipboard
- [ ] **AC12:** User can clear message buffer
- [ ] **AC13:** Messages display with received timestamp (local time)
- [ ] **AC14:** Messages display with message ID
- [ ] **AC15:** Messages display with attributes (key-value pairs)
- [ ] **AC16:** Messages display with delivery attempt count (if available)
- [ ] **AC17:** JSON payloads are pretty-printed with syntax highlighting

### Performance Requirements

- [ ] **AC18:** UI remains responsive with 500 messages in buffer
- [ ] **AC19:** Virtual scrolling renders only visible messages
- [ ] **AC20:** Search filtering completes in < 100ms for 500 messages
- [ ] **AC21:** New messages appear without UI freezing
- [ ] **AC22:** Memory usage stays reasonable (< 500MB with 500 messages)

### UX Requirements

- [ ] **AC23:** Message cards are collapsible (show summary when collapsed)
- [ ] **AC24:** Loading indicator shows while connecting to subscription
- [ ] **AC25:** Error banner displays if stream disconnects
- [ ] **AC26:** Empty state shows when no messages received
- [ ] **AC27:** "No messages match search" state shows when search has no results
- [ ] **AC28:** Copy buttons show visual feedback (toast or icon change)
- [ ] **AC29:** Messages are ordered newest-first (most recent at top)

### Reliability Requirements

- [ ] **AC30:** Stream recovers automatically from transient network errors
- [ ] **AC31:** Graceful shutdown when stopping monitor (no message loss during shutdown)
- [ ] **AC32:** Multiple subscriptions can be monitored (one at a time, with proper cleanup)
- [ ] **AC33:** Buffer persists during view switches (until cleared or app restart)

---

## Technical Notes

### Streaming Pull vs Synchronous Pull

**Why Streaming Pull:**
- Lower latency (< 2 seconds vs 5-10 seconds for synchronous)
- More efficient (persistent gRPC connection)
- Better for real-time monitoring use case

**Implementation:**
- Use `subscription.Receive(ctx, callback)` from Go Pub/Sub client
- Handle context cancellation for graceful stop
- Use goroutines for concurrent message processing

### Message Ordering

**Display Order:** Newest-first (most recent messages at top)

**Rationale:**
- Users typically want to see latest messages first
- Matches common chat/messaging UI patterns
- Virtual scrolling works well with this order

### JSON Detection & Formatting

**Detection:**
- Try `JSON.parse()` on payload
- If successful and result is object/array → treat as JSON
- Otherwise → treat as plain text

**Formatting:**
- Use library like `react-json-view` or `react-syntax-highlighter`
- Pretty-print with indentation
- Collapse large objects by default

### Virtual Scrolling Configuration

**Recommended Settings:**
- **Item Height:** Fixed height (e.g., 200px collapsed, 400px expanded) OR dynamic
- **Overscan:** 5-10 items (render extra items above/below viewport)
- **Window Size:** Full height of message list container

**Library Options:**
- `react-window` - Lightweight, fixed item heights
- `@tanstack/react-virtual` - More features, dynamic heights

### Error Handling

**Transient Errors:**
- Network timeouts → Retry with exponential backoff
- gRPC errors → Log and emit `monitor:error` event
- Auto-reconnect if connection lost

**Permanent Errors:**
- Invalid subscription → Show error, stop monitoring
- Permission denied → Show user-friendly error message
- Subscription not found → Show error, stop monitoring

### Memory Management

**Buffer Limits:**
- Default: 500 messages
- Configurable via `AppConfig.MessageBufferSize`
- Enforced strictly (oldest removed when limit reached)

**Memory Considerations:**
- Each message: ~1-5KB (payload + metadata)
- 500 messages: ~500KB - 2.5MB
- Virtual scrolling keeps DOM small (only visible items)

### Thread Safety

**Backend:**
- `MessageBuffer` uses `sync.RWMutex` for thread-safe access
- Multiple goroutines can read concurrently
- Single writer (message callback) for adds

**Frontend:**
- React state updates are batched
- `useState` updates are thread-safe (single-threaded JS)
- Event handlers update state atomically

---

## Testing Checklist

### Unit Tests

- [ ] Message buffer FIFO logic (add, remove oldest when full)
- [ ] Message buffer thread safety (concurrent reads/writes)
- [ ] Message decoding (base64 → string)
- [ ] Auto-ack logic (ack vs no-ack)
- [ ] Search filtering (payload + attributes)

### Integration Tests

- [ ] Start monitor → receive messages → stop monitor
- [ ] Buffer size limit enforcement
- [ ] Auto-ack toggle updates behavior
- [ ] Clear buffer removes all messages
- [ ] Search filters messages correctly

### Manual Testing

- [ ] Start monitoring, publish message, verify appears in < 2 seconds
- [ ] Fill buffer to 500 messages, verify oldest removed on 501st
- [ ] Toggle auto-ack, verify behavior changes
- [ ] Search for text in payload, verify filtering
- [ ] Search for attribute key/value, verify filtering
- [ ] Copy payload, verify clipboard contains correct data
- [ ] Copy message ID, verify clipboard contains correct data
- [ ] Clear buffer, verify all messages removed
- [ ] Stop monitoring, verify no new messages received
- [ ] Test with 500+ messages, verify UI remains responsive
- [ ] Test JSON payload formatting and syntax highlighting
- [ ] Test with non-JSON payload (plain text)
- [ ] Test error handling (invalid subscription, permission denied)

### Performance Testing

- [ ] Measure message receive latency (< 2 seconds)
- [ ] Measure search performance with 500 messages (< 100ms)
- [ ] Measure UI render time with 500 messages
- [ ] Monitor memory usage with 500 messages (< 500MB)

---

## Dependencies

### Backend Dependencies
- `cloud.google.com/go/pubsub` - Already included
- Standard library: `context`, `sync`, `encoding/base64`, `time`

### Frontend Dependencies
- React 18 - Already included
- TypeScript - Already included
- Virtual scrolling library:
  - `react-window` OR `@tanstack/react-virtual`
- JSON formatting (optional):
  - `react-json-view` OR `react-syntax-highlighter`
- Tailwind CSS - Already included

---

## Future Enhancements (Post-MVP)

1. **Manual Ack/Nack**
   - Per-message ack/nack buttons
   - Batch ack/nack operations
   - Show ack status in UI

2. **Pause/Resume Stream**
   - Pause without disconnecting
   - Resume from where paused
   - Useful for inspecting messages without new ones arriving

3. **Message Export**
   - Export buffered messages to JSON file
   - Export filtered (searched) messages
   - Include all message metadata

4. **Attribute Filtering**
   - Filter by attribute key
   - Filter by attribute value
   - Combine multiple filters (AND/OR)

5. **Message Replay**
   - Replay messages from buffer
   - Replay to different topic
   - Useful for testing/debugging

6. **Message Statistics**
   - Message rate (messages/second)
   - Attribute frequency
   - Payload size distribution

7. **Multiple Subscription Monitoring**
   - Monitor multiple subscriptions simultaneously
   - Tabbed interface for each subscription
   - Compare messages across subscriptions

---

## References

- [PRD.md Section 6.3: Subscription Monitor](./PRD.md#63-subscription-monitor-message-viewer)
- [PRD.md Section 9.4: Message](./PRD.md#94-message)
- [Google Cloud Pub/Sub Streaming Pull Documentation](https://cloud.google.com/pubsub/docs/pull#streaming-pull)
- [Go Pub/Sub Client - Receive Messages](https://pkg.go.dev/cloud.google.com/go/pubsub#Subscription.Receive)
- [Wails Events Documentation](https://wails.io/docs/reference/events)

---

**Document Owner:** Development Team
**Last Updated:** 2026-01-04
