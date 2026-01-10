# PRD: Google Cloud Pub/Sub Desktop GUI

**Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Active Development

---

## 1. Executive Summary

### Project Vision

Build the **most intuitive desktop application** for Google Cloud Pub/Sub management, enabling developers and operators to monitor, debug, and interact with Pub/Sub resources efficiently. The application bridges the gap between command-line tools and the GCP Console, providing a streamlined, cross-platform experience.

### Overview

A cross-platform desktop application for **Google Cloud Pub/Sub** that enables developers and operators to monitor, debug, and interact with Pub/Sub resources. Built with **Wails v2** (Go backend) and **React + TypeScript** (frontend), this tool provides a streamlined interface for:

- Browsing and monitoring Topics and Subscriptions
- Real-time message streaming and inspection
- Publishing messages with custom payloads and attributes
- Supporting both production GCP and local Pub/Sub Emulator

### Current Status: MVP Complete + Enhancements

The application has successfully completed its MVP (Minimum Viable Product) milestones and implemented several features beyond the original scope. We are currently in the **Polish & Enhancement** phase.

**✅ Core Features (MVP Complete)**
- Multi-profile connection management (ADC + Service Account JSON)
- GCP Pub/Sub Emulator support with auto-detection
- Topic and subscription browsing with metadata display
- Real-time message monitoring with auto-ack control
- Message publishing with attributes and JSON validation
- Message template management for quick publishing
- Cross-platform support (macOS, Windows, Linux builds via Wails)

**✅ Beyond MVP (Implemented)**
- Full CRUD operations for topics and subscriptions
- Topic monitoring via temporary subscriptions
- Advanced subscription features (dead letter topics, filters, push config viewing)
- **OAuth2 authentication** - Browser-based authentication with personal Google accounts
- **Subscription snapshots** - Create, list, delete, and seek to snapshots
- **Seek to timestamp** - Seek subscriptions to specific timestamps for message replay
- **Structured logging** - Dual-output logging (stdout + JSON files) with logs viewer
- **Upgrade checking** - Automatic version checking with upgrade notifications
- Config file editor with Monaco Editor
- JSON syntax highlighting throughout the app
- Virtual scrolling for large message lists
- Enhanced theme system (5 themes: Auto, Dark, Light, Dracula, Monokai)
- Configurable font sizes (small/medium/large)
- Connection profile switching without restart
- Keyboard shortcuts and command bar

---

## 2. Goals & Success Criteria

### Primary Goals
1. **Fast resource exploration** — Connect and list topics/subscriptions in < 3 seconds
2. **Real-time message monitoring** — Stream subscription messages with < 2 second latency
3. **Reliable message publishing** — Publish messages and confirm delivery with message IDs
4. **Seamless emulator support** — Zero-config switch between GCP and local emulator


---

## 3. Non-Goals (Out of Scope for MVP)

- Multi-broker support (Kafka, RabbitMQ, NATS)
- Schema Registry integration and validation
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

**Note:** For detailed frontend architecture and current structure, see `CLAUDE.md` Architecture section.

The frontend uses React 18 with TypeScript, organized into components, contexts, and hooks. Key components include Sidebar, TopicDetails, SubscriptionMonitor, and MessageCard. See `CLAUDE.md` for the complete current structure.

### 5.4 Communication: Frontend ↔ Backend

**Note:** For complete API reference with accurate method signatures, see `CLAUDE.md` Backend API Reference section.

The application uses Wails v2 bindings for frontend-backend communication:
- **Method Calls**: Frontend calls Go methods exposed via Wails bindings (e.g., `ConnectWithADC`, `ListTopics`, `PublishMessage`, `StartMonitor`)
- **Events**: Backend emits events to frontend for real-time updates (e.g., `message:received`, `resources:updated`, `monitor:error`)

See `CLAUDE.md` for detailed method signatures, event payloads, and communication patterns.

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
- Structured logging system with logs viewer in Settings (filtering, search, date range selection)

**UI Requirements:**
- Status badge in top-right corner (green = connected, red = error, yellow = connecting)
- Toast notifications for critical errors
- Inline error banners for form validation failures
- Logs viewer in Settings dialog with filtering and search capabilities

**Acceptance Criteria:**
- [x] All error states display actionable user-facing messages (no raw API errors)
- [x] Stream monitor retries connection up to 3 times before requiring manual restart
- [x] Logs viewer records all events with timestamps, filtering, and search

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

**Note:** These are simplified data models for requirements documentation. For complete, accurate TypeScript definitions, see `frontend/src/types/index.ts`.

### 9.1 Connection Profile
```typescript
interface ConnectionProfile {
  id: string;              // UUID
  name: string;            // User-defined name
  projectID: string;       // GCP project ID
  authMethod: 'ADC' | 'ServiceAccount' | 'OAuth';
  serviceAccountPath?: string;  // Path to JSON key (if authMethod = ServiceAccount)
  oauthClientPath?: string;     // Path to OAuth client JSON (if authMethod = OAuth)
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
  subscriptionType: 'pull' | 'push';
  pushEndpoint?: string;   // For push subscriptions
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
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
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
    "theme": "auto",  // "auto" | "dark" | "light" | "dracula" | "monokai"
    "fontSize": "medium",  // "small" | "medium" | "large"
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

### Milestone 1: Foundation ✅ **COMPLETE**
**Status:** Complete
**Completed:** Week 1-2

**Deliverables:**
- [x] Wails v2 project scaffolding with React 18 + TypeScript
- [x] Authentication: Application Default Credentials (ADC) + Service Account JSON
- [x] Connection profile management (create, save, switch, delete)
- [x] Basic UI layout: sidebar navigation + main content area

**Acceptance:**
- ✅ User can authenticate and see "Connected to [project]" indicator

---

### Milestone 2: Resource Explorer ✅ **COMPLETE**
**Status:** Complete
**Completed:** Week 3

**Deliverables:**
- [x] List topics with pagination and metadata
- [x] List subscriptions with pagination and metadata
- [x] Display full topic/subscription details (ack deadline, retention, filters, dead letter policy)
- [x] Refresh button for resource list
- [x] Client-side search/filter for topics and subscriptions
- [x] **BONUS:** Create/Delete topics (beyond original MVP scope)
- [x] **BONUS:** Create/Update/Delete subscriptions with full configuration
- [x] **BONUS:** Topic-subscription relationship views

**Acceptance:**
- ✅ User can browse all topics and subscriptions in their project
- ✅ User can create and manage topics/subscriptions (beyond original MVP scope)

---

### Milestone 3: Message Publisher ✅ **COMPLETE**
**Status:** Complete
**Completed:** Week 4

**Deliverables:**
- [x] Publish messages with payload and attributes
- [x] JSON validation and formatting
- [x] Display message ID confirmation after publish
- [x] Message template CRUD (create, save, load, delete)
- [x] Template manager with topic-linked templates
- [x] **BONUS:** Monaco Editor for JSON payload editing with syntax highlighting

**Acceptance:**
- ✅ User can publish a message and receive confirmation message ID
- ✅ Templates can be linked to specific topics or be global

---

### Milestone 4: Subscription Monitor ✅ **COMPLETE**
**Status:** Complete
**Completed:** Week 5-6

**Deliverables:**
- [x] Streaming pull implementation with Go concurrency
- [x] Message list UI with virtual scrolling for performance
- [x] Auto-acknowledge toggle with persistence
- [x] Configurable buffer size limiting (default: 500 messages)
- [x] Real-time search within buffered messages
- [x] Copy payload/message ID buttons
- [x] Clear buffer functionality
- [x] **BONUS:** Topic monitoring via temporary subscriptions

**Acceptance:**
- ✅ User can monitor a subscription and see messages in real-time
- ✅ UI remains responsive with 500 messages
- ✅ Topic monitoring works by creating temporary subscriptions

---

### Milestone 5: Packaging 📋 **NOT STARTED**
**Status:** Not Started
**Target:** TBD

**Planned Deliverables:**
- [ ] GoReleaser configuration for automated cross-platform builds
- [ ] macOS installer (.dmg) with code signing
- [ ] Windows installer (.exe) with optional MSI
- [ ] Linux AppImage with desktop integration
- [ ] GitHub Actions CI/CD pipeline for releases
- [ ] Comprehensive README with installation instructions
- [ ] Application icon and branding assets
- [ ] Auto-update mechanism (Sparkle for macOS, Squirrel for Windows)

**Why This Matters:**
Currently, users must build from source using `wails build`. Packaging will enable one-click installation and automatic updates.

**Acceptance:**
- Application can be installed and run on all three platforms

---

### Milestone 6: Polish ✅ **MOSTLY COMPLETE**
**Status:** 90% Complete
**Current Focus:** Final polish items

**Completed:**
- [x] Error handling and user-facing messages
- [x] Dark mode support (light/dark/auto theme modes)
- [x] System theme preference detection
- [x] Config file editor dialog
- [x] **Enhanced theme system** (5 themes: Auto, Dark, Light, Dracula, Monokai)
- [x] **Configurable font sizes** (small/medium/large)
- [x] **Monaco Editor theme matching**
- [x] Keyboard shortcuts (Cmd/Ctrl+R refresh, Cmd/Ctrl+P publish, etc.)
- [x] Command bar for quick actions
- [x] **Structured logging system** with logs viewer
- [x] **Upgrade checking** with automatic notifications

**Remaining:**
- [ ] Template variables/placeholders ({{timestamp}}, {{uuid}}, {{random}})
- [ ] Application icon and branding finalization
- [ ] User onboarding tooltips/walkthrough
- [ ] Performance profiling and optimization

**Next Up:**
Template variables support and final branding.

**Acceptance:**
- ✅ Core user flows work end-to-end
- ✅ Enhanced theme system with 5 presets and font size control complete
- ✅ Keyboard shortcuts and command bar implemented
- ✅ Logging and upgrade systems operational
- ⏳ Remaining: template variables, branding, onboarding

---

## 13. Features Beyond MVP Scope (Implemented)

The following features have been implemented beyond the original MVP requirements. See **Section 12: Implementation Roadmap** for detailed milestone information.

**Summary:**
- **Topic/Subscription CRUD Operations** - Full create, update, delete support (see Milestone 2)
- **Topic Monitoring** - Direct topic monitoring via temporary subscriptions (see Milestone 4)
- **Advanced Subscription Features** - Dead letter topics, filters, push subscription viewing (see Milestone 2)
- **OAuth2 Authentication** - Browser-based authentication with personal Google accounts (see Milestone 1)
- **Subscription Snapshots** - Create, list, delete, and seek to snapshots for message replay (see Priority 3)
- **Seek to Timestamp** - Seek subscriptions to specific timestamps for message replay (see Priority 3)
- **Structured Logging** - Dual-output logging with logs viewer, filtering, and search (see Milestone 6)
- **Upgrade Checking** - Automatic version checking with upgrade notifications (see Milestone 6)
- **Enhanced UI Features** - Config editor, JSON syntax highlighting, virtual scrolling, template manager (see Milestones 3-4)
- **Configuration Management** - Enhanced theme system (5 themes), font sizes, auto-ack, buffer size (see Milestone 6)

---

## 14. Open Questions & Decisions

### Resolved Decisions
| Question | Decision | Rationale |
|----------|----------|-----------|
| Auto-ack default behavior? | **Yes, auto-ack ON by default** | Prevents accidental redelivery storms; advanced users can toggle off |
| CRUD for topics/subs in MVP? | **No, read-only** (originally) | Reduces scope; users can use `gcloud` or console for admin tasks. **Note:** Full CRUD implemented beyond MVP scope |
| Multiple projects simultaneously? | **No, one at a time** | Simplifies UI; can add workspace tabs in v2 if needed |

### Pending Questions
1. **Ordering key support:** Should we show ordering key input by default, or hide behind "Advanced" toggle?
   - **Recommendation:** Hide by default; most users don't use ordering keys

2. **Exactly-once delivery indicators:** Show ack status if exactly-once enabled?
   - **Recommendation:** Defer to post-MVP; requires additional API calls

3. **Export format:** JSON only, or support CSV/YAML?
   - **Recommendation:** JSON only for MVP (native format)

---

## 15. Roadmap (Prioritized)

### Priority 1: Theme System & Polish
**Status:** Mostly Complete (90%)
**Goal:** Complete Milestone 6 (Polish)

**Completed:**
- ✅ Theme system foundation (light/dark/auto)
- ✅ Enhanced theme system with Dracula and Monokai presets
- ✅ Configurable font sizes independent of theme
- ✅ Monaco Editor theme matching
- ✅ Keyboard shortcuts and command bar
- ✅ Structured logging system with logs viewer
- ✅ Upgrade checking with automatic notifications

**Remaining:**
- ⏳ Template variables ({{timestamp}}, {{uuid}}, etc.)
- ⏳ Application icon and branding finalization
- ⏳ User onboarding tooltips/walkthrough

---

### Priority 2: Packaging & Distribution
**Status:** Not Started
**Goal:** Complete Milestone 5 (Packaging)

**Deliverables:**
- GoReleaser setup for all platforms
- GitHub Actions CI/CD pipeline
- macOS code signing and notarization
- Windows code signing
- Auto-update mechanism
- Public beta release

---

### Priority 3: Advanced Replay Tools
**Status:** Partially Complete (40%)
**Goal:** Enable power users to debug complex message flows

**Completed:**
- ✅ Subscription snapshots (create, list, seek to snapshot)
- ✅ Seek to timestamp functionality

**Remaining:**
- Dead-letter queue viewer with message re-drive capability
- Message history export (JSON, CSV formats)
- Bulk message republish

**Use Cases:**
- ✅ Replay messages from a specific point in time (via snapshots and seek)
- Debug dead-letter queue issues
- Export messages for compliance/auditing

---

### Priority 4: Performance Testing Tools
**Status:** Not Started
**Goal:** Support load testing and performance benchmarking

**Features:**
- Bulk publish mode (configurable messages/second)
- Message payload generator with templates
- Latency monitoring (publish → receive time)
- Throughput visualization (messages/sec graph)
- Publisher/subscriber performance metrics

**Use Cases:**
- Load test topics before production rollout
- Benchmark subscription throughput
- Generate realistic test data

---

### Priority 5: Multi-Project Workspaces
**Status:** Not Started
**Goal:** Enable users to work with multiple projects simultaneously

**Features:**
- Tabbed interface for multiple GCP projects
- Side-by-side topic/subscription comparison (dev vs prod)
- Cross-project resource search
- Workspace save/restore (persist open tabs)
- Project environment labels (dev, staging, production)

**Use Cases:**
- Compare topic configurations across environments
- Monitor messages in dev and prod simultaneously
- Quickly switch between client projects

---

### Priority 6: Schema Registry Integration
**Status:** Not Started
**Goal:** Integrate with Pub/Sub Schema Registry

**Features:**
- List and view schemas for topics
- Validate message payloads against schemas (Avro, Protocol Buffers, JSON)
- Auto-complete for schema fields in message composer
- Schema version management
- Generate message templates from schemas

**Use Cases:**
- Ensure published messages conform to schemas
- Discover schema requirements for topics
- Reduce invalid message publishing errors

---

## 16. Future Enhancements (Post-MVP)

**Note:** See **Section 15: Roadmap** for prioritized list of planned features.

### Long-Term Vision

#### Multi-Broker Support
Extend the application to support additional message brokers:
- RabbitMQ adapter
- Apache Kafka adapter
- AWS SNS/SQS adapter
- Pluggable architecture for custom brokers

**Why:** Many organizations use multiple message brokers. A unified UI would reduce tool fragmentation.

#### Cloud Monitoring Integration
- Display message rate graphs from Cloud Monitoring
- Alert when subscription backlog exceeds threshold
- View subscription metrics (oldest unacked message age, etc.)
- Export monitoring data for custom dashboards

#### Plugin System
- User-defined message validators (e.g., custom JSON schema validation)
- Custom message transformers (e.g., encrypt/decrypt payloads)
- Integration with internal tools via webhook plugins

#### Team Collaboration
- Share connection profiles across team (read-only credentials)
- Message annotation system (tag messages with notes)
- Export annotated message flows for bug reports

---

## 17. Known Limitations & Technical Debt

### Current Limitations
1. **Push subscriptions:** View-only support (cannot monitor push subscriptions)
2. **Exactly-once delivery:** No indication of ack status for exactly-once subscriptions
3. **Large payloads:** Messages > 10MB may cause UI slowdown
4. **No offline mode:** Requires active GCP connection
5. **Single project at a time:** Cannot monitor multiple projects simultaneously
6. **No message search by ID:** Search only works on payload/attributes, not message ID

### Technical Debt
1. **Component refactoring:** 200+ hardcoded Tailwind color classes should be migrated to semantic tokens
2. **Type generation:** Go structs should auto-generate TypeScript types (currently manual)
3. **Test coverage:** Limited unit tests for backend Go code
4. **E2E testing:** No automated end-to-end tests (manual testing only)
5. **Error recovery:** Some edge cases (e.g., mid-stream network loss) need better handling
6. **Accessibility:** Keyboard navigation incomplete, screen reader support untested

**Debt Paydown Plan:**
- Semantic theme token migration (addresses #1)
- Add E2E tests with Playwright (addresses #4)
- Improve accessibility compliance (addresses #6)

---

## 18. Versioning Strategy

### Version Numbering
Following [Semantic Versioning](https://semver.org/):
- **Major (X.0.0):** Breaking changes (e.g., new config file format)
- **Minor (0.X.0):** New features (backward compatible)
- **Patch (0.0.X):** Bug fixes and minor improvements

---

## 19. Community & Contributions

### Open Source Strategy
This project is currently in private development. Future plans:
- Open source under MIT license after Milestone 6 completion
- Accept community contributions (features, bug fixes, themes)
- Maintain public roadmap and feature voting

### How to Contribute (Future)
Once open-sourced:
1. Report bugs via GitHub Issues
2. Suggest features via Discussions
3. Submit pull requests for features marked "help wanted"
4. Share custom themes via community repository
5. Improve documentation and translations

---

## 20. References

- [Google Cloud Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Wails Framework Docs](https://wails.io/docs/introduction)
- [Go Pub/Sub Client Library](https://pkg.go.dev/cloud.google.com/go/pubsub)
- [Similar Tool: pubsubui](https://github.com/iansmith/pubsubui)
- [Pub/Sub Emulator](https://cloud.google.com/pubsub/docs/emulator)


**Change Log:**
- 2026-01-04: Initial draft (v1.0)
- 2026-01-04: Updated milestone status - Milestones 1-3 marked as complete
- 2026-01-XX: Updated milestone status - Milestone 4 (Subscription Monitor) marked as complete, Milestone 6 partially complete
- 2026-01-06: Merged ROADMAP.md content into PRD.md - Added roadmap sections, known limitations, versioning strategy, and community information
- 2026-01-06: Updated Milestone 6 status - Enhanced theme system (5 themes), configurable font sizes, and Monaco Editor theme matching marked as complete
- 2026-01-06: Removed success metrics section and date-specific timelines - Restructured roadmap to focus on sequential priorities
- 2026-01-10: Updated project status - Added OAuth2 authentication, snapshots, seek to timestamp, structured logging, and upgrade checking to implemented features. Updated Milestone 6 to 90% complete. Updated Priority 3 (Advanced Replay Tools) to reflect completed snapshot and seek functionality.