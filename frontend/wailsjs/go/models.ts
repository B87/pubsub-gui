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
	export class SubscriptionInfo {
	    name: string;
	    displayName: string;
	    topic: string;
	    ackDeadline: number;
	    retentionDuration: string;
	    filter?: string;
	    deadLetterPolicy?: DeadLetterPolicyInfo;
	
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

export namespace main {
	
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

}

export namespace models {
	
	export class ConnectionProfile {
	    id: string;
	    name: string;
	    projectId: string;
	    authMethod: string;
	    serviceAccountPath?: string;
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
	        this.emulatorHost = source["emulatorHost"];
	        this.isDefault = source["isDefault"];
	        this.createdAt = source["createdAt"];
	    }
	}

}

