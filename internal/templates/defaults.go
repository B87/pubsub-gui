// Package templates provides template system for creating topics and subscriptions with best practices
package templates

import (
	"pubsub-gui/internal/models"
)

// GetBuiltInTemplates returns all built-in topic/subscription templates
func GetBuiltInTemplates() []*models.TopicSubscriptionTemplate {
	return []*models.TopicSubscriptionTemplate{
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

// productionCriticalTemplate creates a template for production-critical workloads
// Features: exactly-once delivery, 30-day retention, dead letter queue
func productionCriticalTemplate() *models.TopicSubscriptionTemplate {
	return &models.TopicSubscriptionTemplate{
		ID:          "production-critical",
		Name:        "Production Critical",
		Description: "Exactly-once delivery, 30-day retention, dead letter queue. Best for financial transactions, orders, and critical business events.",
		Category:    "production",
		IsBuiltIn:   true,
		Topic: models.TopicTemplateConfig{
			MessageRetentionDuration: "720h", // 30 days
		},
		Subscriptions: []models.SubscriptionTemplateConfig{
			{
				Name:              "sub",
				AckDeadline:       60,
				RetentionDuration: "7d",
				EnableExactlyOnce: true,
				EnableOrdering:    false,
			},
		},
		DeadLetter: &models.DeadLetterTemplateConfig{
			MaxDeliveryAttempts: 5,
		},
	}
}

// productionStandardTemplate creates a template for standard production workloads
// Features: at-least-once delivery, 7-day retention, dead letter queue
func productionStandardTemplate() *models.TopicSubscriptionTemplate {
	return &models.TopicSubscriptionTemplate{
		ID:          "production-standard",
		Name:        "Production Standard",
		Description: "At-least-once delivery, 7-day retention, dead letter queue. Best for most production workloads with moderate throughput.",
		Category:    "production",
		IsBuiltIn:   true,
		Topic: models.TopicTemplateConfig{
			MessageRetentionDuration: "168h", // 7 days
		},
		Subscriptions: []models.SubscriptionTemplateConfig{
			{
				Name:              "sub",
				AckDeadline:       30,
				RetentionDuration: "7d",
				EnableExactlyOnce: false,
				EnableOrdering:    false,
			},
		},
		DeadLetter: &models.DeadLetterTemplateConfig{
			MaxDeliveryAttempts: 5,
		},
	}
}

// productionHighThroughputTemplate creates a template optimized for high throughput
// Features: at-least-once, optimized ack deadline, dead letter queue
func productionHighThroughputTemplate() *models.TopicSubscriptionTemplate {
	return &models.TopicSubscriptionTemplate{
		ID:          "production-high-throughput",
		Name:        "Production High Throughput",
		Description: "Optimized for high message volume. At-least-once delivery, shorter ack deadlines, dead letter queue.",
		Category:    "production",
		IsBuiltIn:   true,
		Topic: models.TopicTemplateConfig{
			MessageRetentionDuration: "168h", // 7 days
		},
		Subscriptions: []models.SubscriptionTemplateConfig{
			{
				Name:              "sub",
				AckDeadline:       10,
				RetentionDuration: "3d",
				EnableExactlyOnce: false,
				EnableOrdering:    false,
			},
		},
		DeadLetter: &models.DeadLetterTemplateConfig{
			MaxDeliveryAttempts: 5,
		},
	}
}

// developmentTemplate creates a template for development environments
// Features: short retention, auto-expire, no dead letter queue
func developmentTemplate() *models.TopicSubscriptionTemplate {
	return &models.TopicSubscriptionTemplate{
		ID:          "development",
		Name:        "Development",
		Description: "Short retention, auto-expiring subscriptions. Best for local development and testing.",
		Category:    "development",
		IsBuiltIn:   true,
		Topic: models.TopicTemplateConfig{
			MessageRetentionDuration: "24h", // 1 day
		},
		Subscriptions: []models.SubscriptionTemplateConfig{
			{
				Name:              "sub",
				AckDeadline:       30,
				RetentionDuration: "24h",
				EnableExactlyOnce: false,
				EnableOrdering:    false,
				ExpirationPolicy: &models.ExpirationPolicy{
					TTL: "24h", // Auto-delete after 24h idle
				},
			},
		},
		DeadLetter: nil, // No DLQ for dev
	}
}

// developmentWithDLQTemplate creates a template for development with debugging support
// Features: short retention, dead letter queue for debugging
func developmentWithDLQTemplate() *models.TopicSubscriptionTemplate {
	return &models.TopicSubscriptionTemplate{
		ID:          "development-dlq",
		Name:        "Development with DLQ",
		Description: "Development template with dead letter queue for debugging failed messages.",
		Category:    "development",
		IsBuiltIn:   true,
		Topic: models.TopicTemplateConfig{
			MessageRetentionDuration: "24h", // 1 day
		},
		Subscriptions: []models.SubscriptionTemplateConfig{
			{
				Name:              "sub",
				AckDeadline:       30,
				RetentionDuration: "24h",
				EnableExactlyOnce: false,
				EnableOrdering:    false,
				ExpirationPolicy: &models.ExpirationPolicy{
					TTL: "24h",
				},
			},
		},
		DeadLetter: &models.DeadLetterTemplateConfig{
			MaxDeliveryAttempts: 3, // Lower for dev
		},
	}
}

// eventDrivenTemplate creates a template for event-driven architectures
// Features: filtering support, moderate retention
func eventDrivenTemplate() *models.TopicSubscriptionTemplate {
	return &models.TopicSubscriptionTemplate{
		ID:          "event-driven",
		Name:        "Event Driven",
		Description: "Optimized for event-driven architectures with message filtering support.",
		Category:    "specialized",
		IsBuiltIn:   true,
		Topic: models.TopicTemplateConfig{
			MessageRetentionDuration: "168h", // 7 days
		},
		Subscriptions: []models.SubscriptionTemplateConfig{
			{
				Name:              "sub",
				AckDeadline:       30,
				RetentionDuration: "7d",
				EnableExactlyOnce: false,
				EnableOrdering:    false,
				Filter:            "", // User can add filter later
			},
		},
		DeadLetter: &models.DeadLetterTemplateConfig{
			MaxDeliveryAttempts: 5,
		},
	}
}

// batchProcessingTemplate creates a template for batch processing workloads
// Features: long ack deadlines, pull delivery
func batchProcessingTemplate() *models.TopicSubscriptionTemplate {
	return &models.TopicSubscriptionTemplate{
		ID:          "batch-processing",
		Name:        "Batch Processing",
		Description: "Optimized for batch processing with longer ack deadlines for complex processing.",
		Category:    "specialized",
		IsBuiltIn:   true,
		Topic: models.TopicTemplateConfig{
			MessageRetentionDuration: "168h", // 7 days
		},
		Subscriptions: []models.SubscriptionTemplateConfig{
			{
				Name:              "sub",
				AckDeadline:       600, // 10 minutes for batch processing
				RetentionDuration: "7d",
				EnableExactlyOnce: false,
				EnableOrdering:    false,
			},
		},
		DeadLetter: &models.DeadLetterTemplateConfig{
			MaxDeliveryAttempts: 5,
		},
	}
}

// streamingPipelineTemplate creates a template for streaming pipelines
// Features: exactly-once, ordering, dead letter queue
func streamingPipelineTemplate() *models.TopicSubscriptionTemplate {
	return &models.TopicSubscriptionTemplate{
		ID:          "streaming-pipeline",
		Name:        "Streaming Pipeline",
		Description: "Exactly-once delivery with message ordering. Best for streaming data pipelines.",
		Category:    "specialized",
		IsBuiltIn:   true,
		Topic: models.TopicTemplateConfig{
			MessageRetentionDuration: "168h", // 7 days
		},
		Subscriptions: []models.SubscriptionTemplateConfig{
			{
				Name:              "sub",
				AckDeadline:       60,
				RetentionDuration: "7d",
				EnableExactlyOnce: true,
				EnableOrdering:    true,
			},
		},
		DeadLetter: &models.DeadLetterTemplateConfig{
			MaxDeliveryAttempts: 5,
		},
	}
}

// multiTenantTemplate creates a template for multi-tenant applications
// Features: filtering enabled for tenant isolation
func multiTenantTemplate() *models.TopicSubscriptionTemplate {
	return &models.TopicSubscriptionTemplate{
		ID:          "multi-tenant",
		Name:        "Multi-Tenant",
		Description: "Designed for multi-tenant applications with message filtering for tenant isolation.",
		Category:    "specialized",
		IsBuiltIn:   true,
		Topic: models.TopicTemplateConfig{
			MessageRetentionDuration: "168h", // 7 days
		},
		Subscriptions: []models.SubscriptionTemplateConfig{
			{
				Name:              "sub",
				AckDeadline:       30,
				RetentionDuration: "7d",
				EnableExactlyOnce: false,
				EnableOrdering:    false,
				Filter:            "", // User can add tenant filter
			},
		},
		DeadLetter: &models.DeadLetterTemplateConfig{
			MaxDeliveryAttempts: 5,
		},
	}
}

// temporaryDebugTemplate creates a template for temporary debugging
// Features: very short retention, quick expiration
func temporaryDebugTemplate() *models.TopicSubscriptionTemplate {
	return &models.TopicSubscriptionTemplate{
		ID:          "temporary-debug",
		Name:        "Temporary Debug",
		Description: "Very short retention and quick expiration. Use for temporary debugging and testing.",
		Category:    "development",
		IsBuiltIn:   true,
		Topic: models.TopicTemplateConfig{
			MessageRetentionDuration: "1h", // 1 hour
		},
		Subscriptions: []models.SubscriptionTemplateConfig{
			{
				Name:              "sub",
				AckDeadline:       10,
				RetentionDuration: "1h",
				EnableExactlyOnce: false,
				EnableOrdering:    false,
				ExpirationPolicy: &models.ExpirationPolicy{
					TTL: "1h", // Auto-delete after 1h idle
				},
			},
		},
		DeadLetter: nil, // No DLQ for temporary
	}
}
