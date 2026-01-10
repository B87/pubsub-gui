export namespace admin {
	
	export class DeadLetterPolicyInfo {
	    deadLetterTopic: string;
	    maxDeliveryAttempts: number;
	
	    static createFrom(source: any = {}) {
	        return new DeadLetterPolicyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.deadLetterTopic = source["deadLetterTopic"];
	        this.maxDeliveryAttempts = source["maxDeliveryAttempts"];
	    }
	}
	export class SnapshotInfo {
	    name: string;
	    displayName: string;
	    topic: string;
	    subscription?: string;
	    expireTime: string;
	    labels?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new SnapshotInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.displayName = source["displayName"];
	        this.topic = source["topic"];
	        this.subscription = source["subscription"];
	        this.expireTime = source["expireTime"];
	        this.labels = source["labels"];
	    }
	}
	export class SubscriptionInfo {
	    name: string;
	    displayName: string;
	    topic: string;
	    ackDeadline: number;
	    retentionDuration: string;
	    filter?: string;
	    deadLetterPolicy?: DeadLetterPolicyInfo;
	    subscriptionType: string;
	    pushEndpoint?: string;
	
	    static createFrom(source: any = {}) {
	        return new SubscriptionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.displayName = source["displayName"];
	        this.topic = source["topic"];
	        this.ackDeadline = source["ackDeadline"];
	        this.retentionDuration = source["retentionDuration"];
	        this.filter = source["filter"];
	        this.deadLetterPolicy = this.convertValues(source["deadLetterPolicy"], DeadLetterPolicyInfo);
	        this.subscriptionType = source["subscriptionType"];
	        this.pushEndpoint = source["pushEndpoint"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TopicInfo {
	    name: string;
	    displayName: string;
	    messageRetention?: string;
	
	    static createFrom(source: any = {}) {
	        return new TopicInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.displayName = source["displayName"];
	        this.messageRetention = source["messageRetention"];
	    }
	}

}

export namespace app {
	
	export class ConnectionStatus {
	    isConnected: boolean;
	    projectId: string;
	    authMethod?: string;
	    emulatorHost?: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isConnected = source["isConnected"];
	        this.projectId = source["projectId"];
	        this.authMethod = source["authMethod"];
	        this.emulatorHost = source["emulatorHost"];
	    }
	}
	export class LogEntry {
	    time: string;
	    level: string;
	    msg: string;
	    fields?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new LogEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.time = source["time"];
	        this.level = source["level"];
	        this.msg = source["msg"];
	        this.fields = source["fields"];
	    }
	}
	export class FilteredLogsResult {
	    entries: LogEntry[];
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new FilteredLogsResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entries = this.convertValues(source["entries"], LogEntry);
	        this.total = source["total"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SubscriptionUpdateParams {
	    ackDeadline?: number;
	    retentionDuration?: string;
	    filter?: string;
	    deadLetterPolicy?: admin.DeadLetterPolicyInfo;
	    pushEndpoint?: string;
	    subscriptionType?: string;
	
	    static createFrom(source: any = {}) {
	        return new SubscriptionUpdateParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ackDeadline = source["ackDeadline"];
	        this.retentionDuration = source["retentionDuration"];
	        this.filter = source["filter"];
	        this.deadLetterPolicy = this.convertValues(source["deadLetterPolicy"], admin.DeadLetterPolicyInfo);
	        this.pushEndpoint = source["pushEndpoint"];
	        this.subscriptionType = source["subscriptionType"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace main {
	
	export class PublishResult {
	    messageId: string;
	    timestamp: string;
	
	    static createFrom(source: any = {}) {
	        return new PublishResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.messageId = source["messageId"];
	        this.timestamp = source["timestamp"];
	    }
	}

}

export namespace models {
	
	export class ConnectionProfile {
	    id: string;
	    name: string;
	    projectId: string;
	    authMethod: string;
	    serviceAccountPath?: string;
	    oauthClientPath?: string;
	    oauthEmail?: string;
	    emulatorHost?: string;
	    isDefault: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.projectId = source["projectId"];
	        this.authMethod = source["authMethod"];
	        this.serviceAccountPath = source["serviceAccountPath"];
	        this.oauthClientPath = source["oauthClientPath"];
	        this.oauthEmail = source["oauthEmail"];
	        this.emulatorHost = source["emulatorHost"];
	        this.isDefault = source["isDefault"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class DeadLetterTemplateConfig {
	    maxDeliveryAttempts: number;
	
	    static createFrom(source: any = {}) {
	        return new DeadLetterTemplateConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.maxDeliveryAttempts = source["maxDeliveryAttempts"];
	    }
	}
	export class ExpirationPolicy {
	    ttl: string;
	
	    static createFrom(source: any = {}) {
	        return new ExpirationPolicy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ttl = source["ttl"];
	    }
	}
	export class MessageStoragePolicy {
	    allowedPersistenceRegions?: string[];
	
	    static createFrom(source: any = {}) {
	        return new MessageStoragePolicy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.allowedPersistenceRegions = source["allowedPersistenceRegions"];
	    }
	}
	export class MessageTemplate {
	    id: string;
	    name: string;
	    topicId?: string;
	    payload: string;
	    attributes: Record<string, string>;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new MessageTemplate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.topicId = source["topicId"];
	        this.payload = source["payload"];
	        this.attributes = source["attributes"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class PushConfig {
	    endpoint: string;
	    attributes?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new PushConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.endpoint = source["endpoint"];
	        this.attributes = source["attributes"];
	    }
	}
	export class RetryPolicy {
	    minimumBackoff: string;
	    maximumBackoff: string;
	
	    static createFrom(source: any = {}) {
	        return new RetryPolicy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.minimumBackoff = source["minimumBackoff"];
	        this.maximumBackoff = source["maximumBackoff"];
	    }
	}
	export class SubscriptionTemplateConfig {
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
	
	    static createFrom(source: any = {}) {
	        return new SubscriptionTemplateConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.ackDeadline = source["ackDeadline"];
	        this.retentionDuration = source["retentionDuration"];
	        this.expirationPolicy = this.convertValues(source["expirationPolicy"], ExpirationPolicy);
	        this.retryPolicy = this.convertValues(source["retryPolicy"], RetryPolicy);
	        this.enableOrdering = source["enableOrdering"];
	        this.enableExactlyOnce = source["enableExactlyOnce"];
	        this.filter = source["filter"];
	        this.pushConfig = this.convertValues(source["pushConfig"], PushConfig);
	        this.labels = source["labels"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TemplateOverrides {
	    messageRetentionDuration?: string;
	    ackDeadline?: number;
	    maxDeliveryAttempts?: number;
	    disableDeadLetter: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TemplateOverrides(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.messageRetentionDuration = source["messageRetentionDuration"];
	        this.ackDeadline = source["ackDeadline"];
	        this.maxDeliveryAttempts = source["maxDeliveryAttempts"];
	        this.disableDeadLetter = source["disableDeadLetter"];
	    }
	}
	export class TemplateCreateRequest {
	    templateId: string;
	    baseName: string;
	    environment?: string;
	    overrides?: TemplateOverrides;
	
	    static createFrom(source: any = {}) {
	        return new TemplateCreateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.templateId = source["templateId"];
	        this.baseName = source["baseName"];
	        this.environment = source["environment"];
	        this.overrides = this.convertValues(source["overrides"], TemplateOverrides);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TemplateCreateResult {
	    success: boolean;
	    topicId: string;
	    subscriptionIds: string[];
	    deadLetterTopicId?: string;
	    deadLetterSubId?: string;
	    warnings?: string[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new TemplateCreateResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.topicId = source["topicId"];
	        this.subscriptionIds = source["subscriptionIds"];
	        this.deadLetterTopicId = source["deadLetterTopicId"];
	        this.deadLetterSubId = source["deadLetterSubId"];
	        this.warnings = source["warnings"];
	        this.error = source["error"];
	    }
	}
	
	export class TopicTemplateConfig {
	    messageRetentionDuration?: string;
	    labels?: Record<string, string>;
	    kmsKeyName?: string;
	    messageStoragePolicy?: MessageStoragePolicy;
	
	    static createFrom(source: any = {}) {
	        return new TopicTemplateConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.messageRetentionDuration = source["messageRetentionDuration"];
	        this.labels = source["labels"];
	        this.kmsKeyName = source["kmsKeyName"];
	        this.messageStoragePolicy = this.convertValues(source["messageStoragePolicy"], MessageStoragePolicy);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TopicSubscriptionTemplate {
	    id: string;
	    name: string;
	    description: string;
	    category: string;
	    isBuiltIn: boolean;
	    topic: TopicTemplateConfig;
	    subscriptions: SubscriptionTemplateConfig[];
	    deadLetter?: DeadLetterTemplateConfig;
	
	    static createFrom(source: any = {}) {
	        return new TopicSubscriptionTemplate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.category = source["category"];
	        this.isBuiltIn = source["isBuiltIn"];
	        this.topic = this.convertValues(source["topic"], TopicTemplateConfig);
	        this.subscriptions = this.convertValues(source["subscriptions"], SubscriptionTemplateConfig);
	        this.deadLetter = this.convertValues(source["deadLetter"], DeadLetterTemplateConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace subscriber {
	
	export class PubSubMessage {
	    id: string;
	    publishTime: string;
	    receiveTime: string;
	    data: string;
	    attributes: Record<string, string>;
	    deliveryAttempt?: number;
	    orderingKey?: string;
	
	    static createFrom(source: any = {}) {
	        return new PubSubMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.publishTime = source["publishTime"];
	        this.receiveTime = source["receiveTime"];
	        this.data = source["data"];
	        this.attributes = source["attributes"];
	        this.deliveryAttempt = source["deliveryAttempt"];
	        this.orderingKey = source["orderingKey"];
	    }
	}

}

export namespace version {
	
	export class UpdateInfo {
	    currentVersion: string;
	    latestVersion: string;
	    releaseNotes: string;
	    releaseUrl: string;
	    publishedAt: string;
	    isUpdateAvailable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.releaseNotes = source["releaseNotes"];
	        this.releaseUrl = source["releaseUrl"];
	        this.publishedAt = source["publishedAt"];
	        this.isUpdateAvailable = source["isUpdateAvailable"];
	    }
	}

}

