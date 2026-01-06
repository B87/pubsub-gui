# Topic and Subscription Template System - Implementation Plan

## Overview

This document outlines the implementation plan for a **Template System** that allows users to create topics and subscriptions with pre-configured best practices settings. With a single template selection, users can create a complete Pub/Sub setup including topics, subscriptions, dead letter topics, and all necessary configurations.

**Estimated Implementation Time:** 6-8 hours

---

## Table of Contents

1. [Why Templates?](#why-templates)
2. [GCP Pub/Sub Best Practices Research](#gcp-pubsub-best-practices-research)
3. [Template Categories](#template-categories)
4. [Architecture Design](#architecture-design)
5. [Template Data Model](#template-data-model)
6. [Backend Implementation](#backend-implementation)
7. [Frontend Implementation](#frontend-implementation)
8. [Pre-Configured Templates](#pre-configured-templates)
9. [Template Creation Workflow](#template-creation-workflow)
10. [Testing Strategy](#testing-strategy)
11. [Migration Guide](#migration-guide)

---

## Why Templates?

### Problem Statement

Creating Pub/Sub topics and subscriptions with proper configurations is:
- **Time-consuming**: Many settings to configure manually
- **Error-prone**: Easy to forget critical settings (dead letter topics, retention, etc.)
- **Inconsistent**: Different configurations across environments
- **Not following best practices**: Users may not know optimal settings

### Solution: Template System

**One-Click Setup**: Select a template → Enter name → Everything created automatically

**Benefits:**
1. **Speed**: Create complete setups in seconds, not minutes
2. **Consistency**: Same configuration across all environments
3. **Best Practices**: Templates encode GCP recommended practices
4. **Less Errors**: Automated validation and dependency creation
5. **Learning Tool**: Templates demonstrate proper configurations

### Use Cases

| Use Case | Template | What Gets Created |
|----------|----------|-------------------|
| Production API | `production-critical` | Topic + Subscription + Dead Letter Topic + Dead Letter Subscription |
| Development Testing | `development` | Topic + Subscription (auto-expire, short retention) |
| Event Processing | `event-driven` | Topic + Multiple Subscriptions (with filtering) |
| Batch Jobs | `batch-processing` | Topic + Subscription (long ack deadline) |
| Data Pipeline | `streaming-pipeline` | Topic + Subscription + Dead Letter (exactly-once) |

---

## GCP Pub/Sub Best Practices Research

### 1. Message Retention (Topic-Level)

**Purpose**: How long messages are retained if no subscription pulls them.

**Best Practices:**
- **Production**: 7-30 days (allows recovery from subscription issues)
- **Development**: 1-2 days (cost optimization)
- **Critical Systems**: 30 days (maximum retention)
- **Default**: 7 days (good balance)

**GCP Limits:**
- Minimum: 10 minutes
- Maximum: 31 days
- Default: 7 days

### 2. Subscription Expiration Policy

**Purpose**: Automatically delete inactive subscriptions to avoid cost accumulation.

**Best Practices:**
- **Production**: Never expire (set to 0 or very long period)
- **Development/Testing**: 7-30 days of inactivity
- **Temporary/Debug**: 1-3 days
- **Default**: 31 days

**GCP Behavior:**
- Subscription deleted if no activity (pull/push) within expiration period
- Activity includes failed pull attempts

### 3. Acknowledgment Deadline

**Purpose**: How long the system waits for message acknowledgment before redelivery.

**Best Practices:**
- **Fast Processing**: 10-30 seconds
- **API Calls**: 30-60 seconds
- **Complex Processing**: 60-300 seconds
- **Batch Jobs**: 300-600 seconds (10 minutes max)
- **Default**: 60 seconds

**Tuning Guidance:**
- Set to 2x average processing time
- Monitor `oldest_unacked_message_age` metric
- Use `ModifyAckDeadline` for long-running tasks

### 4. Dead Letter Topics

**Purpose**: Handle messages that can't be processed after multiple retries.

**Best Practices:**
- **Always use for production**: Prevents message loss
- **Separate DLQ per subscription**: Easier debugging
- **Max delivery attempts**: 5-10 (balance between retries and poison messages)
- **Monitor DLQ**: Alert when messages arrive (indicates issues)

**Naming Convention:**
- Main topic: `orders-topic`
- Dead letter topic: `orders-topic-dlq`
- Dead letter subscription: `orders-topic-dlq-sub`

**Configuration:**
```go
DeadLetterPolicy{
    DeadLetterTopic:         "projects/PROJECT/topics/TOPIC-dlq",
    MaxDeliveryAttempts:     5,
}
```

### 5. Retry Policy

**Purpose**: Control retry timing and backoff.

**Best Practices:**
- **Minimum backoff**: 10 seconds (avoid thundering herd)
- **Maximum backoff**: 600 seconds (10 minutes)
- **Use exponential backoff**: Reduces load during failures
- **Default**: 10s min, 600s max

**Formula:**
```
delay = min(min_backoff * 2^attempt, max_backoff)
```

### 6. Message Ordering

**Purpose**: Guarantee message order for specific keys.

**Best Practices:**
- **Only enable when needed**: Reduces throughput
- **Use ordering keys**: Group related messages
- **One subscription per ordering requirement**: Don't mix ordered and unordered
- **Default**: Disabled (better performance)

**Use Cases:**
- User activity streams (order by user ID)
- Financial transactions (order by account)
- State machines (order by entity ID)

### 7. Exactly-Once Delivery

**Purpose**: Prevent duplicate processing of messages.

**Best Practices:**
- **Critical systems only**: Financial transactions, billing, etc.
- **Higher cost and latency**: Only use when necessary
- **Requires client support**: Use latest Pub/Sub client libraries
- **Default**: Disabled (at-least-once delivery)

**Trade-offs:**
- ✅ Guaranteed deduplication
- ❌ Higher latency (~100-200ms)
- ❌ Higher cost
- ❌ Requires supporting client library

### 8. Message Filtering

**Purpose**: Deliver only messages matching specific criteria.

**Best Practices:**
- **Filter at subscription level**: Reduces network and processing costs
- **Use for multi-tenant systems**: One topic, filtered subscriptions
- **Simple expressions**: Complex filtering should be in application
- **Default**: No filter (all messages delivered)

**Example Filters:**
```
attributes.region = "us-west1"
attributes.priority = "high"
attributes.user_type IN ("premium", "enterprise")
hasPrefix(attributes.event_type, "order.")
```

### 9. Push vs Pull Subscriptions

**Purpose**: Choose delivery mechanism.

**Best Practices:**

**Use Pull when:**
- Batch processing (pull multiple messages)
- Variable processing rates
- Need flow control
- Processing in VMs/containers
- **Most common for flexibility**

**Use Push when:**
- Serverless functions (Cloud Run, Cloud Functions)
- HTTP endpoints
- Real-time webhooks
- Low latency requirements

**Default**: Pull (more flexible)

### 10. Resource Naming Conventions

**Best Practices:**
- Use lowercase with hyphens: `order-events-topic`
- Include environment: `order-events-prod`, `order-events-dev`
- Descriptive names: `user-signup-events` not `topic1`
- Consistent suffixes: `-topic`, `-sub`, `-dlq`

**Examples:**
```
Production:
- orders-prod-topic
- orders-prod-sub
- orders-prod-dlq-topic
- orders-prod-dlq-sub

Development:
- orders-dev-topic
- orders-dev-sub
```

### 11. Cost Optimization

**Best Practices:**
- Delete unused subscriptions (set expiration)
- Use appropriate retention (don't always max out at 31 days)
- Minimize message size (compress payloads)
- Use filtering to reduce unnecessary deliveries
- Monitor quota usage

### 12. Security Best Practices

**Best Practices:**
- Use IAM for access control (not open to public)
- Separate topics per security boundary
- Encrypt sensitive data in messages
- Audit access with Cloud Logging
- Use VPC Service Controls for isolation

---

## Template Categories

### 1. Production Templates

**Characteristics:**
- Long retention (7-30 days)
- Never expire subscriptions
- Dead letter topics enabled
- Conservative settings
- High reliability

**Templates:**
- `production-critical`: Exactly-once delivery, 30-day retention, DLQ
- `production-standard`: At-least-once delivery, 7-day retention, DLQ
- `production-high-throughput`: Optimized for performance, DLQ

### 2. Development Templates

**Characteristics:**
- Short retention (1-2 days)
- Auto-expire subscriptions (7-30 days)
- No dead letter topics (optional)
- Cost-optimized

**Templates:**
- `development`: Basic setup for testing
- `development-with-dlq`: Includes dead letter for debugging

### 3. Specialized Templates

**Characteristics:**
- Optimized for specific use cases
- Pre-configured for common patterns

**Templates:**
- `event-driven`: Push delivery, filtering, low latency
- `batch-processing`: Long ack deadlines, pull delivery
- `streaming-pipeline`: Exactly-once, ordering enabled
- `multi-tenant`: Filtering enabled, multiple subscriptions
- `temporary-debug`: Very short retention, 1-day expiration

### 4. Custom Templates

**Characteristics:**
- User-defined configurations
- Saved for reuse
- Organization-specific settings

---

## Architecture Design

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Template System Architecture              │
└─────────────────────────────────────────────────────────────┘

Backend (Go):
├── internal/models/
│   └── template.go              # Template data models
├── internal/templates/
│   ├── registry.go              # Built-in template registry
│   ├── validator.go             # Template validation
│   ├── creator.go               # Template-based resource creation
│   └── defaults.go              # Default template definitions
├── internal/app/
│   └── template_handler.go      # Template management handler

Frontend (React):
├── components/
│   ├── TemplateSelector.tsx     # Template picker UI
│   ├── TemplatePreview.tsx      # Configuration preview
│   ├── TemplateWizard.tsx       # Step-by-step creation
│   └── TemplateEditor.tsx       # Custom template builder

Configuration:
└── ~/.pubsub-gui/
    ├── config.json              # User config (includes templates)
    └── templates/               # Custom template storage (optional)
```

### Data Flow

```
User Action                Backend                      GCP Pub/Sub
───────────                ───────                      ───────────
Select template ────────▶ Load template definition
Enter base name           Validate configuration
Click "Create"  ────────▶ Create topic ───────────────▶ Create topic
                          Create subscription ────────▶ Create subscription
                          Create DLQ topic ───────────▶ Create DLQ topic (if needed)
                          Create DLQ sub ─────────────▶ Create DLQ sub (if needed)
                          Sync resources
Update UI       ◀──────── Emit success events
Show success notification
```

---

## Template Data Model

### Template Structure

**File: `internal/models/template.go`**

```go
package models

import (
    "time"
)

// TopicSubscriptionTemplate represents a complete template for creating topics and subscriptions
type TopicSubscriptionTemplate struct {
    ID          string    `json:"id"`
    Name        string    `json:"name"`
    Description string    `json:"description"`
    Category    string    `json:"category"` // "production", "development", "specialized", "custom"
    IsBuiltIn   bool      `json:"isBuiltIn"`
    CreatedAt   time.Time `json:"createdAt"`
    UpdatedAt   time.Time `json:"updatedAt"`

    // Topic configuration
    TopicConfig TopicTemplateConfig `json:"topicConfig"`

    // Subscription configurations (can create multiple)
    SubscriptionConfigs []SubscriptionTemplateConfig `json:"subscriptionConfigs"`

    // Dead letter configuration
    DeadLetterConfig *DeadLetterTemplateConfig `json:"deadLetterConfig,omitempty"`
}

// TopicTemplateConfig defines topic-level settings
type TopicTemplateConfig struct {
    MessageRetentionDuration string            `json:"messageRetentionDuration"` // e.g., "168h" (7 days)
    Labels                   map[string]string `json:"labels,omitempty"`
    KMSKeyName              string            `json:"kmsKeyName,omitempty"` // For encryption
    MessageStoragePolicy    *MessageStoragePolicy `json:"messageStoragePolicy,omitempty"`
}

// MessageStoragePolicy defines where messages can be stored
type MessageStoragePolicy struct {
    AllowedPersistenceRegions []string `json:"allowedPersistenceRegions"`
}

// SubscriptionTemplateConfig defines subscription-level settings
type SubscriptionTemplateConfig struct {
    NameSuffix               string  `json:"nameSuffix"` // e.g., "sub", "worker-sub"
    AckDeadlineSeconds       int     `json:"ackDeadlineSeconds"`
    RetainAckedMessages      bool    `json:"retainAckedMessages"`
    MessageRetentionDuration string  `json:"messageRetentionDuration"`
    ExpirationPolicy         *ExpirationPolicyConfig `json:"expirationPolicy,omitempty"`
    RetryPolicy              *RetryPolicyConfig      `json:"retryPolicy,omitempty"`
    EnableMessageOrdering    bool    `json:"enableMessageOrdering"`
    EnableExactlyOnceDelivery bool   `json:"enableExactlyOnceDelivery"`
    Filter                   string  `json:"filter,omitempty"`
    PushConfig               *PushConfigTemplate `json:"pushConfig,omitempty"`
    Labels                   map[string]string `json:"labels,omitempty"`
}

// ExpirationPolicyConfig defines when subscription expires
type ExpirationPolicyConfig struct {
    TTL string `json:"ttl"` // e.g., "720h" (30 days), "0" = never
}

// RetryPolicyConfig defines retry behavior
type RetryPolicyConfig struct {
    MinimumBackoff string `json:"minimumBackoff"` // e.g., "10s"
    MaximumBackoff string `json:"maximumBackoff"` // e.g., "600s"
}

// PushConfigTemplate defines push subscription settings
type PushConfigTemplate struct {
    PushEndpoint  string            `json:"pushEndpoint,omitempty"`
    Attributes    map[string]string `json:"attributes,omitempty"`
    OIDCToken     *OIDCTokenConfig  `json:"oidcToken,omitempty"`
}

// OIDCTokenConfig for authenticated push
type OIDCTokenConfig struct {
    ServiceAccountEmail string `json:"serviceAccountEmail"`
    Audience           string `json:"audience,omitempty"`
}

// DeadLetterTemplateConfig defines dead letter topic/subscription settings
type DeadLetterTemplateConfig struct {
    Enabled              bool   `json:"enabled"`
    MaxDeliveryAttempts  int    `json:"maxDeliveryAttempts"` // e.g., 5
    TopicNameSuffix      string `json:"topicNameSuffix"`     // e.g., "-dlq"
    SubscriptionNameSuffix string `json:"subscriptionNameSuffix"` // e.g., "-dlq-sub"

    // Dead letter topic settings (usually simpler than main topic)
    MessageRetentionDuration string `json:"messageRetentionDuration"`

    // Dead letter subscription settings
    AckDeadlineSeconds       int    `json:"ackDeadlineSeconds"`
    MessageRetentionDuration2 string `json:"messageRetentionDuration2"` // For DLQ subscription
    ExpirationTTL            string `json:"expirationTtl,omitempty"`
}

// TemplateCreateRequest represents a request to create resources from template
type TemplateCreateRequest struct {
    TemplateID  string            `json:"templateId"`
    BaseName    string            `json:"baseName"` // e.g., "orders" -> "orders-topic", "orders-sub"
    Environment string            `json:"environment,omitempty"` // e.g., "prod", "dev" (appended to name)
    Overrides   *TemplateOverrides `json:"overrides,omitempty"` // Optional customizations
}

// TemplateOverrides allows customizing template settings
type TemplateOverrides struct {
    TopicRetention      *string `json:"topicRetention,omitempty"`
    AckDeadline         *int    `json:"ackDeadline,omitempty"`
    MaxDeliveryAttempts *int    `json:"maxDeliveryAttempts,omitempty"`
    DisableDeadLetter   bool    `json:"disableDeadLetter,omitempty"`
}

// TemplateCreateResult contains the result of template-based creation
type TemplateCreateResult struct {
    TopicID               string   `json:"topicId"`
    SubscriptionIDs       []string `json:"subscriptionIds"`
    DeadLetterTopicID     string   `json:"deadLetterTopicId,omitempty"`
    DeadLetterSubID       string   `json:"deadLetterSubId,omitempty"`
    ResourcesCreated      int      `json:"resourcesCreated"`
    Warnings              []string `json:"warnings,omitempty"`
}
```

---

## Backend Implementation

### Step 1: Default Templates Registry

**File: `internal/templates/defaults.go`**

```go
package templates

import (
    "pubsub-gui/internal/models"
    "time"
)

// GetBuiltInTemplates returns all built-in templates
func GetBuiltInTemplates() []models.TopicSubscriptionTemplate {
    return []models.TopicSubscriptionTemplate{
        productionCriticalTemplate(),
        productionStandardTemplate(),
        productionHighThroughputTemplate(),
        developmentTemplate(),
        developmentWithDLQTemplate(),
        eventDrivenTemplate(),
        batchProcessingTemplate(),
        streamingPipelineTemplate(),
        multiTenantTemplate(),
        temporaryDebugTemplate(),
    }
}

// productionCriticalTemplate - For mission-critical applications
func productionCriticalTemplate() models.TopicSubscriptionTemplate {
    return models.TopicSubscriptionTemplate{
        ID:          "production-critical",
        Name:        "Production Critical",
        Description: "Mission-critical production workloads with exactly-once delivery, maximum retention, and dead letter handling",
        Category:    "production",
        IsBuiltIn:   true,
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),

        TopicConfig: models.TopicTemplateConfig{
            MessageRetentionDuration: "720h", // 30 days
            Labels: map[string]string{
                "environment": "production",
                "criticality": "critical",
            },
        },

        SubscriptionConfigs: []models.SubscriptionTemplateConfig{
            {
                NameSuffix:                "sub",
                AckDeadlineSeconds:        60,
                RetainAckedMessages:       true,
                MessageRetentionDuration:  "720h", // 30 days
                ExpirationPolicy: &models.ExpirationPolicyConfig{
                    TTL: "0", // Never expire
                },
                RetryPolicy: &models.RetryPolicyConfig{
                    MinimumBackoff: "10s",
                    MaximumBackoff: "600s",
                },
                EnableMessageOrdering:     false,
                EnableExactlyOnceDelivery: true, // Key feature for critical workloads
                Labels: map[string]string{
                    "environment": "production",
                    "criticality": "critical",
                },
            },
        },

        DeadLetterConfig: &models.DeadLetterTemplateConfig{
            Enabled:                   true,
            MaxDeliveryAttempts:       5,
            TopicNameSuffix:           "dlq",
            SubscriptionNameSuffix:    "dlq-sub",
            MessageRetentionDuration:  "720h", // 30 days
            AckDeadlineSeconds:        600,    // 10 minutes for manual inspection
            MessageRetentionDuration2: "720h",
            ExpirationTTL:             "0", // Never expire
        },
    }
}

// productionStandardTemplate - For standard production workloads
func productionStandardTemplate() models.TopicSubscriptionTemplate {
    return models.TopicSubscriptionTemplate{
        ID:          "production-standard",
        Name:        "Production Standard",
        Description: "Standard production workloads with at-least-once delivery, 7-day retention, and dead letter handling",
        Category:    "production",
        IsBuiltIn:   true,
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),

        TopicConfig: models.TopicTemplateConfig{
            MessageRetentionDuration: "168h", // 7 days
            Labels: map[string]string{
                "environment": "production",
            },
        },

        SubscriptionConfigs: []models.SubscriptionTemplateConfig{
            {
                NameSuffix:                "sub",
                AckDeadlineSeconds:        60,
                RetainAckedMessages:       false,
                MessageRetentionDuration:  "168h", // 7 days
                ExpirationPolicy: &models.ExpirationPolicyConfig{
                    TTL: "0", // Never expire
                },
                RetryPolicy: &models.RetryPolicyConfig{
                    MinimumBackoff: "10s",
                    MaximumBackoff: "600s",
                },
                EnableMessageOrdering:     false,
                EnableExactlyOnceDelivery: false, // At-least-once for better performance
                Labels: map[string]string{
                    "environment": "production",
                },
            },
        },

        DeadLetterConfig: &models.DeadLetterTemplateConfig{
            Enabled:                   true,
            MaxDeliveryAttempts:       5,
            TopicNameSuffix:           "dlq",
            SubscriptionNameSuffix:    "dlq-sub",
            MessageRetentionDuration:  "168h",
            AckDeadlineSeconds:        300,
            MessageRetentionDuration2: "168h",
        },
    }
}

// productionHighThroughputTemplate - For high-volume production workloads
func productionHighThroughputTemplate() models.TopicSubscriptionTemplate {
    return models.TopicSubscriptionTemplate{
        ID:          "production-high-throughput",
        Name:        "Production High-Throughput",
        Description: "High-volume production workloads optimized for throughput with minimal overhead",
        Category:    "production",
        IsBuiltIn:   true,
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),

        TopicConfig: models.TopicTemplateConfig{
            MessageRetentionDuration: "168h", // 7 days
            Labels: map[string]string{
                "environment": "production",
                "workload":    "high-throughput",
            },
        },

        SubscriptionConfigs: []models.SubscriptionTemplateConfig{
            {
                NameSuffix:                "sub",
                AckDeadlineSeconds:        30, // Shorter for fast processing
                RetainAckedMessages:       false,
                MessageRetentionDuration:  "72h", // 3 days (cost optimization)
                ExpirationPolicy: &models.ExpirationPolicyConfig{
                    TTL: "0",
                },
                RetryPolicy: &models.RetryPolicyConfig{
                    MinimumBackoff: "5s",  // Faster retries
                    MaximumBackoff: "300s",
                },
                EnableMessageOrdering:     false, // Disabled for max throughput
                EnableExactlyOnceDelivery: false, // Disabled for max throughput
                Labels: map[string]string{
                    "environment": "production",
                    "workload":    "high-throughput",
                },
            },
        },

        DeadLetterConfig: &models.DeadLetterTemplateConfig{
            Enabled:                   true,
            MaxDeliveryAttempts:       3, // Fail fast
            TopicNameSuffix:           "dlq",
            SubscriptionNameSuffix:    "dlq-sub",
            MessageRetentionDuration:  "168h",
            AckDeadlineSeconds:        300,
            MessageRetentionDuration2: "168h",
        },
    }
}

// developmentTemplate - For development/testing
func developmentTemplate() models.TopicSubscriptionTemplate {
    return models.TopicSubscriptionTemplate{
        ID:          "development",
        Name:        "Development",
        Description: "Development and testing with short retention and auto-expiration",
        Category:    "development",
        IsBuiltIn:   true,
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),

        TopicConfig: models.TopicTemplateConfig{
            MessageRetentionDuration: "24h", // 1 day
            Labels: map[string]string{
                "environment": "development",
            },
        },

        SubscriptionConfigs: []models.SubscriptionTemplateConfig{
            {
                NameSuffix:               "sub",
                AckDeadlineSeconds:       60,
                RetainAckedMessages:      false,
                MessageRetentionDuration: "24h",
                ExpirationPolicy: &models.ExpirationPolicyConfig{
                    TTL: "168h", // 7 days of inactivity
                },
                RetryPolicy: &models.RetryPolicyConfig{
                    MinimumBackoff: "10s",
                    MaximumBackoff: "300s",
                },
                EnableMessageOrdering:     false,
                EnableExactlyOnceDelivery: false,
                Labels: map[string]string{
                    "environment": "development",
                },
            },
        },

        DeadLetterConfig: nil, // No DLQ for dev (cost savings)
    }
}

// developmentWithDLQTemplate - Development with dead letter for debugging
func developmentWithDLQTemplate() models.TopicSubscriptionTemplate {
    return models.TopicSubscriptionTemplate{
        ID:          "development-with-dlq",
        Name:        "Development with DLQ",
        Description: "Development with dead letter topic for debugging failed messages",
        Category:    "development",
        IsBuiltIn:   true,
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),

        TopicConfig: models.TopicTemplateConfig{
            MessageRetentionDuration: "48h", // 2 days
            Labels: map[string]string{
                "environment": "development",
            },
        },

        SubscriptionConfigs: []models.SubscriptionTemplateConfig{
            {
                NameSuffix:               "sub",
                AckDeadlineSeconds:       60,
                RetainAckedMessages:      false,
                MessageRetentionDuration: "48h",
                ExpirationPolicy: &models.ExpirationPolicyConfig{
                    TTL: "168h", // 7 days
                },
                RetryPolicy: &models.RetryPolicyConfig{
                    MinimumBackoff: "10s",
                    MaximumBackoff: "300s",
                },
                EnableMessageOrdering:     false,
                EnableExactlyOnceDelivery: false,
                Labels: map[string]string{
                    "environment": "development",
                },
            },
        },

        DeadLetterConfig: &models.DeadLetterTemplateConfig{
            Enabled:                   true,
            MaxDeliveryAttempts:       3,
            TopicNameSuffix:           "dlq",
            SubscriptionNameSuffix:    "dlq-sub",
            MessageRetentionDuration:  "48h",
            AckDeadlineSeconds:        600, // Long for debugging
            MessageRetentionDuration2: "48h",
            ExpirationTTL:             "168h", // Auto-delete after 7 days
        },
    }
}

// eventDrivenTemplate - For event-driven architectures
func eventDrivenTemplate() models.TopicSubscriptionTemplate {
    return models.TopicSubscriptionTemplate{
        ID:          "event-driven",
        Name:        "Event-Driven",
        Description: "Event-driven architecture with filtering support and moderate retention",
        Category:    "specialized",
        IsBuiltIn:   true,
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),

        TopicConfig: models.TopicTemplateConfig{
            MessageRetentionDuration: "168h", // 7 days
            Labels: map[string]string{
                "pattern": "event-driven",
            },
        },

        SubscriptionConfigs: []models.SubscriptionTemplateConfig{
            {
                NameSuffix:               "sub",
                AckDeadlineSeconds:       30,
                RetainAckedMessages:      false,
                MessageRetentionDuration: "72h",
                ExpirationPolicy: &models.ExpirationPolicyConfig{
                    TTL: "0",
                },
                RetryPolicy: &models.RetryPolicyConfig{
                    MinimumBackoff: "5s",
                    MaximumBackoff: "300s",
                },
                EnableMessageOrdering:     false,
                EnableExactlyOnceDelivery: false,
                Filter:                    "", // User can add filters
                Labels: map[string]string{
                    "pattern": "event-driven",
                },
            },
        },

        DeadLetterConfig: &models.DeadLetterTemplateConfig{
            Enabled:                   true,
            MaxDeliveryAttempts:       5,
            TopicNameSuffix:           "dlq",
            SubscriptionNameSuffix:    "dlq-sub",
            MessageRetentionDuration:  "168h",
            AckDeadlineSeconds:        300,
            MessageRetentionDuration2: "168h",
        },
    }
}

// batchProcessingTemplate - For batch processing workloads
func batchProcessingTemplate() models.TopicSubscriptionTemplate {
    return models.TopicSubscriptionTemplate{
        ID:          "batch-processing",
        Name:        "Batch Processing",
        Description: "Batch processing with long ack deadlines and pull delivery",
        Category:    "specialized",
        IsBuiltIn:   true,
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),

        TopicConfig: models.TopicTemplateConfig{
            MessageRetentionDuration: "168h",
            Labels: map[string]string{
                "pattern": "batch-processing",
            },
        },

        SubscriptionConfigs: []models.SubscriptionTemplateConfig{
            {
                NameSuffix:               "sub",
                AckDeadlineSeconds:       600, // 10 minutes for batch processing
                RetainAckedMessages:      false,
                MessageRetentionDuration: "168h",
                ExpirationPolicy: &models.ExpirationPolicyConfig{
                    TTL: "0",
                },
                RetryPolicy: &models.RetryPolicyConfig{
                    MinimumBackoff: "30s",
                    MaximumBackoff: "600s",
                },
                EnableMessageOrdering:     false,
                EnableExactlyOnceDelivery: false,
                Labels: map[string]string{
                    "pattern": "batch-processing",
                },
            },
        },

        DeadLetterConfig: &models.DeadLetterTemplateConfig{
            Enabled:                   true,
            MaxDeliveryAttempts:       3,
            TopicNameSuffix:           "dlq",
            SubscriptionNameSuffix:    "dlq-sub",
            MessageRetentionDuration:  "168h",
            AckDeadlineSeconds:        600,
            MessageRetentionDuration2: "168h",
        },
    }
}

// streamingPipelineTemplate - For streaming data pipelines
func streamingPipelineTemplate() models.TopicSubscriptionTemplate {
    return models.TopicSubscriptionTemplate{
        ID:          "streaming-pipeline",
        Name:        "Streaming Pipeline",
        Description: "Streaming data pipelines with exactly-once delivery and message ordering",
        Category:    "specialized",
        IsBuiltIn:   true,
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),

        TopicConfig: models.TopicTemplateConfig{
            MessageRetentionDuration: "168h",
            Labels: map[string]string{
                "pattern": "streaming-pipeline",
            },
        },

        SubscriptionConfigs: []models.SubscriptionTemplateConfig{
            {
                NameSuffix:               "sub",
                AckDeadlineSeconds:       60,
                RetainAckedMessages:      true, // For replay capabilities
                MessageRetentionDuration: "168h",
                ExpirationPolicy: &models.ExpirationPolicyConfig{
                    TTL: "0",
                },
                RetryPolicy: &models.RetryPolicyConfig{
                    MinimumBackoff: "10s",
                    MaximumBackoff: "600s",
                },
                EnableMessageOrdering:     true,  // Key for pipelines
                EnableExactlyOnceDelivery: true,  // Prevent duplicates
                Labels: map[string]string{
                    "pattern": "streaming-pipeline",
                },
            },
        },

        DeadLetterConfig: &models.DeadLetterTemplateConfig{
            Enabled:                   true,
            MaxDeliveryAttempts:       5,
            TopicNameSuffix:           "dlq",
            SubscriptionNameSuffix:    "dlq-sub",
            MessageRetentionDuration:  "168h",
            AckDeadlineSeconds:        300,
            MessageRetentionDuration2: "168h",
        },
    }
}

// multiTenantTemplate - For multi-tenant systems with filtering
func multiTenantTemplate() models.TopicSubscriptionTemplate {
    return models.TopicSubscriptionTemplate{
        ID:          "multi-tenant",
        Name:        "Multi-Tenant",
        Description: "Multi-tenant architecture with subscription filtering support",
        Category:    "specialized",
        IsBuiltIn:   true,
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),

        TopicConfig: models.TopicTemplateConfig{
            MessageRetentionDuration: "168h",
            Labels: map[string]string{
                "pattern": "multi-tenant",
            },
        },

        SubscriptionConfigs: []models.SubscriptionTemplateConfig{
            {
                NameSuffix:               "tenant-sub",
                AckDeadlineSeconds:       60,
                RetainAckedMessages:      false,
                MessageRetentionDuration: "168h",
                ExpirationPolicy: &models.ExpirationPolicyConfig{
                    TTL: "720h", // 30 days
                },
                RetryPolicy: &models.RetryPolicyConfig{
                    MinimumBackoff: "10s",
                    MaximumBackoff: "600s",
                },
                EnableMessageOrdering:     false,
                EnableExactlyOnceDelivery: false,
                Filter:                    "attributes.tenant_id = \"TENANT_ID\"", // Placeholder
                Labels: map[string]string{
                    "pattern": "multi-tenant",
                },
            },
        },

        DeadLetterConfig: &models.DeadLetterTemplateConfig{
            Enabled:                   true,
            MaxDeliveryAttempts:       5,
            TopicNameSuffix:           "dlq",
            SubscriptionNameSuffix:    "dlq-sub",
            MessageRetentionDuration:  "168h",
            AckDeadlineSeconds:        300,
            MessageRetentionDuration2: "168h",
        },
    }
}

// temporaryDebugTemplate - For temporary debugging
func temporaryDebugTemplate() models.TopicSubscriptionTemplate {
    return models.TopicSubscriptionTemplate{
        ID:          "temporary-debug",
        Name:        "Temporary Debug",
        Description: "Temporary setup for debugging with very short retention and quick expiration",
        Category:    "development",
        IsBuiltIn:   true,
        CreatedAt:   time.Now(),
        UpdatedAt:   time.Now(),

        TopicConfig: models.TopicTemplateConfig{
            MessageRetentionDuration: "1h",
            Labels: map[string]string{
                "temporary": "true",
            },
        },

        SubscriptionConfigs: []models.SubscriptionTemplateConfig{
            {
                NameSuffix:               "debug-sub",
                AckDeadlineSeconds:       60,
                RetainAckedMessages:      false,
                MessageRetentionDuration: "1h",
                ExpirationPolicy: &models.ExpirationPolicyConfig{
                    TTL: "24h", // Delete after 1 day of inactivity
                },
                RetryPolicy: &models.RetryPolicyConfig{
                    MinimumBackoff: "10s",
                    MaximumBackoff: "60s",
                },
                EnableMessageOrdering:     false,
                EnableExactlyOnceDelivery: false,
                Labels: map[string]string{
                    "temporary": "true",
                },
            },
        },

        DeadLetterConfig: nil, // No DLQ for temporary debug
    }
}
```

### Step 2: Template Registry

**File: `internal/templates/registry.go`**

```go
package templates

import (
    "fmt"
    "sync"

    "pubsub-gui/internal/models"
)

// Registry manages template storage and retrieval
type Registry struct {
    mu              sync.RWMutex
    builtInTemplates map[string]models.TopicSubscriptionTemplate
    customTemplates  map[string]models.TopicSubscriptionTemplate
}

// NewRegistry creates a new template registry
func NewRegistry() *Registry {
    registry := &Registry{
        builtInTemplates: make(map[string]models.TopicSubscriptionTemplate),
        customTemplates:  make(map[string]models.TopicSubscriptionTemplate),
    }

    // Load built-in templates
    for _, tmpl := range GetBuiltInTemplates() {
        registry.builtInTemplates[tmpl.ID] = tmpl
    }

    return registry
}

// GetTemplate retrieves a template by ID
func (r *Registry) GetTemplate(id string) (*models.TopicSubscriptionTemplate, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()

    // Check built-in templates first
    if tmpl, ok := r.builtInTemplates[id]; ok {
        return &tmpl, nil
    }

    // Check custom templates
    if tmpl, ok := r.customTemplates[id]; ok {
        return &tmpl, nil
    }

    return nil, fmt.Errorf("template not found: %s", id)
}

// ListTemplates returns all templates (built-in + custom)
func (r *Registry) ListTemplates() []models.TopicSubscriptionTemplate {
    r.mu.RLock()
    defer r.mu.RUnlock()

    templates := make([]models.TopicSubscriptionTemplate, 0, len(r.builtInTemplates)+len(r.customTemplates))

    for _, tmpl := range r.builtInTemplates {
        templates = append(templates, tmpl)
    }

    for _, tmpl := range r.customTemplates {
        templates = append(templates, tmpl)
    }

    return templates
}

// ListTemplatesByCategory returns templates filtered by category
func (r *Registry) ListTemplatesByCategory(category string) []models.TopicSubscriptionTemplate {
    all := r.ListTemplates()
    filtered := make([]models.TopicSubscriptionTemplate, 0)

    for _, tmpl := range all {
        if tmpl.Category == category {
            filtered = append(filtered, tmpl)
        }
    }

    return filtered
}

// AddCustomTemplate adds a user-defined template
func (r *Registry) AddCustomTemplate(template models.TopicSubscriptionTemplate) error {
    r.mu.Lock()
    defer r.mu.Unlock()

    // Validate template
    if err := ValidateTemplate(&template); err != nil {
        return fmt.Errorf("invalid template: %w", err)
    }

    // Ensure it's marked as custom
    template.IsBuiltIn = false

    r.customTemplates[template.ID] = template
    return nil
}

// DeleteCustomTemplate removes a custom template
func (r *Registry) DeleteCustomTemplate(id string) error {
    r.mu.Lock()
    defer r.mu.Unlock()

    // Don't allow deleting built-in templates
    if _, ok := r.builtInTemplates[id]; ok {
        return fmt.Errorf("cannot delete built-in template")
    }

    delete(r.customTemplates, id)
    return nil
}
```

### Step 3: Template Validator

**File: `internal/templates/validator.go`**

```go
package templates

import (
    "fmt"
    "regexp"
    "time"

    "pubsub-gui/internal/models"
)

var (
    // Valid name pattern (lowercase, numbers, hyphens)
    namePattern = regexp.MustCompile(`^[a-z0-9-]+$`)
)

// ValidateTemplate validates a template configuration
func ValidateTemplate(tmpl *models.TopicSubscriptionTemplate) error {
    if tmpl.ID == "" {
        return fmt.Errorf("template ID cannot be empty")
    }

    if tmpl.Name == "" {
        return fmt.Errorf("template name cannot be empty")
    }

    // Validate topic config
    if err := validateTopicConfig(&tmpl.TopicConfig); err != nil {
        return fmt.Errorf("invalid topic config: %w", err)
    }

    // Validate subscription configs
    if len(tmpl.SubscriptionConfigs) == 0 {
        return fmt.Errorf("at least one subscription config required")
    }

    for i, subConfig := range tmpl.SubscriptionConfigs {
        if err := validateSubscriptionConfig(&subConfig); err != nil {
            return fmt.Errorf("invalid subscription config %d: %w", i, err)
        }
    }

    // Validate dead letter config
    if tmpl.DeadLetterConfig != nil {
        if err := validateDeadLetterConfig(tmpl.DeadLetterConfig); err != nil {
            return fmt.Errorf("invalid dead letter config: %w", err)
        }
    }

    return nil
}

func validateTopicConfig(config *models.TopicTemplateConfig) error {
    // Validate retention duration
    if config.MessageRetentionDuration != "" {
        duration, err := time.ParseDuration(config.MessageRetentionDuration)
        if err != nil {
            return fmt.Errorf("invalid message retention duration: %w", err)
        }

        // GCP limits: 10 minutes to 31 days
        if duration < 10*time.Minute || duration > 31*24*time.Hour {
            return fmt.Errorf("retention must be between 10 minutes and 31 days")
        }
    }

    return nil
}

func validateSubscriptionConfig(config *models.SubscriptionTemplateConfig) error {
    // Validate ack deadline
    if config.AckDeadlineSeconds < 10 || config.AckDeadlineSeconds > 600 {
        return fmt.Errorf("ack deadline must be between 10 and 600 seconds")
    }

    // Validate retention duration
    if config.MessageRetentionDuration != "" {
        duration, err := time.ParseDuration(config.MessageRetentionDuration)
        if err != nil {
            return fmt.Errorf("invalid message retention duration: %w", err)
        }

        if duration < 10*time.Minute || duration > 31*24*time.Hour {
            return fmt.Errorf("retention must be between 10 minutes and 31 days")
        }
    }

    // Validate retry policy
    if config.RetryPolicy != nil {
        if err := validateRetryPolicy(config.RetryPolicy); err != nil {
            return fmt.Errorf("invalid retry policy: %w", err)
        }
    }

    return nil
}

func validateRetryPolicy(policy *models.RetryPolicyConfig) error {
    minBackoff, err := time.ParseDuration(policy.MinimumBackoff)
    if err != nil {
        return fmt.Errorf("invalid minimum backoff: %w", err)
    }

    maxBackoff, err := time.ParseDuration(policy.MaximumBackoff)
    if err != nil {
        return fmt.Errorf("invalid maximum backoff: %w", err)
    }

    if minBackoff >= maxBackoff {
        return fmt.Errorf("minimum backoff must be less than maximum backoff")
    }

    return nil
}

func validateDeadLetterConfig(config *models.DeadLetterTemplateConfig) error {
    if config.MaxDeliveryAttempts < 5 || config.MaxDeliveryAttempts > 100 {
        return fmt.Errorf("max delivery attempts must be between 5 and 100")
    }

    return nil
}
```

### Step 4: Template Creator

**File: `internal/templates/creator.go`**

```go
package templates

import (
    "context"
    "fmt"

    "cloud.google.com/go/pubsub/v2"
    "pubsub-gui/internal/models"
    "pubsub-gui/internal/pubsub/admin"
)

// Creator handles creating resources from templates
type Creator struct {
    client    *pubsub.Client
    projectID string
    registry  *Registry
}

// NewCreator creates a new template creator
func NewCreator(client *pubsub.Client, projectID string, registry *Registry) *Creator {
    return &Creator{
        client:    client,
        projectID: projectID,
        registry:  registry,
    }
}

// CreateFromTemplate creates all resources from a template
func (c *Creator) CreateFromTemplate(ctx context.Context, req models.TemplateCreateRequest) (*models.TemplateCreateResult, error) {
    // Get template
    template, err := c.registry.GetTemplate(req.TemplateID)
    if err != nil {
        return nil, err
    }

    // Build resource names
    baseName := req.BaseName
    if req.Environment != "" {
        baseName = fmt.Sprintf("%s-%s", req.BaseName, req.Environment)
    }

    topicName := fmt.Sprintf("%s-topic", baseName)
    result := &models.TemplateCreateResult{
        TopicID: topicName,
    }

    // Step 1: Create dead letter topic and subscription (if needed)
    var deadLetterTopicName string
    if template.DeadLetterConfig != nil && template.DeadLetterConfig.Enabled {
        if !req.Overrides.DisableDeadLetter {
            dlTopicName, dlSubName, err := c.createDeadLetterResources(ctx, baseName, template.DeadLetterConfig)
            if err != nil {
                return nil, fmt.Errorf("failed to create dead letter resources: %w", err)
            }
            deadLetterTopicName = dlTopicName
            result.DeadLetterTopicID = dlTopicName
            result.DeadLetterSubID = dlSubName
            result.ResourcesCreated += 2
        }
    }

    // Step 2: Create main topic
    if err := c.createTopic(ctx, topicName, &template.TopicConfig, req.Overrides); err != nil {
        return nil, fmt.Errorf("failed to create topic: %w", err)
    }
    result.ResourcesCreated++

    // Step 3: Create subscriptions
    for _, subConfig := range template.SubscriptionConfigs {
        subName := fmt.Sprintf("%s-%s", baseName, subConfig.NameSuffix)

        if err := c.createSubscription(ctx, topicName, subName, &subConfig, deadLetterTopicName, template.DeadLetterConfig, req.Overrides); err != nil {
            return nil, fmt.Errorf("failed to create subscription %s: %w", subName, err)
        }

        result.SubscriptionIDs = append(result.SubscriptionIDs, subName)
        result.ResourcesCreated++
    }

    return result, nil
}

func (c *Creator) createDeadLetterResources(ctx context.Context, baseName string, dlConfig *models.DeadLetterTemplateConfig) (string, string, error) {
    topicName := fmt.Sprintf("%s-%s", baseName, dlConfig.TopicNameSuffix)
    subName := fmt.Sprintf("%s-%s", baseName, dlConfig.SubscriptionNameSuffix)

    // Create DLQ topic
    topicConfig := models.TopicTemplateConfig{
        MessageRetentionDuration: dlConfig.MessageRetentionDuration,
        Labels: map[string]string{
            "dead-letter": "true",
        },
    }

    if err := c.createTopic(ctx, topicName, &topicConfig, nil); err != nil {
        return "", "", err
    }

    // Create DLQ subscription
    subConfig := models.SubscriptionTemplateConfig{
        AckDeadlineSeconds:       dlConfig.AckDeadlineSeconds,
        MessageRetentionDuration: dlConfig.MessageRetentionDuration2,
        ExpirationPolicy: &models.ExpirationPolicyConfig{
            TTL: dlConfig.ExpirationTTL,
        },
        Labels: map[string]string{
            "dead-letter": "true",
        },
    }

    if err := c.createSubscription(ctx, topicName, subName, &subConfig, "", nil, nil); err != nil {
        return "", "", err
    }

    return topicName, subName, nil
}

func (c *Creator) createTopic(ctx context.Context, topicName string, config *models.TopicTemplateConfig, overrides *models.TemplateOverrides) error {
    retention := config.MessageRetentionDuration
    if overrides != nil && overrides.TopicRetention != nil {
        retention = *overrides.TopicRetention
    }

    return admin.CreateTopicWithConfig(ctx, c.client, c.projectID, topicName, retention, config.Labels)
}

func (c *Creator) createSubscription(ctx context.Context, topicName, subName string, config *models.SubscriptionTemplateConfig, deadLetterTopic string, dlConfig *models.DeadLetterTemplateConfig, overrides *models.TemplateOverrides) error {
    // Build subscription configuration
    ackDeadline := config.AckDeadlineSeconds
    if overrides != nil && overrides.AckDeadline != nil {
        ackDeadline = *overrides.AckDeadline
    }

    maxDeliveryAttempts := 0
    if dlConfig != nil && deadLetterTopic != "" {
        maxDeliveryAttempts = dlConfig.MaxDeliveryAttempts
        if overrides != nil && overrides.MaxDeliveryAttempts != nil {
            maxDeliveryAttempts = *overrides.MaxDeliveryAttempts
        }
    }

    return admin.CreateSubscriptionWithConfig(ctx, c.client, c.projectID, topicName, subName, admin.SubscriptionConfig{
        AckDeadlineSeconds:        ackDeadline,
        RetainAckedMessages:       config.RetainAckedMessages,
        MessageRetentionDuration:  config.MessageRetentionDuration,
        ExpirationTTL:             config.ExpirationPolicy.TTL,
        EnableMessageOrdering:     config.EnableMessageOrdering,
        EnableExactlyOnceDelivery: config.EnableExactlyOnceDelivery,
        Filter:                    config.Filter,
        DeadLetterTopic:           deadLetterTopic,
        MaxDeliveryAttempts:       maxDeliveryAttempts,
        Labels:                    config.Labels,
        RetryMinimumBackoff:       config.RetryPolicy.MinimumBackoff,
        RetryMaximumBackoff:       config.RetryPolicy.MaximumBackoff,
    })
}
```

### Step 5: App Methods

**Update `app.go`:**

```go
// Add to App struct
templateRegistry *templates.Registry

// In NewApp:
func NewApp() *App {
    return &App{
        activeMonitors:   make(map[string]*subscriber.MessageStreamer),
        topicMonitors:    make(map[string]string),
        templateRegistry: templates.NewRegistry(),
    }
}

// GetTopicSubscriptionTemplates returns all available templates
func (a *App) GetTopicSubscriptionTemplates() []models.TopicSubscriptionTemplate {
    return a.templateRegistry.ListTemplates()
}

// GetTopicSubscriptionTemplatesByCategory returns templates by category
func (a *App) GetTopicSubscriptionTemplatesByCategory(category string) []models.TopicSubscriptionTemplate {
    return a.templateRegistry.ListTemplatesByCategory(category)
}

// CreateFromTemplate creates topics and subscriptions from a template
func (a *App) CreateFromTemplate(req models.TemplateCreateRequest) (*models.TemplateCreateResult, error) {
    client := a.clientManager.GetClient()
    if client == nil {
        return nil, models.ErrNotConnected
    }

    projectID := a.clientManager.GetProjectID()
    creator := templates.NewCreator(client, projectID, a.templateRegistry)

    result, err := creator.CreateFromTemplate(a.ctx, req)
    if err != nil {
        return nil, err
    }

    // Sync resources after creation
    go a.resources.SyncResources()

    // Emit events
    runtime.EventsEmit(a.ctx, "template:created", map[string]interface{}{
        "baseName":        req.BaseName,
        "templateId":      req.TemplateID,
        "resourcesCreated": result.ResourcesCreated,
    })

    return result, nil
}

// SaveCustomTemplate saves a user-defined template
func (a *App) SaveCustomTemplate(template models.TopicSubscriptionTemplate) error {
    return a.templateRegistry.AddCustomTemplate(template)
}

// DeleteCustomTemplate deletes a user-defined template
func (a *App) DeleteCustomTemplate(templateID string) error {
    return a.templateRegistry.DeleteCustomTemplate(templateID)
}
```

---

## Frontend Implementation

### Step 1: Template Selector Component

**File: `frontend/src/components/TemplateSelector.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { GetTopicSubscriptionTemplates, CreateFromTemplate } from '../../wailsjs/go/main/App';
import { models } from '../../wailsjs/go/models';
import TemplatePreview from './TemplatePreview';

interface TemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TemplateSelector({ open, onClose, onSuccess }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<models.TopicSubscriptionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<models.TopicSubscriptionTemplate | null>(null);
  const [baseName, setBaseName] = useState('');
  const [environment, setEnvironment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'select' | 'configure' | 'preview'>('select');

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    try {
      const tmplList = await GetTopicSubscriptionTemplates();
      setTemplates(tmplList || []);
    } catch (e: any) {
      setError(e.toString());
    }
  };

  const handleTemplateSelect = (template: models.TopicSubscriptionTemplate) => {
    setSelectedTemplate(template);
    setStep('configure');
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !baseName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await CreateFromTemplate({
        templateId: selectedTemplate.id,
        baseName: baseName.trim(),
        environment: environment.trim() || undefined,
        overrides: undefined,
      });

      console.log('Created resources:', result);
      onSuccess();
      onClose();
      resetForm();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedTemplate(null);
    setBaseName('');
    setEnvironment('');
    setStep('select');
    setError('');
  };

  if (!open) return null;

  // Group templates by category
  const categorized = templates.reduce((acc, tmpl) => {
    if (!acc[tmpl.category]) {
      acc[tmpl.category] = [];
    }
    acc[tmpl.category].push(tmpl);
    return acc;
  }, {} as Record<string, models.TopicSubscriptionTemplate[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border-primary)',
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Create from Template</h2>
              <p className="text-sm text-slate-400 mt-1">
                {step === 'select' && 'Select a template to get started'}
                {step === 'configure' && `Configuring: ${selectedTemplate?.name}`}
                {step === 'preview' && 'Review and create'}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select' && (
            <div className="space-y-6">
              {Object.entries(categorized).map(([category, tmpls]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold capitalize mb-3">{category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tmpls.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => handleTemplateSelect(tmpl)}
                        className="text-left p-4 rounded-lg border border-slate-700 hover:border-blue-500 hover:bg-slate-700/50 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white">{tmpl.name}</h4>
                            <p className="text-sm text-slate-400 mt-1">{tmpl.description}</p>
                          </div>
                          {tmpl.isBuiltIn && (
                            <span className="ml-2 px-2 py-1 text-xs bg-blue-900/50 text-blue-300 rounded">
                              Built-in
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex gap-2 text-xs">
                          <span className="px-2 py-1 bg-slate-700 rounded">
                            {tmpl.subscriptionConfigs.length} subscription(s)
                          </span>
                          {tmpl.deadLetterConfig?.enabled && (
                            <span className="px-2 py-1 bg-amber-900/50 text-amber-300 rounded">
                              + DLQ
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'configure' && selectedTemplate && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Base Name</label>
                <input
                  type="text"
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                  placeholder="orders, events, notifications"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="mt-1 text-xs text-slate-400">
                  Will create: {baseName || 'base'}-topic, {baseName || 'base'}-sub
                  {selectedTemplate.deadLetterConfig?.enabled && `, ${baseName || 'base'}-dlq, ${baseName || 'base'}-dlq-sub`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Environment (Optional)</label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  <option value="prod">Production</option>
                  <option value="dev">Development</option>
                  <option value="staging">Staging</option>
                  <option value="test">Test</option>
                </select>
                {environment && (
                  <p className="mt-1 text-xs text-slate-400">
                    Will create: {baseName || 'base'}-{environment}-topic
                  </p>
                )}
              </div>

              {/* Configuration Preview */}
              <div className="mt-6 p-4 bg-slate-900 rounded-lg">
                <h4 className="font-semibold mb-3">Configuration Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Topic Retention:</span>
                    <span>{selectedTemplate.topicConfig.messageRetentionDuration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subscriptions:</span>
                    <span>{selectedTemplate.subscriptionConfigs.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ack Deadline:</span>
                    <span>{selectedTemplate.subscriptionConfigs[0]?.ackDeadlineSeconds}s</span>
                  </div>
                  {selectedTemplate.deadLetterConfig?.enabled && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Dead Letter:</span>
                        <span className="text-green-400">Enabled</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Max Retries:</span>
                        <span>{selectedTemplate.deadLetterConfig.maxDeliveryAttempts}</span>
                      </div>
                    </>
                  )}
                  {selectedTemplate.subscriptionConfigs[0]?.enableExactlyOnceDelivery && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Exactly-Once:</span>
                      <span className="text-green-400">Enabled</span>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-between">
          <button
            onClick={() => {
              if (step === 'configure') {
                setStep('select');
                setSelectedTemplate(null);
              } else {
                onClose();
                resetForm();
              }
            }}
            disabled={loading}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            {step === 'select' ? 'Cancel' : 'Back'}
          </button>

          {step === 'configure' && (
            <button
              onClick={handleCreate}
              disabled={!baseName.trim() || loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-md transition-colors font-medium"
            >
              {loading ? 'Creating...' : 'Create Resources'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Add to Main UI

**Update `frontend/src/components/CommandBar.tsx`:**

```typescript
// Add template creation action
const actions: CommandBarAction[] = [
  // ... existing actions ...
  {
    id: 'create-from-template',
    name: 'Create from Template',
    description: 'Create topic and subscription from template',
    icon: '📋',
    shortcut: 'mod+t',
    category: 'create',
    action: () => setShowTemplateSelector(true),
  },
];
```

---

## Pre-Configured Templates

See the "Default Templates Registry" section above for complete implementations of:

1. ✅ **Production Critical**: Exactly-once, 30-day retention, DLQ
2. ✅ **Production Standard**: At-least-once, 7-day retention, DLQ
3. ✅ **Production High-Throughput**: Optimized performance, DLQ
4. ✅ **Development**: Short retention, auto-expire, no DLQ
5. ✅ **Development with DLQ**: Debugging-friendly with DLQ
6. ✅ **Event-Driven**: Filtering support, moderate retention
7. ✅ **Batch Processing**: Long ack deadlines, pull delivery
8. ✅ **Streaming Pipeline**: Exactly-once, ordering, DLQ
9. ✅ **Multi-Tenant**: Filtering enabled, multiple subscriptions
10. ✅ **Temporary Debug**: Very short retention, quick expiration

---

## Template Creation Workflow

### User Journey

```
1. User clicks "Create from Template"
   │
   ▼
2. Template selection screen shows
   ├─ Production templates
   ├─ Development templates
   └─ Specialized templates
   │
   ▼
3. User selects "Production Standard"
   │
   ▼
4. Configuration screen shows
   ├─ Base name input: "orders"
   ├─ Environment dropdown: "prod"
   └─ Preview of what will be created
   │
   ▼
5. User clicks "Create Resources"
   │
   ▼
6. Backend creates (in order):
   ├─ orders-prod-dlq (dead letter topic)
   ├─ orders-prod-dlq-sub (dead letter subscription)
   ├─ orders-prod-topic (main topic)
   └─ orders-prod-sub (main subscription)
   │
   ▼
7. Success notification shows
   ├─ "Created 4 resources"
   └─ Resources appear in sidebar
```

### Error Handling

**Partial Failure Strategy:**
- If DLQ creation fails → Abort entire operation
- If topic creation fails → Delete created DLQ resources
- If subscription creation fails → Keep topic, delete subscription, warn user
- Always rollback to clean state on error

---

## Testing Strategy

### Unit Tests

**Template Validation:**
```go
func TestTemplateValidation(t *testing.T) {
    // Test valid template
    tmpl := productionStandardTemplate()
    err := ValidateTemplate(&tmpl)
    assert.NoError(t, err)

    // Test invalid retention
    tmpl.TopicConfig.MessageRetentionDuration = "1000h" // > 31 days
    err = ValidateTemplate(&tmpl)
    assert.Error(t, err)
}
```

**Template Creation:**
```go
func TestTemplateCreation(t *testing.T) {
    // Mock Pub/Sub client
    // Test creating resources from template
    // Verify all resources created correctly
}
```

### Integration Tests

**End-to-End Template Flow:**
1. Select template via UI
2. Enter base name
3. Click create
4. Verify all resources exist in GCP
5. Verify resource configurations match template
6. Clean up resources

### Manual Testing Checklist

- [ ] All built-in templates load correctly
- [ ] Template preview shows correct configuration
- [ ] Base name validation works
- [ ] Environment suffix appends correctly
- [ ] Dead letter resources created in correct order
- [ ] All configurations applied correctly
- [ ] Resources appear in sidebar after creation
- [ ] Error handling works (invalid name, duplicate resources)
- [ ] Custom templates can be created
- [ ] Custom templates can be deleted

---

## Migration Guide

### For Existing Users

**No Migration Needed**: Templates are a new feature that doesn't affect existing topics/subscriptions.

**Optional**: Convert existing setups to templates for future use.

### Creating Custom Templates from Existing Resources

Users can analyze their existing production setups and create custom templates:

1. Inspect existing topic/subscription configurations
2. Create custom template with those settings
3. Use template for new environments

---

## Implementation Checklist

### Backend Tasks

- [ ] Create `internal/models/template.go` with data models
- [ ] Create `internal/templates/defaults.go` with built-in templates
- [ ] Create `internal/templates/registry.go` for template management
- [ ] Create `internal/templates/validator.go` for validation
- [ ] Create `internal/templates/creator.go` for resource creation
- [ ] Update `app.go` with template methods
- [ ] Add template creation to `internal/pubsub/admin/`
- [ ] Unit tests for validation
- [ ] Unit tests for creation logic
- [ ] Integration tests with mock Pub/Sub

### Frontend Tasks

- [ ] Create TypeScript types for templates
- [ ] Create `TemplateSelector.tsx` component
- [ ] Create `TemplatePreview.tsx` component
- [ ] Add template action to CommandBar
- [ ] Add "Create from Template" button to UI
- [ ] Handle template creation events
- [ ] Error handling and validation
- [ ] Success notifications
- [ ] Loading states
- [ ] Test all templates in UI

### Documentation Tasks

- [ ] Update `CLAUDE.md` with template documentation
- [ ] Add template usage guide to README
- [ ] Document each built-in template
- [ ] Add custom template creation guide
- [ ] Update API reference
- [ ] Add troubleshooting section

### Testing Tasks

- [ ] Test each built-in template
- [ ] Test environment suffixes
- [ ] Test dead letter creation
- [ ] Test error rollback
- [ ] Test on all platforms (macOS, Windows, Linux)
- [ ] Performance testing (create 10+ resources)

---

## Timeline Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Backend Models** | 1 hour | Data models, validation |
| **Built-in Templates** | 2 hours | 10 template definitions |
| **Template Registry** | 1 hour | Registry, storage, retrieval |
| **Resource Creator** | 2 hours | Creation logic, error handling |
| **Frontend UI** | 2 hours | Template selector, preview |
| **Testing** | 1 hour | Unit tests, integration tests |
| **Documentation** | 1 hour | Update docs, examples |
| **Total** | **10 hours** | Complete implementation |

---

## Future Enhancements

### Phase 2 Features

1. **Template Import/Export**
   - Export custom templates to JSON
   - Import templates from file
   - Share templates across team

2. **Template Versioning**
   - Track template changes over time
   - Rollback to previous versions
   - Compare template versions

3. **Template Analytics**
   - Track template usage
   - Most popular templates
   - Success/failure rates

4. **Advanced Customization**
   - Override any template setting
   - Conditional configurations
   - Variable substitution

5. **Terraform Integration**
   - Generate Terraform code from templates
   - Export infrastructure as code
   - CI/CD integration

---

**Last Updated:** 2026-01-07
**Status:** Implementation Plan
**Target Release:** v2.1.0 (Template System)
