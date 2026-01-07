// TypeScript type definitions matching Go backend structs

export interface ConnectionProfile {
  id: string;
  name: string;
  projectId: string;
  authMethod: 'ADC' | 'ServiceAccount' | 'OAuth';
  serviceAccountPath?: string;
  oauthClientPath?: string;
  oauthEmail?: string;
  emulatorHost?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  projectId: string;
  authMethod?: string;
  emulatorHost?: string;
}

export interface Topic {
  name: string;
  displayName: string;
  messageRetention?: string;
}

export interface Subscription {
  name: string;
  displayName: string;
  topic: string;
  ackDeadline: number;
  retentionDuration: string;
  filter?: string;
  deadLetterPolicy?: DeadLetterPolicy;
  subscriptionType: 'pull' | 'push';
  pushEndpoint?: string;
}

export interface DeadLetterPolicy {
  deadLetterTopic: string;
  maxDeliveryAttempts: number;
}

export interface SubscriptionUpdateParams {
  ackDeadline?: number;
  retentionDuration?: string;
  filter?: string;
  deadLetterPolicy?: DeadLetterPolicy;
  pushEndpoint?: string;
  subscriptionType?: 'pull' | 'push';
}

export type ResourceType = 'topic' | 'subscription';

export interface SelectedResource {
  type: ResourceType;
  data: Topic | Subscription;
}

export interface MessageTemplate {
  id: string;
  name: string;
  topicId?: string;        // Optional: link to specific topic
  payload: string;
  attributes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface PublishResult {
  messageId: string;
  timestamp: string;
}

export interface PubSubMessage {
  id: string;
  publishTime: string;           // ISO 8601
  receiveTime: string;           // ISO 8601 (local)
  data: string;                  // Decoded payload
  attributes: Record<string, string>;
  deliveryAttempt?: number;       // Optional delivery attempt count
  orderingKey?: string;           // Optional ordering key
}

// Topic/Subscription Template Types
export interface TopicSubscriptionTemplate {
  id: string;
  name: string;
  description: string;
  category: 'production' | 'development' | 'specialized';
  isBuiltIn: boolean;
  topic: TopicTemplateConfig;
  subscriptions: SubscriptionTemplateConfig[];
  deadLetter?: DeadLetterTemplateConfig;
}

export interface TopicTemplateConfig {
  messageRetentionDuration?: string;
  labels?: Record<string, string>;
  kmsKeyName?: string;
  messageStoragePolicy?: MessageStoragePolicy;
}

export interface MessageStoragePolicy {
  allowedPersistenceRegions?: string[];
}

export interface SubscriptionTemplateConfig {
  name: string;
  ackDeadline: number;
  retentionDuration?: string;
  expirationPolicy?: ExpirationPolicy;
  retryPolicy?: RetryPolicy;
  enableOrdering: boolean;
  enableExactlyOnce: boolean;
  filter?: string;
  pushConfig?: PushConfig;
  labels?: Record<string, string>;
}

export interface ExpirationPolicy {
  ttl: string;
}

export interface RetryPolicy {
  minimumBackoff: string;
  maximumBackoff: string;
}

export interface PushConfig {
  endpoint: string;
  attributes?: Record<string, string>;
}

export interface DeadLetterTemplateConfig {
  maxDeliveryAttempts: number;
}

export interface TemplateCreateRequest {
  templateId: string;
  baseName: string;
  environment?: string;
  overrides?: TemplateOverrides;
}

export interface TemplateOverrides {
  messageRetentionDuration?: string;
  ackDeadline?: number;
  maxDeliveryAttempts?: number;
  disableDeadLetter?: boolean;
}

export interface TemplateCreateResult {
  success: boolean;
  topicId?: string;
  subscriptionIds?: string[];
  deadLetterTopicId?: string;
  deadLetterSubId?: string;
  warnings?: string[];
  error?: string;
}
