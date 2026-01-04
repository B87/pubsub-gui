---
name: CRUD Topics Subscriptions
overview: Add full CRUD operations for topics (Create/Delete) and subscriptions (Create/Update/Delete) with UI dialogs and backend API methods.
todos:
  - id: backend-topic-crud
    content: Add CreateTopicAdmin and DeleteTopicAdmin functions to internal/pubsub/admin/topics.go
    status: completed
  - id: backend-subscription-update
    content: Add UpdateSubscriptionAdmin function to internal/pubsub/admin/subscriptions.go
    status: completed
  - id: backend-app-bindings
    content: Expose CreateTopic, DeleteTopic, and UpdateSubscription methods in app.go with Wails bindings
    status: completed
    dependencies:
      - backend-topic-crud
      - backend-subscription-update
  - id: frontend-types
    content: Add SubscriptionUpdateParams type to frontend/src/types/index.ts
    status: completed
  - id: frontend-topic-dialog
    content: Create TopicCreateDialog component for creating topics
    status: completed
    dependencies:
      - frontend-types
  - id: frontend-subscription-dialog
    content: Create SubscriptionDialog component for creating and editing subscriptions
    status: completed
    dependencies:
      - frontend-types
  - id: frontend-delete-dialog
    content: Create DeleteConfirmDialog reusable component
    status: completed
  - id: frontend-sidebar-actions
    content: Add create buttons and context actions to Sidebar component
    status: completed
    dependencies:
      - frontend-topic-dialog
      - frontend-subscription-dialog
      - frontend-delete-dialog
  - id: frontend-topic-details-delete
    content: Add delete button to TopicDetails component
    status: completed
    dependencies:
      - frontend-delete-dialog
  - id: frontend-subscription-details-crud
    content: Add edit and delete buttons to SubscriptionDetails component
    status: completed
    dependencies:
      - frontend-subscription-dialog
      - frontend-delete-dialog
  - id: frontend-app-handlers
    content: Add CRUD handlers and event listeners to App.tsx
    status: completed
    dependencies:
      - frontend-sidebar-actions
      - frontend-topic-details-delete
      - frontend-subscription-details-crud
---

# CRUD Operations for Topics and Subscriptions

## Overview

Add Create, Read, Update, and Delete operations for topics and subscriptions. Topics support Create/Delete (immutable in GCP), while subscriptions support full CRUD with all updatable fields.

## Architecture

### Backend Changes

#### 1. Topic Admin Operations (`internal/pubsub/admin/topics.go`)

Add two new functions:

- **`CreateTopicAdmin`**: Creates a new topic with optional message retention duration
  - Input: `projectID`, `topicID`, optional `messageRetentionDuration`
  - Uses `client.TopicAdminClient.CreateTopic()` with `pubsubpb.CreateTopicRequest`
  - Normalizes topic ID (handles both full path and short name)

- **`DeleteTopicAdmin`**: Deletes a topic
  - Input: `projectID`, `topicID`
  - Uses `client.TopicAdminClient.DeleteTopic()` with `pubsubpb.DeleteTopicRequest`
  - Normalizes topic ID

#### 2. Subscription Admin Operations (`internal/pubsub/admin/subscriptions.go`)

Add one new function:

- **`UpdateSubscriptionAdmin`**: Updates subscription configuration
  - Input: `projectID`, `subID`, and update parameters (ack deadline, retention, filter, dead letter policy, push config)
  - Uses `client.SubscriptionAdminClient.UpdateSubscription()` with `pubsubpb.UpdateSubscriptionRequest`
  - Uses field mask to only update specified fields
  - Normalizes subscription ID

#### 3. App Bindings (`app.go`)

Expose new methods to frontend:

- **`CreateTopic(topicID string, messageRetentionDuration string) error`**
- **`DeleteTopic(topicID string) error`**
- **`UpdateSubscription(subID string, updates SubscriptionUpdateParams) error`**
- Emit events after operations: `topic:created`, `topic:deleted`, `subscription:updated`

### Frontend Changes

#### 1. Types (`frontend/src/types/index.ts`)

Add new types:

```typescript
export interface SubscriptionUpdateParams {
  ackDeadline?: number;
  retentionDuration?: string;
  filter?: string;
  deadLetterPolicy?: DeadLetterPolicy;
  pushEndpoint?: string;
  subscriptionType?: 'pull' | 'push';
}
```

#### 2. Sidebar Component (`frontend/src/components/Sidebar.tsx`)

Add action buttons:

- **Topics section**: "+ Create Topic" button (opens dialog)
- **Subscriptions section**: "+ Create Subscription" button (opens dialog)
- **Context menu or action buttons** on each resource item:
  - Delete button (with confirmation) for topics
  - Edit and Delete buttons (with confirmation) for subscriptions

#### 3. Topic Create Dialog (`frontend/src/components/TopicCreateDialog.tsx`)

New component for creating topics:

- Topic ID input (validates format)
- Optional message retention duration input
- Create and Cancel buttons
- Error handling and validation

#### 4. Subscription Create/Edit Dialog (`frontend/src/components/SubscriptionDialog.tsx`)

New component for creating and editing subscriptions:

- **Create mode**: Topic selector, subscription ID, all configurable fields
- **Edit mode**: Pre-filled with current values, all updatable fields
- Fields:
  - Subscription ID (create only)
  - Topic selector (create only)
  - Ack deadline (number input)
  - Retention duration (duration input)
  - Filter expression (text input, optional)
  - Dead letter policy (topic selector + max delivery attempts)
  - Subscription type (pull/push toggle)
  - Push endpoint (if push type)
- Save and Cancel buttons
- Validation and error handling

#### 5. Delete Confirmation Dialog (`frontend/src/components/DeleteConfirmDialog.tsx`)

Reusable confirmation dialog:

- Resource name and type display
- Warning message
- Confirm and Cancel buttons

#### 6. TopicDetails Component (`frontend/src/components/TopicDetails.tsx`)

Add delete button in metadata tab:

- Delete button with confirmation dialog
- Refresh topics list after deletion
- Navigate away if deleted topic was selected

#### 7. SubscriptionDetails Component (`frontend/src/components/SubscriptionDetails.tsx`)

Add edit and delete buttons in metadata tab:

- Edit button opens `SubscriptionDialog` in edit mode
- Delete button with confirmation dialog
- Refresh subscriptions list after update/delete
- Navigate away if deleted subscription was selected

#### 8. App Component (`frontend/src/App.tsx`)

Add handlers:

- `handleCreateTopic(topicID, messageRetention)`: Calls backend, refreshes list
- `handleDeleteTopic(topicID)`: Calls backend, refreshes list, clears selection if needed
- `handleCreateSubscription(params)`: Calls backend, refreshes list
- `handleUpdateSubscription(subID, updates)`: Calls backend, refreshes list
- `handleDeleteSubscription(subID)`: Calls backend, refreshes list, clears selection if needed
- Listen to Wails events for resource changes and auto-refresh

## Implementation Details

### Resource Name Normalization

Follow existing patterns in `internal/pubsub/admin/subscriptions.go`:

- Handle both full resource names (`projects/{project}/topics/{topic}`) and short names (`{topic}`)
- Extract short name from full path when needed
- Build full resource names for API calls

### Subscription Update Field Mask

Use `google.protobuf.FieldMask` to specify which fields to update:

- Only include fields that are actually being changed
- Prevents overwriting unchanged fields

### Error Handling

- Display user-friendly error messages in dialogs
- Handle permission errors gracefully
- Validate inputs client-side before API calls
- Show loading states during operations

### UI/UX Considerations

- Disable delete for subscriptions that are actively being monitored
- Show confirmation dialogs for destructive operations
- Auto-refresh resource lists after create/update/delete
- Clear selection if deleted resource was selected
- Show success notifications after successful operations

## Files to Modify

**Backend:**

- `internal/pubsub/admin/topics.go` - Add CreateTopicAdmin, DeleteTopicAdmin
- `internal/pubsub/admin/subscriptions.go` - Add UpdateSubscriptionAdmin
- `app.go` - Add Wails bindings for new operations

**Frontend:**

- `frontend/src/types/index.ts` - Add SubscriptionUpdateParams type
- `frontend/src/components/Sidebar.tsx` - Add create/delete buttons
- `frontend/src/components/TopicDetails.tsx` - Add delete button
- `frontend/src/components/SubscriptionDetails.tsx` - Add edit/delete buttons
- `frontend/src/components/TopicCreateDialog.tsx` - New component
- `frontend/src/components/SubscriptionDialog.tsx` - New component
- `frontend/src/components/DeleteConfirmDialog.tsx` - New component
- `frontend/src/App.tsx` - Add handlers and event listeners

## Testing Considerations

- Test with both full resource names and short names
- Test error cases (permissions, invalid IDs, etc.)
- Test with Pub/Sub emulator
- Verify resource lists refresh after operations
- Test that active monitors prevent subscription deletion