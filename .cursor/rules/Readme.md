# Rules Index

This document provides an overview of all rules in the `.cursor/rules/` directory. Rules are organized by category to help you quickly find the relevant documentation for your task.

## Core Application Rules

### `wails.mdc` ⭐ (Always Applied)
**Wails v2 Application Development Guide**

Comprehensive guide for Wails v2 architecture patterns, backend-frontend communication, and coding conventions. Covers:
- Go backend patterns (App struct, method binding, context usage)
- Frontend React/TypeScript patterns (Wails bindings, event listening)
- Resource synchronization and caching patterns
- Event-driven UI updates
- Concurrency and thread safety
- Common patterns and best practices

**Use when:** Working on backend-frontend integration, adding new Wails methods, implementing event-driven features, or understanding the app architecture.

---

### `react-tailwind.mdc` ⭐ (Always Applied)
**UI Development Guide for Pub/Sub GUI**

Complete guide for React + TypeScript frontend development. Covers:
- Component patterns and structure
- Theme system compliance (CRITICAL for all UI work)
- Tailwind CSS v4 usage
- shadcn/ui component library patterns
- Wails integration patterns
- Error handling and state management
- Common UI patterns (dialogs, forms, empty states)
- Accessibility and performance best practices

**Use when:** Creating or modifying React components, styling UI elements, or working with the frontend.

---

### `theme-system.mdc`
**Theme System Architecture and Patterns**

Detailed documentation of the theme system with 5 themes (Auto, Dark, Light, Dracula, Monokai) and 3 font sizes. Covers:
- Backend configuration storage and validation
- Frontend theme definitions (CSS variables)
- ThemeContext and hooks
- Monaco Editor integration
- Event-driven theme switching
- Color palette structure

**Use when:** Working on theme-related features, Monaco Editor integration, or understanding how themes work.

---

### `components.mdc` ⭐ (Always Applied)
**Component Index**

Complete index of all React components in the application, organized by category:
- Layout components (Layout, Sidebar)
- Connection & Authentication components
- Resource Management components
- Monitoring components
- Message components
- Dialog components
- Settings components
- UI Primitives

Each component includes file path, props interface, usage examples, and features.

**Use when:** Looking for existing components to reuse, understanding component APIs, or finding where specific functionality is implemented.

---

## GCP Pub/Sub Rules

### `pubsub/go-client.mdc`
**GCP Pub/Sub v2 Client Guidelines**

Guidelines for working with `cloud.google.com/go/pubsub/v2`. Covers:
- Client creation and emulator support
- Admin operations (topics, subscriptions)
- Publishing messages
- Subscribing and receiving messages
- Error handling patterns
- Resource name handling

**Use when:** Working with GCP Pub/Sub API, implementing new Pub/Sub features, or understanding client patterns.

---

### `pubsub/auth.mdc`
**Authentication Methods**

Guidelines for authentication in Pub/Sub GUI. Covers:
- ADC (Application Default Credentials)
- Service Account authentication
- OAuth2 authentication
- Emulator support
- Connection profiles

**Use when:** Implementing authentication features, debugging connection issues, or understanding how credentials work.

---

### `pubsub/topics-and-subs.mdc`
**Topics and Subscriptions Guidelines**

Specific patterns for resource name handling and CRUD operations. Covers:
- Resource name normalization
- Subscription ID format requirements
- Creating temporary subscriptions
- CRUD operation patterns
- Resource name extraction

**Use when:** Creating or managing topics/subscriptions, handling resource names, or implementing CRUD operations.

---

### `pubsub/message-publishing.mdc`
**Message Publishing Guidelines**

Guidelines for message publishing implementation. Covers:
- Publishing patterns
- Message attributes
- Error handling
- Integration with templates

**Use when:** Implementing message publishing features or working with message templates.

---

### `pubsub/snapshots.mdc`
**Snapshots Guidelines**

Comprehensive guide for working with Pub/Sub snapshots. Covers:
- What snapshots are and when to use them
- Creating and deleting snapshots
- Seeking subscriptions to snapshots
- Snapshot compatibility
- Best practices and limitations

**Use when:** Implementing snapshot features, seeking subscriptions, or understanding snapshot operations.

---

## Code Quality Rules

### `codacy.mdc` ⭐ (Always Applied)
**Codacy Rules**

Configuration for AI behavior when interacting with Codacy's MCP Server. Covers:
- Automatic code analysis after edits
- Dependency security checks
- Repository configuration
- Troubleshooting steps

**Use when:** Making code changes (automatically applied) or troubleshooting Codacy integration.

---

## Testing Rules

### `running-tests.mdc`
**How to Run Tests**

Guide for running unit tests and integration tests. Covers:
- Test organization (unit vs integration)
- Running tests locally
- Running tests in CI/CD
- Test coverage
- Debugging tests

**Use when:** Running tests, setting up test environment, or debugging test failures.

---

### `writing-tests.mdc` (Applied to `*_test.go` files)
**Go Testing Best Practices**

Best practices for writing Go tests based on Google's guidelines. Covers:
- Test structure and naming
- Table-driven tests
- Error handling in tests
- Test helpers and utilities
- Integration test patterns
- Common pitfalls to avoid

**Use when:** Writing new tests, refactoring tests, or understanding test patterns.

---

## Build & Release Rules

### `goreleaser.mdc`
**Goreleaser Configuration and Usage**

Guide for using Goreleaser to build and release the application. Covers:
- Local builds for all platforms
- GitHub Actions workflows
- Release configuration
- Platform-specific requirements

**Use when:** Building releases, configuring builds, or setting up CI/CD for releases.

---

## Rule Application Status

Rules marked with ⭐ are **always applied** (`alwaysApply: true`). Other rules are applied contextually based on:
- File patterns (e.g., `writing-tests.mdc` applies to `*_test.go` files)
- Task context (e.g., Pub/Sub rules when working with Pub/Sub features)
- Manual reference (e.g., `goreleaser.mdc` when working on releases)

## Quick Reference by Task Type

**Creating a new React component:**
1. Read `react-tailwind.mdc` for UI patterns and theme compliance
2. Check `components.mdc` for similar components to reuse
3. Reference `wails.mdc` for Wails integration patterns

**Adding a new backend method:**
1. Read `wails.mdc` for method exposure patterns
2. Check `pubsub/go-client.mdc` for Pub/Sub API usage
3. Reference `pubsub/topics-and-subs.mdc` for resource operations

**Working with authentication:**
1. Read `pubsub/auth.mdc` for authentication methods
2. Reference `wails.mdc` for connection management patterns

**Implementing Pub/Sub features:**
1. Read `pubsub/go-client.mdc` for client patterns
2. Check specific rule for feature type:
   - `pubsub/topics-and-subs.mdc` for topics/subscriptions
   - `pubsub/message-publishing.mdc` for publishing
   - `pubsub/snapshots.mdc` for snapshots
3. Reference `wails.mdc` for backend-frontend integration

**Writing tests:**
1. Read `writing-tests.mdc` for test patterns
2. Reference `running-tests.mdc` for running tests
3. Check `wails.mdc` for app-specific test patterns

**Styling UI components:**
1. Read `react-tailwind.mdc` for styling guidelines (CRITICAL)
2. Check `theme-system.mdc` for theme integration
3. Reference `components.mdc` for existing component patterns

---

## Related Documentation

- **`CLAUDE.md`** - Project overview, architecture, and quick start guide
- **`PRD.md`** - Product requirements and specifications
- **`.cursor/tasks/`** - Task-specific documentation and migration guides

---

**Last Updated:** 2026-01-06
