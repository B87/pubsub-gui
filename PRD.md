# PRD: Google Cloud Pub/Sub Desktop GUI

**Version:** 1.0
**Last Updated:** 2026-01-04
**Status:** Draft

---

## 1. Executive Summary

A cross-platform desktop application for **Google Cloud Pub/Sub** that enables developers and operators to monitor, debug, and interact with Pub/Sub resources. Built with **Wails v2** (Go backend) and **React + TypeScript** (frontend), this tool provides a streamlined interface for:

- Browsing and monitoring Topics and Subscriptions
- Real-time message streaming and inspection
- Publishing messages with custom payloads and attributes
- Supporting both production GCP and local Pub/Sub Emulator

---

## 2. Goals & Success Criteria

### Primary Goals
1. **Fast resource exploration** — Connect and list topics/subscriptions in < 3 seconds
2. **Real-time message monitoring** — Stream subscription messages with < 2 second latency
3. **Reliable message publishing** — Publish messages and confirm delivery with message IDs
4. **Seamless emulator support** — Zero-config switch between GCP and local emulator

### Success Metrics (MVP)
- User can authenticate and view project resources within 5 seconds
- Message stream displays incoming messages in real-time without UI freezing
- 100% of published messages show confirmation with message ID
- Application runs on macOS, Windows, and Linux without platform-specific bugs

---

## 3. Non-Goals (Out of Scope for MVP)

- Multi-broker support (Kafka, RabbitMQ, NATS)
- ~~Full CRUD operations for topics/subscriptions (create/delete) — read-only focus~~ **Note:** Implemented beyond MVP scope
- Schema Registry integration and validation
- Advanced replay tooling (snapshots, seek operations)
- ~~Push subscription configuration~~ **Note:** View-only support implemented
- IAM role management
- Cloud monitoring/metrics integration
- Custom plugin system

---

## 4. Target Users

| User Persona | Use Case | Key Needs |
|-------------|----------|-----------|
| **Backend Developer** | Local development with emulator | Quick setup, message inspection, publishing test data |
| **DevOps Engineer** | Production debugging | Multi-project support, message filtering, export capability |
| **QA/Support** | Verifying message delivery | Easy authentication, read-only safety, clear error messages |

---

## 5. Technical Architecture

### 5.1 Technology Stack

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Desktop Framework** | Wails v2 | Native window + Go/React integration, cross-platform |
| **Backend** | Go 1.21+ | Official Pub/Sub SDK, excellent concurrency for streaming |
| **Frontend** | React 18 + TypeScript | Component reusability, strong typing |
| **UI Library** | Radix UI + Tailwind CSS | Accessible components, rapid styling |
| **State Management** | React Context + hooks | Sufficient for MVP complexity |
| **Code Editor** | Monaco Editor (optional) | JSON payload editing with syntax highlighting |

### 5.2 Backend Architecture (Go)

```
internal/
├── app/              # Wails app initialization and bindings
├── auth/             # GCP authentication (ADC + JSON key)
├── config/           # Local configuration persistence
├── pubsub/
│   ├── admin/        # List topics/subscriptions, fetch metadata
│   ├── publisher/    # Publish messages with attributes
│   └── subscriber/   # Streaming pull with backpressure control
└── models/           # Shared data structures
```

**Key Go Packages:**
- `cloud.google.com/go/pubsub` — Official Google Cloud Pub/Sub client
- `github.com/wailsapp/wails/v2` — Desktop app framework
- `google.golang.org/api/option` — Auth configuration

### 5.3 Frontend Architecture (React)

```
frontend/src/
├── components/
│   ├── Sidebar/          # Project selector + resource tree
│   ├── TopicDetails/     # Topic metadata + publish form
│   ├── SubscriptionMonitor/  # Message stream viewer
│   └── MessageCard/      # Individual message display
├── contexts/
│   ├── AuthContext.tsx   # Authentication state
│   └── PubSubContext.tsx # Active project/resources
├── hooks/
│   └── useMessageStream.ts  # WebSocket-like message handling
└── App.tsx
```

### 5.4 Communication: Frontend ↔ Backend

**Wails Method Calls** (Frontend → Backend):
```go
// Auth
ConnectWithADC(projectID string) error
ConnectWithServiceAccount(projectID, keyPath string) error

// Resource listing
ListTopics(pageToken string) ([]Topic, string, error)
ListSubscriptions(pageToken string) ([]Subscription, string, error)

// Publishing
PublishMessage(topicID string, payload []byte, attrs map[string]string) (string, error)

// Monitoring
StartMonitor(subscriptionID string, maxMessages int) error
StopMonitor(subscriptionID string) error
```

**Wails Events** (Backend → Frontend):
```go
// Message streaming
runtime.EventsEmit(ctx, "message:received", message)

// Status updates
runtime.EventsEmit(ctx, "connection:status", status)
runtime.EventsEmit(ctx, "monitor:error", error)
```

---

## 6. Feature Requirements

### 6.1 Authentication & Connection Management

**Functional Requirements:**
- Support Application Default Credentials (ADC) as default auth method
- Support Service Account JSON key file upload
- Store connection profiles locally (name, auth method, project ID, emulator host)
- Switch between profiles without app restart
- Detect and respect `PUBSUB_EMULATOR_HOST` environment variable

**UI Requirements:**
- Connection dialog on first launch
- Dropdown selector for saved profiles in sidebar header
- Visual indicator showing: connected project, auth method, emulator mode

**Acceptance Criteria:**
- [ ] User can authenticate with ADC in < 5 seconds
- [ ] User can import and use a service account JSON file
- [ ] Profiles persist across app restarts
- [ ] Switching profiles re-lists resources correctly
- [ ] Emulator connection shows distinct visual indicator

---

### 6.2 Resource Explorer (Topics & Subscriptions)

**Functional Requirements:**
- List all topics in selected project with pagination
- List all subscriptions in selected project with pagination
- Display metadata:
  - **Topic:** name, message retention duration (if available)
  - **Subscription:** name, linked topic, ack deadline, message retention, filter expression, dead-letter topic
- Refresh button to reload resources
- Search/filter topics and subscriptions by name

**UI Requirements:**
- Left sidebar with collapsible "Topics" and "Subscriptions" sections
- Click topic/subscription to view details in main area
- Loading states during API calls
- Empty states when no resources exist

**Acceptance Criteria:**
- [ ] Topics and subscriptions load within 3 seconds for typical projects (<100 resources)
- [ ] Pagination handles projects with >100 topics/subscriptions
- [ ] Search filters list in real-time (client-side filtering)
- [ ] Metadata displayed accurately matches GCP console

---

### 6.3 Subscription Monitor (Message Viewer)

**Functional Requirements:**
- Start/stop streaming pull for selected subscription
- Display messages with:
  - Received timestamp (local time)
  - Message ID
  - Attributes (key-value pairs)
  - Payload (auto-detect JSON for pretty printing, otherwise raw text)
  - Delivery attempt count (if available)
- Buffer management:
  - Keep last N messages in memory (default: 500, configurable via settings)
  - Oldest messages removed when buffer full (FIFO)
- Message controls:
  - "Clear buffer" button
  - "Copy payload" per message
  - "Copy message ID" per message
  - Search within buffered messages (payload + attributes)
- Auto-acknowledge messages by default to prevent redelivery loops

**Advanced (Optional for MVP):**
- Manual ack/nack buttons per message with toggle to disable auto-ack
- Pause/resume stream (without disconnecting)
- Export messages to JSON file
- Filter by attribute key/value

**UI Requirements:**
- Message list with virtual scrolling for performance
- Collapsible message cards showing summary + expandable full payload
- JSON syntax highlighting for detected JSON payloads
- Loading indicator while connecting to subscription
- Error banner if stream disconnects

**Acceptance Criteria:**
- [ ] Messages appear in UI within 2 seconds of publish time
- [ ] UI remains responsive with 500 messages in buffer
- [ ] Buffer correctly limits to configured size
- [ ] Search filters messages instantly (< 100ms)
- [ ] Stream recovers automatically from transient network errors

---

### 6.4 Topic Publisher (Message Composer)

**Functional Requirements:**
- Publish messages to selected topic with:
  - Payload (text input, treated as string or JSON)
  - Attributes (dynamic key-value pairs)
  - Ordering key (optional, hidden by default)
- Validate JSON if user indicates payload is JSON
- Display publish result:
  - Success: message ID(s) and publish timestamp
  - Failure: detailed error message
- Save message templates locally:
  - Name template (e.g., "User signup event")
  - Store payload + attributes
  - Quick-load template into publisher

**UI Requirements:**
- Tabbed interface: "Publish" tab appears when topic selected
- Text area for payload (minimum 10 lines, resizable)
- Attributes table with add/remove row buttons
- "Send" button with loading state
- Result notification (toast or inline banner)
- Template dropdown above payload area

**Acceptance Criteria:**
- [ ] Published messages appear in linked subscription within 2 seconds
- [ ] Message ID returned matches message received in subscription monitor
- [ ] JSON validation errors shown before publish attempt
- [ ] Templates persist across app restarts
- [ ] Publish handles 10KB+ payloads without freezing UI

---

### 6.5 Error Handling & Status Feedback

**Functional Requirements:**
- Global connection status indicator (connected, disconnected, error)
- Contextual error messages for common issues:
  - `PERMISSION_DENIED` → "Missing IAM permission: [role needed]"
  - `NOT_FOUND` → "Topic/Subscription not found. It may have been deleted."
  - `UNAUTHENTICATED` → "Authentication failed. Check credentials."
  - Network errors → "Connection lost. Retrying..."
- Automatic retry with exponential backoff for transient errors
- Optional log panel showing last 200 events (connections, publishes, errors)

**UI Requirements:**
- Status badge in top-right corner (green = connected, red = error, yellow = connecting)
- Toast notifications for critical errors
- Inline error banners for form validation failures
- Optional debug log panel (toggle via menu)

**Acceptance Criteria:**
- [ ] All error states display actionable user-facing messages (no raw API errors)
- [ ] Stream monitor retries connection up to 3 times before requiring manual restart
- [ ] Log panel records all publish attempts with timestamps

---

## 7. Non-Functional Requirements

### 7.1 Performance
- **Resource listing:** < 3 seconds for projects with <100 topics/subscriptions
- **Message streaming latency:** < 2 seconds from publish to UI display
- **UI responsiveness:** No blocking operations; all API calls async
- **Memory usage:** < 500MB with 500 messages buffered

### 7.2 Reliability
- Graceful handling of network interruptions with auto-reconnect
- No data loss: buffered messages persist during view switches (until user clears)
- Crash recovery: save active profile and reopen on restart

### 7.3 Security
- No credential uploading to external servers (local-only storage)
- Service account keys stored with OS-level file permissions (readable only by user)
- No telemetry or analytics without explicit opt-in

### 7.4 Usability
- Keyboard shortcuts for common actions (Cmd/Ctrl+R refresh, Cmd/Ctrl+P publish)
- Responsive layout that works on 1280x720 minimum resolution
- Dark mode support (respect OS theme preference)

### 7.5 Cross-Platform
- Build targets: macOS (Intel + Apple Silicon), Windows 10+, Linux (Ubuntu 20.04+)
- Single codebase for all platforms (Wails handles platform differences)
- Installers: `.dmg` (macOS), `.exe` installer (Windows), `.AppImage` (Linux)

---

## 8. User Experience Flows

### 8.1 First-Time Setup Flow
1. Launch application
2. Welcome screen with "Connect to GCP" button
3. Choose auth method: ADC or Service Account JSON
4. Enter project ID (or auto-detect from ADC)
5. Test connection (list topics as validation)
6. Success → Save profile → Show resource explorer

### 8.2 Monitor Subscription Flow
1. Click subscription in sidebar
2. Main area shows subscription details panel
3. Click "Start Monitoring" button
4. Messages stream into message list (auto-ack enabled by default)
5. Use search to filter messages
6. Click "Stop Monitoring" when done

### 8.3 Publish Message Flow
1. Click topic in sidebar
2. Main area shows topic details + "Publish" tab
3. Enter payload in text area
4. Add attributes (optional)
5. Click "Send"
6. See confirmation toast with message ID
7. (Optional) Switch to linked subscription monitor to verify message received

---

## 9. Data Models

### 9.1 Connection Profile
```typescript
interface ConnectionProfile {
  id: string;              // UUID
  name: string;            // User-defined name
  projectID: string;       // GCP project ID
  authMethod: 'ADC' | 'ServiceAccount';
  serviceAccountPath?: string;  // Path to JSON key (if authMethod = ServiceAccount)
  emulatorHost?: string;   // e.g., "localhost:8085"
  isDefault: boolean;      // Auto-connect on launch
}
```

### 9.2 Topic
```typescript
interface Topic {
  name: string;            // e.g., "projects/my-project/topics/my-topic"
  displayName: string;     // e.g., "my-topic"
  messageRetention?: string;  // Duration string, e.g., "7d"
}
```

### 9.3 Subscription
```typescript
interface Subscription {
  name: string;            // Full resource name
  displayName: string;     // Short name
  topic: string;           // Parent topic name
  ackDeadline: number;     // Seconds
  retentionDuration: string;
  filter?: string;         // Filter expression
  deadLetterPolicy?: {
    deadLetterTopic: string;
    maxDeliveryAttempts: number;
  };
}
```

### 9.4 Message
```typescript
interface PubSubMessage {
  id: string;              // Message ID from Pub/Sub
  publishTime: string;     // ISO 8601 timestamp
  receiveTime: string;     // Local receive time
  data: string;            // Base64-decoded payload
  attributes: Record<string, string>;
  deliveryAttempt?: number;
  orderingKey?: string;
}
```

### 9.5 Message Template
```typescript
interface MessageTemplate {
  id: string;
  name: string;
  topicID?: string;        // Optional: link to specific topic
  payload: string;
  attributes: Record<string, string>;
}
```

---

## 10. Configuration & Settings

### 10.1 Application Settings
Stored in local config file (`~/.pubsub-gui/config.json`):

```json
{
  "profiles": [ /* array of ConnectionProfile */ ],
  "settings": {
    "messageBufferSize": 500,
    "autoAck": true,
    "theme": "auto",  // "light" | "dark" | "auto"
    "defaultProfile": "profile-uuid"
  },
  "templates": [ /* array of MessageTemplate */ ]
}
```

### 10.2 Environment Variables
- `PUBSUB_EMULATOR_HOST` — Auto-detected for emulator mode
- `GOOGLE_APPLICATION_CREDENTIALS` — Used by ADC

---

## 11. Minimum IAM Permissions

Document in README the required GCP IAM roles:

| Action | Required Role | Permission |
|--------|--------------|------------|
| List topics | `roles/pubsub.viewer` | `pubsub.topics.list` |
| List subscriptions | `roles/pubsub.viewer` | `pubsub.subscriptions.list` |
| Publish messages | `roles/pubsub.publisher` | `pubsub.topics.publish` |
| Pull messages | `roles/pubsub.subscriber` | `pubsub.subscriptions.consume` |

Recommended combined role for full GUI access: `roles/pubsub.editor` (for dev environments)

---

## 12. Implementation Roadmap

### Milestone 1: Foundation (Week 1-2) ✅ **COMPLETE**
**Deliverables:**
- [x] Wails project scaffolding with React + TypeScript
- [x] Authentication: ADC + Service Account JSON
- [x] Connection profile management (CRUD)
- [x] Basic UI layout: sidebar + main area

**Acceptance:**
- ✅ User can authenticate and see "Connected to [project]" indicator

---

### Milestone 2: Resource Explorer (Week 3) ✅ **COMPLETE**
**Deliverables:**
- [x] List topics with pagination
- [x] List subscriptions with pagination
- [x] Display topic/subscription metadata in detail panel
- [x] Refresh button
- [x] Client-side search/filter
- [x] **BONUS:** Create/Delete topics (beyond MVP scope)
- [x] **BONUS:** Create/Update/Delete subscriptions (beyond MVP scope)
- [x] **BONUS:** Advanced subscription metadata (dead letter policy, push endpoints, filters)
- [x] **BONUS:** Topic-subscription relationship views (subscriptions for topic, dead letter relationships)

**Acceptance:**
- ✅ User can browse all topics and subscriptions in their project
- ✅ User can create and manage topics/subscriptions (beyond original MVP scope)

---

### Milestone 3: Message Publisher (Week 4) ✅ **COMPLETE**
**Deliverables:**
- [x] Publish form (payload + attributes)
- [x] JSON validation
- [x] Publish result display (message ID)
- [x] Message template CRUD
- [x] Template quick-load
- [x] **BONUS:** JSON editor with syntax highlighting
- [x] **BONUS:** Template manager with topic-linked templates

**Acceptance:**
- ✅ User can publish a message and receive confirmation message ID
- ✅ Templates can be linked to specific topics or be global

---

### Milestone 4: Subscription Monitor (Week 5-6) ✅ **COMPLETE**
**Deliverables:**
- [x] Streaming pull implementation (Go backend)
- [x] Message list UI with virtual scrolling
- [x] Auto-ack toggle
- [x] Buffer size limiting
- [x] Search within messages
- [x] Copy payload/ID buttons
- [x] Clear buffer button
- [x] **BONUS:** Topic monitoring (creates temporary subscriptions for topics without existing subscriptions)

**Acceptance:**
- ✅ User can monitor a subscription and see messages in real-time
- ✅ UI remains responsive with 500 messages
- ✅ Topic monitoring works by creating temporary subscriptions

---

### Milestone 5: Packaging (Week 7) 📋 **NOT STARTED**
**Deliverables:**
- [ ] Goreleaser configuration for cross-platform builds
- [ ] Installation packages (.dmg, .exe, .AppImage) via goreleaser
- [ ] README with setup instructions

**Acceptance:**
- Application can be installed and run on all three platforms

---

### Milestone 6: Polish (Week 8) ⏳ **PARTIALLY COMPLETE**
**Deliverables:**
- [x] Error handling and user-facing messages (basic implementation)
- [ ] Keyboard shortcuts & command bar
- [x] Dark mode (theme support with light/dark/auto modes)
- [ ] Application icon and branding (needs verification)
- [ ] Add template variables/placeholders ({{timestamp}}, {{uuid}}, {{date}})

**Acceptance:**
- ✅ Core user flows work end-to-end
- ⏳ Some polish features remain (keyboard shortcuts, template variables)

---

## 13. Features Beyond MVP Scope (Implemented)

The following features have been implemented beyond the original MVP requirements:

1. **Topic/Subscription CRUD Operations**
   - Create topics with message retention duration
   - Delete topics
   - Create subscriptions with full configuration (ack deadline, retention, filters, dead letter policy, push endpoints)
   - Update subscription configurations
   - Delete subscriptions

2. **Topic Monitoring**
   - Monitor topics directly by creating temporary subscriptions
   - Automatic cleanup of temporary subscriptions
   - Reuse existing monitoring subscriptions when available

3. **Advanced Subscription Features**
   - Dead letter topic configuration and viewing
   - Push subscription support (view-only, monitoring not supported)
   - Filter expression display and editing
   - Subscription type detection (pull vs push)

4. **Enhanced UI Features**
   - Config file editor dialog for advanced users
   - JSON editor with syntax highlighting for message payloads
   - Template manager with topic-linked templates
   - Virtual scrolling for large message lists
   - Real-time message search with debouncing

5. **Configuration Management**
   - Configurable message buffer size
   - Auto-ack toggle with persistence
   - Theme support (light/dark/auto) with system preference detection
   - Active profile persistence across app restarts

---

## 14. Open Questions & Decisions

### Resolved Decisions
| Question | Decision | Rationale |
|----------|----------|-----------|
| Auto-ack default behavior? | **Yes, auto-ack ON by default** | Prevents accidental redelivery storms; advanced users can toggle off |
| CRUD for topics/subs in MVP? | **No, read-only** | Reduces scope; users can use `gcloud` or console for admin tasks |
| Multiple projects simultaneously? | **No, one at a time** | Simplifies UI; can add workspace tabs in v2 if needed |

### Pending Questions
1. **Ordering key support:** Should we show ordering key input by default, or hide behind "Advanced" toggle?
   - **Recommendation:** Hide by default; most users don't use ordering keys

2. **Exactly-once delivery indicators:** Show ack status if exactly-once enabled?
   - **Recommendation:** Defer to post-MVP; requires additional API calls

3. **Export format:** JSON only, or support CSV/YAML?
   - **Recommendation:** JSON only for MVP (native format)

---

## 15. Success Metrics (Post-Launch)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first successful publish | < 2 minutes | User testing |
| Message stream latency | < 2 seconds | Automated testing |
| Crash rate | < 1% of sessions | Error logging (opt-in) |
| User retention (weekly active users) | 60% after 30 days | Analytics (opt-in) |

---

## 16. Future Enhancements (Post-MVP)

Potential features for v2.0+:

1. **Advanced Replay Tools**
   - Create snapshots
   - Seek subscription to timestamp/snapshot
   - Dead-letter queue viewer with re-drive

2. **Multi-Project Workspaces**
   - Tabbed interface for multiple projects
   - Compare topics/subs across environments (dev/stage/prod)

3. **Schema Registry Integration**
   - Validate payloads against Pub/Sub schemas
   - Auto-complete for schema fields

4. **Performance Testing**
   - Bulk publish (N messages/sec)
   - Payload generator with templates

5. **Export/Import**
   - Export messages to JSON/CSV
   - Import/replay message sets

6. **Multi-Broker Support**
   - RabbitMQ adapter
   - Kafka adapter
   - Pluggable architecture

---

## 17. References

- [Google Cloud Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Wails Framework Docs](https://wails.io/docs/introduction)
- [Go Pub/Sub Client Library](https://pkg.go.dev/cloud.google.com/go/pubsub)
- [Similar Tool: pubsubui](https://github.com/iansmith/pubsubui)
- [Pub/Sub Emulator](https://cloud.google.com/pubsub/docs/emulator)

---

**Document Ownership:**
- **Author:** [Your Name]
- **Stakeholders:** Development team
- **Review Cycle:** Weekly during implementation

**Change Log:**
- 2026-01-04: Initial draft (v1.0)
- 2026-01-04: Updated milestone status - Milestones 1-3 marked as complete
- 2026-01-XX: Updated milestone status - Milestone 4 (Subscription Monitor) marked as complete, Milestone 6 partially complete