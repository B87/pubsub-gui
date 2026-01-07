package models

import (
	"strings"
	"testing"
)

func TestTopicSubscriptionTemplate_Validate(t *testing.T) {
	tests := []struct {
		name     string
		template TopicSubscriptionTemplate
		wantErr  bool
		errMsg   string
	}{
		{
			name: "valid template",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{
						Name:        "sub1",
						AckDeadline: 30,
					},
				},
			},
			wantErr: false,
		},
		{
			name: "empty ID",
			template: TopicSubscriptionTemplate{
				ID:   "",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
			},
			wantErr: true,
			errMsg:  "template ID cannot be empty",
		},
		{
			name: "whitespace only ID",
			template: TopicSubscriptionTemplate{
				ID:   "   ",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
			},
			wantErr: true,
			errMsg:  "template ID cannot be empty",
		},
		{
			name: "empty name",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
			},
			wantErr: true,
			errMsg:  "template name cannot be empty",
		},
		{
			name: "whitespace only name",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "   ",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
			},
			wantErr: true,
			errMsg:  "template name cannot be empty",
		},
		{
			name: "no subscriptions",
			template: TopicSubscriptionTemplate{
				ID:            "test-id",
				Name:          "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{},
			},
			wantErr: true,
			errMsg:  "template must have at least one subscription",
		},
		{
			name: "valid topic retention duration",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Topic: TopicTemplateConfig{
					MessageRetentionDuration: "168h", // 7 days
				},
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
			},
			wantErr: false,
		},
		{
			name: "invalid topic retention duration format",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Topic: TopicTemplateConfig{
					MessageRetentionDuration: "invalid",
				},
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
			},
			wantErr: true,
			errMsg:  "invalid topic retention duration",
		},
		{
			name: "topic retention too short",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Topic: TopicTemplateConfig{
					MessageRetentionDuration: "5m", // Less than 10 minutes
				},
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
			},
			wantErr: true,
			errMsg:  "topic retention must be between 10 minutes and 31 days",
		},
		{
			name: "topic retention too long",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Topic: TopicTemplateConfig{
					MessageRetentionDuration: "768h", // 32 days (more than 31 days)
				},
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
			},
			wantErr: true,
			errMsg:  "topic retention must be between 10 minutes and 31 days",
		},
		{
			name: "topic retention at minimum",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Topic: TopicTemplateConfig{
					MessageRetentionDuration: "10m",
				},
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
			},
			wantErr: false,
		},
		{
			name: "topic retention at maximum",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Topic: TopicTemplateConfig{
					MessageRetentionDuration: "744h", // 31 days
				},
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
			},
			wantErr: false,
		},
		{
			name: "empty subscription name",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "", AckDeadline: 30},
				},
			},
			wantErr: true,
			errMsg:  "subscription 0 name cannot be empty",
		},
		{
			name: "subscription ack deadline too low",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 9},
				},
			},
			wantErr: true,
			errMsg:  "subscription 0 ack deadline must be between 10 and 600 seconds",
		},
		{
			name: "subscription ack deadline too high",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 601},
				},
			},
			wantErr: true,
			errMsg:  "subscription 0 ack deadline must be between 10 and 600 seconds",
		},
		{
			name: "subscription ack deadline at minimum",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 10},
				},
			},
			wantErr: false,
		},
		{
			name: "subscription ack deadline at maximum",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 600},
				},
			},
			wantErr: false,
		},
		{
			name: "valid retry policy",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{
						Name:        "sub1",
						AckDeadline: 30,
						RetryPolicy: &RetryPolicy{
							MinimumBackoff: "10s",
							MaximumBackoff: "600s",
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "invalid retry policy minimum backoff",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{
						Name:        "sub1",
						AckDeadline: 30,
						RetryPolicy: &RetryPolicy{
							MinimumBackoff: "invalid",
							MaximumBackoff: "600s",
						},
					},
				},
			},
			wantErr: true,
			errMsg:  "subscription 0 invalid minimum backoff",
		},
		{
			name: "invalid retry policy maximum backoff",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{
						Name:        "sub1",
						AckDeadline: 30,
						RetryPolicy: &RetryPolicy{
							MinimumBackoff: "10s",
							MaximumBackoff: "invalid",
						},
					},
				},
			},
			wantErr: true,
			errMsg:  "subscription 0 invalid maximum backoff",
		},
		{
			name: "retry policy min >= max",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{
						Name:        "sub1",
						AckDeadline: 30,
						RetryPolicy: &RetryPolicy{
							MinimumBackoff: "600s",
							MaximumBackoff: "10s",
						},
					},
				},
			},
			wantErr: true,
			errMsg:  "subscription 0 minimum backoff must be less than maximum backoff",
		},
		{
			name: "retry policy min equals max",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{
						Name:        "sub1",
						AckDeadline: 30,
						RetryPolicy: &RetryPolicy{
							MinimumBackoff: "10s",
							MaximumBackoff: "10s",
						},
					},
				},
			},
			wantErr: true,
			errMsg:  "subscription 0 minimum backoff must be less than maximum backoff",
		},
		{
			name: "valid dead letter config",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
				DeadLetter: &DeadLetterTemplateConfig{
					MaxDeliveryAttempts: 10,
				},
			},
			wantErr: false,
		},
		{
			name: "dead letter max attempts too low",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
				DeadLetter: &DeadLetterTemplateConfig{
					MaxDeliveryAttempts: 4,
				},
			},
			wantErr: true,
			errMsg:  "dead letter max delivery attempts must be between 5 and 100",
		},
		{
			name: "dead letter max attempts too high",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
				DeadLetter: &DeadLetterTemplateConfig{
					MaxDeliveryAttempts: 101,
				},
			},
			wantErr: true,
			errMsg:  "dead letter max delivery attempts must be between 5 and 100",
		},
		{
			name: "dead letter max attempts at minimum",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
				DeadLetter: &DeadLetterTemplateConfig{
					MaxDeliveryAttempts: 5,
				},
			},
			wantErr: false,
		},
		{
			name: "dead letter max attempts at maximum",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
				},
				DeadLetter: &DeadLetterTemplateConfig{
					MaxDeliveryAttempts: 100,
				},
			},
			wantErr: false,
		},
		{
			name: "multiple subscriptions with one invalid",
			template: TopicSubscriptionTemplate{
				ID:   "test-id",
				Name: "Test Template",
				Subscriptions: []SubscriptionTemplateConfig{
					{Name: "sub1", AckDeadline: 30},
					{Name: "", AckDeadline: 30}, // Invalid
				},
			},
			wantErr: true,
			errMsg:  "subscription 1 name cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.template.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("TopicSubscriptionTemplate.Validate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && tt.errMsg != "" {
				if err == nil || !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("TopicSubscriptionTemplate.Validate() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}

func TestTemplateCreateRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		request TemplateCreateRequest
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid request",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "orders",
			},
			wantErr: false,
		},
		{
			name: "empty template ID",
			request: TemplateCreateRequest{
				TemplateID: "",
				BaseName:   "orders",
			},
			wantErr: true,
			errMsg:  "template ID cannot be empty",
		},
		{
			name: "whitespace only template ID",
			request: TemplateCreateRequest{
				TemplateID: "   ",
				BaseName:   "orders",
			},
			wantErr: true,
			errMsg:  "template ID cannot be empty",
		},
		{
			name: "empty base name",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "",
			},
			wantErr: true,
			errMsg:  "base name cannot be empty",
		},
		{
			name: "whitespace only base name",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "   ",
			},
			wantErr: true,
			errMsg:  "base name cannot be empty",
		},
		{
			name: "base name with uppercase",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "Orders",
			},
			wantErr: true,
			errMsg:  "base name must be lowercase",
		},
		{
			name: "base name with uppercase after trim",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "  Orders  ",
			},
			wantErr: true,
			errMsg:  "base name must be lowercase",
		},
		{
			name: "base name with invalid character underscore",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "orders_service",
			},
			wantErr: true,
			errMsg:  "base name must contain only lowercase letters, numbers, and hyphens",
		},
		{
			name: "base name with invalid character space",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "orders service",
			},
			wantErr: true,
			errMsg:  "base name must contain only lowercase letters, numbers, and hyphens",
		},
		{
			name: "base name with invalid character special char",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "orders@service",
			},
			wantErr: true,
			errMsg:  "base name must contain only lowercase letters, numbers, and hyphens",
		},
		{
			name: "valid base name with numbers",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "orders-v2",
			},
			wantErr: false,
		},
		{
			name: "valid base name with hyphens",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "user-orders-service",
			},
			wantErr: false,
		},
		{
			name: "valid base name with numbers only",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "123",
			},
			wantErr: false,
		},
		{
			name: "valid base name single letter",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "a",
			},
			wantErr: false,
		},
		{
			name: "valid base name single number",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "1",
			},
			wantErr: false,
		},
		{
			name: "base name with leading/trailing spaces fails",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "  orders  ", // Spaces cause mismatch after trim
			},
			wantErr: true,
			errMsg:  "base name must be lowercase", // Validation compares trimmed to original
		},
		{
			name: "base name starting with hyphen",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "-orders",
			},
			wantErr: false, // Hyphens are allowed
		},
		{
			name: "base name ending with hyphen",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "orders-",
			},
			wantErr: false, // Hyphens are allowed
		},
		{
			name: "base name with multiple hyphens",
			request: TemplateCreateRequest{
				TemplateID: "test-template-id",
				BaseName:   "user--orders--service",
			},
			wantErr: false, // Multiple hyphens are allowed
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.request.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("TemplateCreateRequest.Validate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && tt.errMsg != "" {
				if err == nil || !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("TemplateCreateRequest.Validate() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}

// Test helper methods for TopicSubscriptionTemplate
func TestTopicSubscriptionTemplate_validateBasicFields(t *testing.T) {
	t.Run("valid basic fields", func(t *testing.T) {
		template := &TopicSubscriptionTemplate{
			ID:   "test-id",
			Name: "Test Template",
			Subscriptions: []SubscriptionTemplateConfig{
				{Name: "sub1", AckDeadline: 30},
			},
		}
		if err := template.validateBasicFields(); err != nil {
			t.Errorf("validateBasicFields() error = %v, want nil", err)
		}
	})

	t.Run("empty ID", func(t *testing.T) {
		template := &TopicSubscriptionTemplate{
			ID:   "",
			Name: "Test Template",
			Subscriptions: []SubscriptionTemplateConfig{
				{Name: "sub1", AckDeadline: 30},
			},
		}
		err := template.validateBasicFields()
		if err == nil {
			t.Error("validateBasicFields() error = nil, want error")
		}
		if !strings.Contains(err.Error(), "template ID cannot be empty") {
			t.Errorf("validateBasicFields() error = %v, want error containing 'template ID cannot be empty'", err)
		}
	})
}

func TestTopicSubscriptionTemplate_validateTopicConfig(t *testing.T) {
	t.Run("empty retention duration", func(t *testing.T) {
		template := &TopicSubscriptionTemplate{
			Topic: TopicTemplateConfig{
				MessageRetentionDuration: "",
			},
		}
		if err := template.validateTopicConfig(); err != nil {
			t.Errorf("validateTopicConfig() with empty duration error = %v, want nil", err)
		}
	})

	t.Run("valid retention duration", func(t *testing.T) {
		template := &TopicSubscriptionTemplate{
			Topic: TopicTemplateConfig{
				MessageRetentionDuration: "168h",
			},
		}
		if err := template.validateTopicConfig(); err != nil {
			t.Errorf("validateTopicConfig() error = %v, want nil", err)
		}
	})
}

func TestTemplateCreateRequest_isValidBaseNameChar(t *testing.T) {
	request := &TemplateCreateRequest{}

	tests := []struct {
		name string
		char rune
		want bool
	}{
		{"lowercase letter", 'a', true},
		{"lowercase letter z", 'z', true},
		{"uppercase letter", 'A', false},
		{"digit", '0', true},
		{"digit 9", '9', true},
		{"hyphen", '-', true},
		{"underscore", '_', false},
		{"space", ' ', false},
		{"at sign", '@', false},
		{"period", '.', false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := request.isValidBaseNameChar(tt.char)
			if got != tt.want {
				t.Errorf("isValidBaseNameChar(%q) = %v, want %v", tt.char, got, tt.want)
			}
		})
	}
}

// Benchmark tests
func BenchmarkTopicSubscriptionTemplate_Validate(b *testing.B) {
	template := TopicSubscriptionTemplate{
		ID:   "test-id",
		Name: "Test Template",
		Subscriptions: []SubscriptionTemplateConfig{
			{
				Name:        "sub1",
				AckDeadline: 30,
				RetryPolicy: &RetryPolicy{
					MinimumBackoff: "10s",
					MaximumBackoff: "600s",
				},
			},
		},
		DeadLetter: &DeadLetterTemplateConfig{
			MaxDeliveryAttempts: 10,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = template.Validate()
	}
}

func BenchmarkTemplateCreateRequest_Validate(b *testing.B) {
	request := TemplateCreateRequest{
		TemplateID: "test-template-id",
		BaseName:   "user-orders-service",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = request.Validate()
	}
}
