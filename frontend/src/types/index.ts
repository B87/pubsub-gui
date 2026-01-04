// TypeScript type definitions matching Go backend structs

export interface ConnectionProfile {
  id: string;
  name: string;
  projectId: string;
  authMethod: 'ADC' | 'ServiceAccount';
  serviceAccountPath?: string;
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
}

export interface DeadLetterPolicy {
  deadLetterTopic: string;
  maxDeliveryAttempts: number;
}

export type ResourceType = 'topic' | 'subscription';

export interface SelectedResource {
  type: ResourceType;
  data: Topic | Subscription;
}
