# Milestone 3: Message Publisher - Task Definition

**Version:** 1.0
**Target:** Week 4
**Status:** Planning

---

## Overview

Milestone 3 implements the **Message Publisher** feature, enabling users to publish messages to Pub/Sub topics with custom payloads and attributes. A key component is the **Message Template System**, which allows users to save, manage, and quickly reuse common message patterns.

### Core Deliverables

1. **Publish Form** - UI for composing messages with payload and attributes
2. **JSON Validation** - Client-side validation for JSON payloads
3. **Publish Result Display** - Show message ID and timestamp on success
4. **Message Template CRUD** - Create, read, update, delete templates
5. **Template Quick-Load** - One-click template loading into publisher

---

## Message Template System Design

### 1. Template Data Model

#### Go Backend Model (`internal/models/template.go`)

```go
// MessageTemplate represents a saved message template
type MessageTemplate struct {
    ID        string            `json:"id"`                  // UUID v7
    Name      string            `json:"name"`                // User-defined name
    TopicID   string            `json:"topicId,omitempty"`   // Optional: linked topic
    Payload   string            `json:"payload"`             // Message payload (string)
    Attributes map[string]string `json:"attributes"`         // Key-value attributes
    CreatedAt string            `json:"createdAt"`           // ISO 8601 timestamp
    UpdatedAt string            `json:"updatedAt"`           // ISO 8601 timestamp
}

// Validate ensures the template has required fields
func (mt *MessageTemplate) Validate() error {
    if strings.TrimSpace(mt.ID) == "" {
        return errors.New("template ID cannot be empty")
    }
    if strings.TrimSpace(mt.Name) == "" {
        return errors.New("template name cannot be empty")
    }
    if strings.TrimSpace(mt.Payload) == "" {
        return errors.New("template payload cannot be empty")
    }
    return nil
}
```

#### TypeScript Frontend Model (`frontend/src/types/index.ts`)

```typescript
export interface MessageTemplate {
  id: string;
  name: string;
  topicId?: string;        // Optional: link to specific topic
  payload: string;
  attributes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
```

### 2. Template Storage

Templates are stored in the application configuration file (`~/.pubsub-gui/config.json`) as part of the `AppConfig` structure:

```json
{
  "profiles": [ /* ... */ ],
  "activeProfileId": "...",
  "messageBufferSize": 500,
  "autoAck": true,
  "theme": "auto",
  "templates": [
    {
      "id": "uuid-v7",
      "name": "User Signup Event",
      "topicId": "projects/my-project/topics/user-events",
      "payload": "{\"userId\":\"123\",\"email\":\"user@example.com\",\"timestamp\":\"2026-01-04T12:00:00Z\"}",
      "attributes": {
        "eventType": "user.signup",
        "source": "webapp"
      },
      "createdAt": "2026-01-04T10:00:00Z",
      "updatedAt": "2026-01-04T10:00:00Z"
    }
  ]
}
```

**Storage Location:** `~/.pubsub-gui/config.json` (same file as connection profiles)

**Persistence:** Templates persist across app restarts and are shared across all connection profiles (global scope)

---

## How Templates Work

### 3. Template Lifecycle

#### 3.1 Template Creation

**User Flow:**
1. User composes a message in the publish form (payload + attributes)
2. User clicks "Save as Template" button
3. Dialog prompts for template name (and optional topic link)
4. Template is saved to config and immediately available in template dropdown

**Implementation:**
- Frontend calls `SaveTemplate(template: MessageTemplate)` Go method
- Backend validates template, generates UUID v7 if not provided
- Backend adds template to `AppConfig.Templates` array
- Backend saves config file atomically
- Frontend updates template dropdown

#### 3.2 Template Loading

**User Flow:**
1. User selects a topic in sidebar
2. Publisher form shows template dropdown (above payload textarea)
3. User selects a template from dropdown
4. Payload and attributes fields are populated with template values
5. User can edit before publishing

**Implementation:**
- Frontend calls `GetTemplates(topicID?: string)` Go method
- Backend filters templates:
  - If `topicID` provided: show templates linked to that topic + global templates (no `topicID`)
  - If no `topicID`: show all templates
- Frontend displays filtered templates in dropdown
- On selection, frontend populates form fields

#### 3.3 Template Execution

**User Flow:**
1. User loads a template (payload + attributes populated)
2. User optionally edits payload or attributes
3. User clicks "Publish" button
4. Message is published to selected topic
5. Success: message ID displayed; template remains loaded for reuse

**Implementation:**
- Frontend validates JSON payload (if user indicates JSON mode)
- Frontend calls `PublishMessage(topicID, payload, attributes)` Go method
- Backend publishes via Pub/Sub client
- Backend returns message ID and publish timestamp
- Frontend displays success notification

#### 3.4 Template Management

**CRUD Operations:**

- **Create:** `SaveTemplate(template)` - Add new template
- **Read:** `GetTemplates(topicID?)` - List all or filtered templates
- **Update:** `UpdateTemplate(templateID, template)` - Modify existing template
- **Delete:** `DeleteTemplate(templateID)` - Remove template

**UI Components:**
- Template dropdown in publisher form
- "Save as Template" button in publisher form
- Template management dialog (accessible from settings or publisher)
  - List all templates
  - Edit template name, payload, attributes
  - Delete templates
  - Link/unlink templates to topics

---

## Configuration Details

### 4. Template Configuration Structure

#### 4.1 AppConfig Extension

Update `internal/models/connection.go`:

```go
// AppConfig represents the application configuration
type AppConfig struct {
    Profiles          []ConnectionProfile `json:"profiles"`
    ActiveProfileID   string              `json:"activeProfileId,omitempty"`
    MessageBufferSize int                 `json:"messageBufferSize"`
    AutoAck           bool                `json:"autoAck"`
    Theme             string              `json:"theme"`
    Templates         []MessageTemplate   `json:"templates"`  // NEW
}
```

#### 4.2 Default Configuration

```go
// NewDefaultConfig creates a new AppConfig with default values
func NewDefaultConfig() *AppConfig {
    return &AppConfig{
        Profiles:          []ConnectionProfile{},
        ActiveProfileID:   "",
        MessageBufferSize: 500,
        AutoAck:           true,
        Theme:             "auto",
        Templates:         []MessageTemplate{},  // NEW: empty templates array
    }
}
```

### 5. Template Filtering Rules

Templates can be **topic-specific** or **global**:

- **Topic-Specific:** `topicID` field is set → Only shown when that topic is selected
- **Global:** `topicID` field is empty → Shown for all topics

**Filtering Logic:**
```go
func FilterTemplates(templates []MessageTemplate, topicID string) []MessageTemplate {
    filtered := []MessageTemplate{}
    for _, t := range templates {
        // Include if: no topicID (global) OR matches current topic
        if t.TopicID == "" || t.TopicID == topicID {
            filtered = append(filtered, t)
        }
    }
    return filtered
}
```

---

## Loading Mechanism

### 6. Template Loading Flow

#### 6.1 Application Startup

1. **Backend (`app.go` startup):**
   - Config manager loads `AppConfig` from `~/.pubsub-gui/config.json`
   - Templates array is loaded into memory
   - If config file doesn't exist, default config (empty templates) is used

2. **Frontend (`App.tsx` useEffect):**
   - On mount, calls `GetTemplates()` to fetch all templates
   - Stores templates in React state/context
   - Template dropdown is populated

#### 6.2 Topic Selection

1. User selects a topic in sidebar
2. Frontend calls `GetTemplates(topicID)` with current topic ID
3. Backend filters templates (topic-specific + global)
4. Frontend updates template dropdown with filtered list
5. Publisher form shows template dropdown above payload field

#### 6.3 Template Selection

1. User selects template from dropdown
2. Frontend populates:
   - Payload textarea with `template.payload`
   - Attributes table with `template.attributes` (key-value pairs)
3. User can edit before publishing
4. Template selection persists until user changes it or clears form

---

## Execution Flow

### 7. Publish Message Flow (with Template)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User selects topic                                        │
│    → Publisher form appears                                  │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Frontend calls GetTemplates(topicID)                      │
│    → Backend filters templates                               │
│    → Returns filtered template list                           │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Template dropdown populated                               │
│    → User selects template                                   │
│    → Payload + attributes loaded into form                   │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. User optionally edits payload/attributes                  │
│    → JSON validation (if JSON mode enabled)                  │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. User clicks "Publish"                                      │
│    → Frontend validates payload                              │
│    → Frontend calls PublishMessage(topicID, payload, attrs) │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Backend publishes via Pub/Sub client                    │
│    → Returns message ID + publish timestamp                  │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Frontend displays success notification                   │
│    → Shows message ID                                        │
│    → Template remains loaded for reuse                        │
└─────────────────────────────────────────────────────────────┘
```

### 8. Save Template Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User composes message in publisher form                  │
│    → Payload + attributes filled                             │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. User clicks "Save as Template"                           │
│    → Dialog opens: name input + optional topic link         │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. User enters template name (required)                     │
│    → Optionally links to current topic                      │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Frontend calls SaveTemplate(template)                    │
│    → Backend validates template                              │
│    → Backend generates UUID v7 if not provided               │
│    → Backend adds to AppConfig.Templates                     │
│    → Backend saves config file atomically                    │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Frontend updates template dropdown                       │
│    → New template immediately available                     │
│    → Success notification shown                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Backend Tasks

#### Task 3.1: Create Template Model
- [ ] Create `internal/models/template.go`
- [ ] Define `MessageTemplate` struct with validation
- [ ] Add `Templates []MessageTemplate` to `AppConfig`
- [ ] Update `NewDefaultConfig()` to include empty templates array
- [ ] Add template-related errors to `internal/models/errors.go`

#### Task 3.2: Template CRUD Methods in App
- [ ] Add `GetTemplates(topicID string) ([]MessageTemplate, error)` to `app.go`
- [ ] Add `SaveTemplate(template MessageTemplate) error` to `app.go`
- [ ] Add `UpdateTemplate(templateID string, template MessageTemplate) error` to `app.go`
- [ ] Add `DeleteTemplate(templateID string) error` to `app.go`
- [ ] Implement template filtering logic (topic-specific vs global)

#### Task 3.3: Publisher Backend
- [ ] Create `internal/pubsub/publisher/publisher.go`
- [ ] Implement `PublishMessage(ctx, client, topicID, payload, attributes) (messageID, error)`
- [ ] Add `PublishMessage(topicID, payload, attributes) (string, error)` to `app.go`
- [ ] Handle Pub/Sub publish errors with user-friendly messages
- [ ] Return message ID and publish timestamp on success

### Frontend Tasks

#### Task 3.4: Template TypeScript Types
- [ ] Add `MessageTemplate` interface to `frontend/src/types/index.ts`
- [ ] Update Wails bindings (run `wails dev` to regenerate)

#### Task 3.5: Publisher UI Component
- [ ] Create `frontend/src/components/TopicDetails.tsx` (or extend existing)
- [ ] Add "Publish" tab to topic details view
- [ ] Implement payload textarea (resizable, min 10 lines)
- [ ] Implement attributes table (add/remove rows)
- [ ] Add JSON validation toggle/indicator
- [ ] Add "Publish" button with loading state
- [ ] Display publish result (message ID, timestamp)

#### Task 3.6: Template Dropdown
- [ ] Add template dropdown above payload textarea
- [ ] Implement template selection handler
- [ ] Populate form fields on template selection
- [ ] Show "No templates" placeholder when empty

#### Task 3.7: Save Template Feature
- [ ] Add "Save as Template" button in publisher form
- [ ] Create template save dialog component
- [ ] Implement template name input
- [ ] Implement optional topic link checkbox
- [ ] Call `SaveTemplate` on confirm

#### Task 3.8: Template Management UI
- [ ] Create template management dialog/modal
- [ ] List all templates with name, topic link, created date
- [ ] Implement edit template (name, payload, attributes)
- [ ] Implement delete template with confirmation
- [ ] Add "Manage Templates" button/link in publisher or settings

### Integration Tasks

#### Task 3.9: Template Loading on Topic Select
- [ ] Update topic selection handler to call `GetTemplates(topicID)`
- [ ] Filter templates based on current topic
- [ ] Update template dropdown when topic changes

#### Task 3.10: Error Handling
- [ ] Handle template save errors (duplicate names, validation failures)
- [ ] Handle publish errors (permission denied, topic not found, etc.)
- [ ] Display user-friendly error messages

---

## Acceptance Criteria

### Functional Requirements

- [ ] **AC1:** User can publish a message with custom payload and attributes
- [ ] **AC2:** Published messages return message ID and timestamp
- [ ] **AC3:** JSON payload validation works (shows errors before publish)
- [ ] **AC4:** User can save current message as template with name
- [ ] **AC5:** Templates persist across app restarts
- [ ] **AC6:** User can load template into publisher form
- [ ] **AC7:** Template dropdown shows topic-specific + global templates
- [ ] **AC8:** User can edit template payload/attributes before publishing
- [ ] **AC9:** User can update existing template (name, payload, attributes)
- [ ] **AC10:** User can delete templates
- [ ] **AC11:** Template operations (save/update/delete) update dropdown immediately

### Performance Requirements

- [ ] **AC12:** Template loading completes in < 100ms
- [ ] **AC13:** Template save completes in < 200ms
- [ ] **AC14:** Publish operation completes in < 2 seconds for typical payloads (< 10KB)
- [ ] **AC15:** UI remains responsive during publish operation

### UX Requirements

- [ ] **AC16:** Template dropdown shows template name and optional topic indicator
- [ ] **AC17:** "Save as Template" button is clearly visible in publisher form
- [ ] **AC18:** Template management dialog is accessible and intuitive
- [ ] **AC19:** Success notifications show message ID and are dismissible
- [ ] **AC20:** Error messages are user-friendly (no raw API errors)

---

## Technical Notes

### UUID v7 Generation

Use UUID v7 for template IDs (time-ordered, sortable). In Go:
- Option 1: Use `github.com/google/uuid` with custom v7 implementation
- Option 2: Use timestamp-based ID (similar to connection profiles) for MVP
- **Recommendation:** Start with timestamp-based, upgrade to UUID v7 later if needed

### JSON Validation

- Client-side validation using `JSON.parse()` in TypeScript
- Show validation errors inline below payload textarea
- Allow publishing non-JSON payloads (treat as plain text)
- Optional: Add JSON syntax highlighting (Monaco Editor) for future enhancement

### Template Limits

- **MVP:** No hard limits on template count
- **Future:** Consider pagination if users create 100+ templates

### Atomic Config Writes

- Use existing `config.Manager.SaveConfig()` which implements atomic writes
- Prevents config corruption during concurrent template operations

---

## Testing Checklist

### Unit Tests

- [ ] Template validation (empty name, empty payload)
- [ ] Template filtering (topic-specific vs global)
- [ ] Template CRUD operations
- [ ] Config persistence (save/load templates)

### Integration Tests

- [ ] Publish message with template payload
- [ ] Save template and verify persistence
- [ ] Load template and verify form population
- [ ] Delete template and verify removal from dropdown

### Manual Testing

- [ ] Create template, restart app, verify template still exists
- [ ] Create topic-specific template, verify only shows for that topic
- [ ] Create global template, verify shows for all topics
- [ ] Publish message, verify message ID returned
- [ ] Publish invalid JSON (with JSON mode), verify error shown
- [ ] Publish large payload (> 10KB), verify performance acceptable

---

## Dependencies

### Backend Dependencies
- `cloud.google.com/go/pubsub` - Already included
- UUID library (optional, for v7 generation)

### Frontend Dependencies
- React 18 - Already included
- TypeScript - Already included
- Radix UI components (for dialogs, dropdowns) - To be added if not present

---

## Future Enhancements (Post-MVP)

1. **Template Variables/Placeholders**
   - Support `{{timestamp}}`, `{{uuid}}`, `{{date}}` in templates
   - Replace placeholders on template load

2. **Template Categories/Tags**
   - Organize templates by category (e.g., "User Events", "System Events")
   - Filter templates by tags

3. **Template Import/Export**
   - Export templates to JSON file
   - Import templates from JSON file
   - Share templates between team members

4. **Template Versioning**
   - Track template history
   - Revert to previous template version

5. **Bulk Publish**
   - Publish multiple messages from template with variations
   - Generate test data sets

---

## References

- [PRD.md Section 6.4: Topic Publisher](./PRD.md#64-topic-publisher-message-composer)
- [PRD.md Section 9.5: Message Template](./PRD.md#95-message-template)
- [PRD.md Section 10.1: Application Settings](./PRD.md#101-application-settings)
- [Google Cloud Pub/Sub Publish Documentation](https://cloud.google.com/pubsub/docs/publisher)

---

**Document Owner:** Development Team
**Last Updated:** 2026-01-04
