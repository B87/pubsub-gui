# Pub/Sub GUI - Project Roadmap

**Last Updated:** 2026-01-04
**Version:** 1.1.0

---

## Project Vision

Build the **most intuitive desktop application** for Google Cloud Pub/Sub management, enabling developers and operators to monitor, debug, and interact with Pub/Sub resources efficiently. The application bridges the gap between command-line tools and the GCP Console, providing a streamlined, cross-platform experience.

---

## Current Status: MVP Complete + Enhancements

The application has successfully completed its MVP (Minimum Viable Product) milestones and implemented several features beyond the original scope. We are currently in the **Polish & Enhancement** phase.

### What's Working Today

✅ **Core Features (MVP Complete)**
- Multi-profile connection management (ADC + Service Account JSON)
- GCP Pub/Sub Emulator support with auto-detection
- Topic and subscription browsing with metadata display
- Real-time message monitoring with auto-ack control
- Message publishing with attributes and JSON validation
- Message template management for quick publishing
- Cross-platform support (macOS, Windows, Linux builds via Wails)

✅ **Beyond MVP (Implemented)**
- Full CRUD operations for topics and subscriptions
- Topic monitoring via temporary subscriptions
- Advanced subscription features (dead letter topics, filters, push config viewing)
- Config file editor with Monaco Editor
- JSON syntax highlighting throughout the app
- Virtual scrolling for large message lists
- Theme support (light/dark/auto)
- Connection profile switching without restart

---

## Development Milestones

### ✅ Milestone 1: Foundation (Complete)
**Status:** Complete
**Completed:** Week 1-2

**Delivered:**
- Wails v2 project scaffolding with React 18 + TypeScript
- Authentication: Application Default Credentials (ADC) + Service Account JSON
- Connection profile management (create, save, switch, delete)
- Basic UI layout: sidebar navigation + main content area

---

### ✅ Milestone 2: Resource Explorer (Complete)
**Status:** Complete
**Completed:** Week 3

**Delivered:**
- List topics with pagination and metadata
- List subscriptions with pagination and metadata
- Display full topic/subscription details (ack deadline, retention, filters, dead letter policy)
- Refresh button for resource list
- Client-side search/filter for topics and subscriptions
- **Bonus:** Create/Delete topics (beyond original MVP scope)
- **Bonus:** Create/Update/Delete subscriptions with full configuration
- **Bonus:** Topic-subscription relationship views

---

### ✅ Milestone 3: Message Publisher (Complete)
**Status:** Complete
**Completed:** Week 4

**Delivered:**
- Publish messages with payload and attributes
- JSON validation and formatting
- Display message ID confirmation after publish
- Message template CRUD (create, save, load, delete)
- Template manager with topic-linked templates
- **Bonus:** Monaco Editor for JSON payload editing with syntax highlighting

---

### ✅ Milestone 4: Subscription Monitor (Complete)
**Status:** Complete
**Completed:** Week 5-6

**Delivered:**
- Streaming pull implementation with Go concurrency
- Message list UI with virtual scrolling for performance
- Auto-acknowledge toggle with persistence
- Configurable buffer size limiting (default: 500 messages)
- Real-time search within buffered messages
- Copy payload/message ID buttons
- Clear buffer functionality
- **Bonus:** Topic monitoring via temporary subscriptions

---

### 📋 Milestone 5: Packaging (Not Started)
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

---

### ⏳ Milestone 6: Polish (Partially Complete)
**Status:** In Progress (60% complete)
**Current Sprint**

**Completed:**
- [x] Error handling and user-facing messages
- [x] Dark mode support (light/dark/auto theme modes)
- [x] System theme preference detection
- [x] Config file editor dialog

**In Progress:**
- [ ] **Enhanced theme system** (5 themes: Auto, Dark, Light, Dracula, Monokai)
- [ ] **Configurable font sizes** (small/medium/large)
- [ ] **Monaco Editor theme matching**

**Remaining:**
- [ ] Keyboard shortcuts (Cmd/Ctrl+R refresh, Cmd/Ctrl+P publish, etc.)
- [ ] Command bar for quick actions
- [ ] Template variables/placeholders ({{timestamp}}, {{uuid}}, {{random}})
- [ ] Application icon and branding finalization
- [ ] User onboarding tooltips/walkthrough
- [ ] Performance profiling and optimization

**Next Up:**
The immediate focus is implementing the enhanced theme system with 5 presets and independent font size control.

---

## Roadmap: Next 6 Months

### Q1 2026 (Current Quarter)

#### January - February: Theme System & Polish
**Priority:** High
**Goal:** Complete Milestone 6 (Polish)

- ✅ Theme system foundation (light/dark/auto) - Complete
- 🔄 **Enhanced theme system** with Dracula and Monokai presets - In Planning
- 🔄 **Configurable font sizes** independent of theme - In Planning
- ⏳ Keyboard shortcuts and command bar
- ⏳ Template variables ({{timestamp}}, {{uuid}}, etc.)
- ⏳ Application icon and branding finalization

#### March: Packaging & Distribution
**Priority:** High
**Goal:** Complete Milestone 5 (Packaging)

- GoReleaser setup for all platforms
- GitHub Actions CI/CD pipeline
- macOS code signing and notarization
- Windows code signing
- Auto-update mechanism
- Public beta release

**Success Criteria:**
- Users can download and install with one click
- App auto-updates when new versions are available
- Installation time < 2 minutes

---

### Q2 2026

#### April - May: Advanced Replay Tools
**Priority:** Medium
**Goal:** Enable power users to debug complex message flows

**Features:**
- Subscription snapshots (create, list, seek to snapshot)
- Seek to timestamp functionality
- Dead-letter queue viewer with message re-drive capability
- Message history export (JSON, CSV formats)
- Bulk message republish

**Use Cases:**
- Replay messages from a specific point in time
- Debug dead-letter queue issues
- Export messages for compliance/auditing

#### June: Performance Testing Tools
**Priority:** Medium
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

### Q3 2026

#### July - August: Multi-Project Workspaces
**Priority:** Low
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

#### September: Schema Registry Integration
**Priority:** Low
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

## Future Vision (2027+)

### Multi-Broker Support
Extend the application to support additional message brokers:
- RabbitMQ adapter
- Apache Kafka adapter
- AWS SNS/SQS adapter
- Pluggable architecture for custom brokers

**Why:** Many organizations use multiple message brokers. A unified UI would reduce tool fragmentation.

### Cloud Monitoring Integration
- Display message rate graphs from Cloud Monitoring
- Alert when subscription backlog exceeds threshold
- View subscription metrics (oldest unacked message age, etc.)
- Export monitoring data for custom dashboards

### Plugin System
- User-defined message validators (e.g., custom JSON schema validation)
- Custom message transformers (e.g., encrypt/decrypt payloads)
- Integration with internal tools via webhook plugins

### Team Collaboration
- Share connection profiles across team (read-only credentials)
- Message annotation system (tag messages with notes)
- Export annotated message flows for bug reports

---

## Known Limitations & Technical Debt

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
- Q1 2026: Semantic theme token migration (addresses #1)
- Q2 2026: Add E2E tests with Playwright (addresses #4)
- Q3 2026: Improve accessibility compliance (addresses #6)

---

## Community & Contributions

### Open Source Strategy
This project is currently in private development. Future plans:
- **Q1 2026:** Open source under MIT license after Milestone 6 completion
- **Q2 2026:** Accept community contributions (features, bug fixes, themes)
- **Ongoing:** Maintain public roadmap and feature voting

### How to Contribute (Future)
Once open-sourced:
1. Report bugs via GitHub Issues
2. Suggest features via Discussions
3. Submit pull requests for features marked "help wanted"
4. Share custom themes via community repository
5. Improve documentation and translations

---

## Success Metrics

### User Adoption Goals
- 100 active users by end of Q1 2026
- 500 active users by end of Q2 2026
- 50% weekly retention rate

### Quality Metrics
- Crash rate < 1% of sessions
- Time to first publish < 2 minutes (first-time users)
- Message stream latency < 2 seconds
- Support response time < 24 hours (after public release)

### Performance Benchmarks
- List 100 topics/subscriptions in < 3 seconds
- Handle 500 buffered messages without lag
- Startup time < 5 seconds on modern hardware
- Memory usage < 500MB under normal load

---

## Feedback & Contact

We welcome your feedback!

- **Bug Reports:** [GitHub Issues](https://github.com/yourusername/pubsub-gui/issues) (after open source)
- **Feature Requests:** [GitHub Discussions](https://github.com/yourusername/pubsub-gui/discussions) (after open source)
- **Email:** [your-email@example.com]

---

## Appendix: Versioning Strategy

### Version Numbering
Following [Semantic Versioning](https://semver.org/):
- **Major (X.0.0):** Breaking changes (e.g., new config file format)
- **Minor (0.X.0):** New features (backward compatible)
- **Patch (0.0.X):** Bug fixes and minor improvements

### Current Version: 1.1.0
- 1.0.0: Initial MVP release (Milestones 1-4 complete)
- 1.1.0: Enhanced theme system and polish (Milestone 6)

### Upcoming Versions
- 1.2.0: Packaging and distribution (Milestone 5)
- 1.3.0: Keyboard shortcuts and command bar
- 2.0.0: Multi-project workspaces (breaking: new config schema)
- 2.1.0: Advanced replay tools
- 2.2.0: Schema Registry integration

---

**Document Owner:** Project Lead
**Last Review:** 2026-01-04
**Next Review:** 2026-02-01
