---
name: Topic and Subscription Template System Implementation
overview: Implement a comprehensive template system that allows users to create topics and subscriptions with pre-configured best practices settings. The system will include 10 built-in templates, custom template support, and a complete UI workflow for template-based resource creation.
todos: []
---

# Topic and Subscription Template System - Implementation Plan

## Overview

This plan implements a template system for creating GCP Pub/Sub topics and subscriptions with pre-configured best practices. Users can select a template, enter a base name, and automatically create complete setups including topics, subscriptions, dead letter topics, and all necessary configurations.

## Architecture

The implementation follows the existing codebase patterns:

- **Backend**: New `internal/templates/` package with registry, validator, and creator
- **Models**: New template data structures in `internal/models/template.go`
- **Admin Extensions**: Enhanced admin functions in `internal/pubsub/admin/` for full configuration support
- **Frontend**: New `TemplateSelector` component with multi-step wizard UI
- **Integration**: New handler in `internal/app/` for template operations

## Implementation Tasks

### Phase 1: Backend Foundation (Models & Admin Extensions)

#### 1.1 Create Template Data Models

**File**: `internal/models/template.go`

- Define `TopicSubscriptionTemplate` struct with all configuration fields
- Define `TopicTemplateConfig`, `SubscriptionTemplateConfig`, `DeadLetterTemplateConfig`
- Define `TemplateCreateRequest` and `TemplateCreateResult` for API
- Define `TemplateOverrides` for customization
- Add JSON tags matching TypeScript conventions (camelCase)
- Add validation helper methods

#### 1.2 Extend Admin Package - Topic Creation with Full Config

**File**: `internal/pubsub/admin/topics.go`

- Create `CreateTopicWithConfig()` function accepting `TopicTemplateConfig`
- Support labels, KMS key name, message storage policy
- Maintain backward compatibility with existing `CreateTopicAdmin()`
- Add proper error handling and validation

#### 1.3 Extend Admin Package - Subscription Creation with Full Config

**File**: `internal/pubsub/admin/subscriptions.go`

- Create `SubscriptionConfig` struct with all subscription settings
- Create `CreateSubscriptionWithConfig()` function
- Support: ack deadline, retention, expiration policy, retry policy, ordering, exactly-once, filters, dead letter policy, push config, labels
- Handle all GCP Pub/Sub v2 API requirements
- Maintain backward compatibility with existing `CreateSubscriptionAdmin()`

### Phase 2: Template System Core (Registry & Validation)

#### 2.1 Create Template Registry

**File**: `internal/templates/registry.go`

- Implement `Registry` struct with built-in and custom template maps
- Add `NewRegistry()` constructor loading built-in templates
- Implement `GetTemplate()`, `ListTemplates()`, `ListTemplatesByCategory()`
- Implement `AddCustomTemplate()` and `DeleteCustomTemplate()` with validation
- Use mutex for thread-safe access

#### 2.2 Create Template Validator

**File**: `internal/templates/validator.go`

- Implement `ValidateTemplate()` function
- Validate topic config (retention duration within 10min-31days)
- Validate subscription configs (ack deadline 10-600s, retention, retry policy)
- Validate dead letter config (max delivery attempts 5-100)
- Validate retry policy (min < max backoff)
- Return descriptive error messages

#### 2.3 Create Built-in Templates

**File**: `internal/templates/defaults.go`

- Implement `GetBuiltInTemplates()` returning all 10 templates
- Create `productionCriticalTemplate()` - exactly-once, 30-day retention, DLQ
- Create `productionStandardTemplate()` - at-least-once, 7-day retention, DLQ
- Create `productionHighThroughputTemplate()` - optimized performance, DLQ
- Create `developmentTemplate()` - short retention, auto-expire, no DLQ
- Create `developmentWithDLQTemplate()` - dev with debugging DLQ
- Create `eventDrivenTemplate()` - filtering support, moderate retention
- Create `batchProcessingTemplate()` - long ack deadlines, pull delivery
- Create `streamingPipelineTemplate()` - exactly-once, ordering, DLQ
- Create `multiTenantTemplate()` - filtering enabled
- Create `temporaryDebugTemplate()` - very short retention, quick expiration
- Use proper time.Duration formatting (e.g., "168h" for 7 days)

### Phase 3: Template Creator (Resource Creation Logic)

#### 3.1 Create Template Creator

**File**: `internal/templates/creator.go`

- Implement `Creator` struct with client, projectID, registry
- Implement `NewCreator()` constructor
- Implement `CreateFromTemplate()` main orchestration method
- Create resources in correct order: DLQ topic → DLQ sub → main topic → subscriptions
- Handle template overrides (retention, ack deadline, max delivery attempts, disable DLQ)
- Build resource names with base name and environment suffix
- Return `TemplateCreateResult` with all created resource IDs

#### 3.2 Implement Dead Letter Resource Creation

**File**: `internal/templates/creator.go` (continued)

- Implement `createDeadLetterResources()` helper
- Create DLQ topic with simplified config
- Create DLQ subscription with long ack deadline for manual inspection
- Handle expiration policy for DLQ subscription
- Return topic and subscription names

#### 3.3 Implement Topic Creation Helper

**File**: `internal/templates/creator.go` (continued)

- Implement `createTopic()` helper
- Apply template config with override support
- Use `admin.CreateTopicWithConfig()` from Phase 1.2
- Handle labels and retention duration

#### 3.4 Implement Subscription Creation Helper

**File**: `internal/templates/creator.go` (continued)

- Implement `createSubscription()` helper
- Build full subscription config from template
- Apply overrides for ack deadline and max delivery attempts
- Link dead letter topic if configured
- Use `admin.CreateSubscriptionWithConfig()` from Phase 1.3
- Handle retry policy, ordering, exactly-once, filters

### Phase 4: App Integration (Handler & Methods)

#### 4.1 Create Template Handler

**File**: `internal/app/template_handler.go` (NEW - separate from message templates)

- Create `TemplateHandler` struct (different from existing message template handler)
- Initialize template registry in constructor
- Implement methods for template management
- Handle custom template persistence in config file
- Load custom templates from config on startup

#### 4.2 Add Template Methods to App

**File**: `app.go`

- Add `templateRegistry *templates.Registry` field to App struct
- Initialize registry in `NewApp()` or `startup()`
- Add `GetTopicSubscriptionTemplates()` method
- Add `GetTopicSubscriptionTemplatesByCategory()` method
- Add `CreateFromTemplate()` method delegating to creator
- Add `SaveCustomTemplate()` method
- Add `DeleteCustomTemplate()` method
- Emit `template:created` event after successful creation
- Trigger `syncResources()` after template creation

#### 4.3 Update App Initialization

**File**: `app.go` (continued)

- Initialize template handler in `startup()`
- Load custom templates from config
- Ensure template registry is available before connection

### Phase 5: Frontend Types & Models

#### 5.1 Add TypeScript Types for Templates

**File**: `frontend/src/types/index.ts`

- Add `TopicSubscriptionTemplate` interface
- Add `TopicTemplateConfig` interface
- Add `SubscriptionTemplateConfig` interface
- Add `DeadLetterTemplateConfig` interface
- Add `TemplateCreateRequest` interface
- Add `TemplateCreateResult` interface
- Add `TemplateOverrides` interface
- Match Go struct field names (camelCase JSON)

### Phase 6: Frontend UI Components

#### 6.1 Create Template Selector Component

**File**: `frontend/src/components/TemplateSelector.tsx`

- Implement multi-step wizard: select → configure → preview
- Load templates on dialog open using `GetTopicSubscriptionTemplates()`
- Group templates by category (production, development, specialized)
- Display template cards with name, description, features
- Show built-in badge for built-in templates
- Show subscription count and DLQ indicator
- Handle template selection and navigation

#### 6.2 Implement Configuration Step

**File**: `frontend/src/components/TemplateSelector.tsx` (continued)

- Add base name input with validation (lowercase, hyphens, no spaces)
- Add environment dropdown (prod, dev, staging, test, none)
- Show preview of resource names that will be created
- Display configuration summary (retention, subscriptions, ack deadline, DLQ, exactly-once)
- Add error display for validation errors
- Use theme system CSS variables for all styling

#### 6.3 Implement Template Creation Logic

**File**: `frontend/src/components/TemplateSelector.tsx` (continued)

- Call `CreateFromTemplate()` with request object
- Show loading state during creation
- Handle errors with user-friendly messages
- Show success notification with created resource count
- Close dialog and refresh resources on success
- Reset form state on close

#### 6.4 Add Template Action to Command Bar

**File**: `frontend/src/components/CommandBar.tsx` or `frontend/src/App.tsx`

- Add "Create from Template" action to command bar
- Set keyboard shortcut (e.g., `mod+t`)
- Open TemplateSelector dialog on action
- Ensure action is available when connected

#### 6.5 Add Template Button to Main UI

**File**: `frontend/src/App.tsx` or appropriate component

- Add "Create from Template" button to sidebar or toolbar
- Position near other create actions
- Show only when connected to a project
- Use theme-aware styling

### Phase 7: Error Handling & Edge Cases

#### 7.1 Implement Error Rollback Logic

**File**: `internal/templates/creator.go`

- Track created resources during template creation
- If DLQ creation fails → abort entire operation
- If topic creation fails → delete created DLQ resources
- If subscription creation fails → keep topic, warn user
- Return partial success with warnings when appropriate

#### 7.2 Add Input Validation

**File**: `frontend/src/components/TemplateSelector.tsx`

- Validate base name format (lowercase, alphanumeric, hyphens)
- Prevent empty base name
- Show real-time validation feedback
- Disable create button until valid input

#### 7.3 Handle Duplicate Resources

**File**: `internal/templates/creator.go`

- Check if resources already exist before creation
- Return clear error messages for duplicate resources
- Suggest alternative names when conflicts occur

### Phase 8: Testing & Validation

#### 8.1 Unit Tests - Template Validation

**File**: `internal/templates/validator_test.go`

- Test valid template passes validation
- Test invalid retention duration (too short, too long)
- Test invalid ack deadline (out of range)
- Test invalid retry policy (min >= max)
- Test missing required fields

#### 8.2 Unit Tests - Template Registry

**File**: `internal/templates/registry_test.go`

- Test registry initialization with built-in templates
- Test getting template by ID
- Test listing templates by category
- Test adding custom template
- Test deleting custom template (not built-in)
- Test thread safety with concurrent access

#### 8.3 Unit Tests - Template Creator

**File**: `internal/templates/creator_test.go`

- Test resource name generation with base name and environment
- Test override application (retention, ack deadline, max attempts)
- Test dead letter resource creation order
- Test error rollback on partial failure
- Mock Pub/Sub client for testing

#### 8.4 Integration Tests

**File**: `test/templates_integration_test.go` (or similar)

- Test end-to-end template creation with emulator
- Test all 10 built-in templates create correctly
- Test environment suffix appending
- Test resource configurations match template
- Test custom template creation and usage
- Clean up resources after tests

#### 8.5 Manual Testing Checklist

- Test all built-in templates in UI
- Test template selection and navigation
- Test base name validation
- Test environment suffix
- Test dead letter resource creation
- Test error handling (duplicate names, invalid input)
- Test resource appearance in sidebar after creation
- Test with all 5 themes (theme system compliance)

### Phase 9: Documentation & Polish

#### 9.1 Update CLAUDE.md

**File**: `CLAUDE.md`

- Add template system section to Backend API Reference
- Document new App methods: `GetTopicSubscriptionTemplates()`, `CreateFromTemplate()`, etc.
- Add template-related events: `template:created`
- Update architecture section with template system

#### 9.2 Add Template Usage Examples

**File**: `README.md` or new `TEMPLATES.md`

- Document each built-in template and use cases
- Show example workflow (select template → configure → create)
- Explain template customization options
- Add troubleshooting section

#### 9.3 Code Comments & Documentation

- Add package-level documentation for `internal/templates/`
- Add function-level comments for public APIs
- Document template configuration options
- Add examples in code comments

## Key Implementation Details

### Resource Creation Order

1. Dead letter topic (if enabled)
2. Dead letter subscription (if enabled)
3. Main topic
4. Main subscriptions (one or more)

### Naming Convention

- Base name: `orders` → Topic: `orders-topic`, Sub: `orders-sub`
- With environment: `orders` + `prod` → `orders-prod-topic`, `orders-prod-sub`
- Dead letter: `orders-dlq`, `orders-dlq-sub`

### Error Handling Strategy

- Partial failures: Rollback created resources
- Duplicate resources: Clear error message with suggestions
- Invalid input: Frontend validation before API call
- Network errors: Retry logic in admin functions

### Theme System Compliance

- All UI components use semantic CSS variables
- No hardcoded colors
- Test with all 5 themes (Auto, Dark, Light, Dracula, Monokai)

## Dependencies

- Existing admin functions in `internal/pubsub/admin/`
- Existing config manager in `internal/config/`
- Existing resource handler for sync after creation
- Wails bindings auto-generation for new App methods

## Estimated Timeline

- **Phase 1** (Models & Admin): 2-3 hours
- **Phase 2** (Registry & Validation): 2 hours
- **Phase 3** (Creator): 2-3 hours
- **Phase 4** (App Integration): 1-2 hours
- **Phase 5** (Frontend Types): 30 minutes
- **Phase 6** (Frontend UI): 3-4 hours
- **Phase 7** (Error Handling): 1-2 hours
- **Phase 8** (Testing): 2-3 hours
- **Phase 9** (Documentation): 1 hour

**Total**: ~16-20 hours

## Success Criteria

- All 10 built-in templates work correctly
- Users can create complete setups with one click
- Custom templates can be saved and reused
- Error handling provides clear feedback
- UI is theme-compliant and accessible
- All resources created match template configurations
- Integration tests pass with Pub/Sub emulator