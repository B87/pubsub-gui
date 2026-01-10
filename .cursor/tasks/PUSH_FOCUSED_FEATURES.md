# Push Subscription Features - Implementation Plan

## Overview

This document outlines utilities and features that can be added to enhance push subscription management in the Pub/Sub GUI application. Push subscriptions deliver messages via HTTP POST to an endpoint, making them ideal for webhooks, Cloud Functions, and other HTTP-based integrations.

**Current State:** The app supports basic push subscription creation and viewing, but lacks advanced push-specific utilities.

**Estimated Implementation Time:** 8-12 hours (depending on features selected)

---

## Table of Contents

1. [Current State](#current-state)
2. [Proposed Features](#proposed-features)
3. [Implementation Details](#implementation-details)
4. [Priority Levels](#priority-levels)
5. [Technical Considerations](#technical-considerations)
6. [Testing Strategy](#testing-strategy)
7. [Future Enhancements](#future-enhancements)

---

## Current State

### What's Already Implemented

✅ **Basic Push Subscription Support:**
- Create push subscriptions with endpoint URL
- Edit push subscription endpoint
- View push subscription metadata
- Display push endpoint in subscription details
- Backend models support push attributes (not exposed in UI)
- Backend models support OIDC token config (not implemented)

✅ **UI Features:**
- Subscription type selector (Pull/Push) in `SubscriptionDialog.tsx`
- Push endpoint URL input field
- Push subscription type indicator in `SubscriptionDetails.tsx`
- Note that monitoring is not available for push subscriptions

### What's Missing

❌ **Push Attributes Editor** - Backend supports it, but no UI
❌ **OIDC Token Configuration** - Mentioned in templates, not implemented
❌ **Push Endpoint Validation** - No URL format or accessibility checks
❌ **Push Delivery Testing** - No way to test push delivery
❌ **Push Metrics/Monitoring** - No delivery status or metrics
❌ **Push Configuration Templates** - No pre-configured patterns
❌ **Push Endpoint Health Checks** - No periodic validation
❌ **Push Delivery Logs** - No history of delivery attempts

---

## Proposed Features

### 1. Push Attributes Editor ⭐ HIGH PRIORITY

**Description:** Add UI to configure push attributes (key-value pairs sent with each push request).

**Why It's Important:**
- Backend already supports push attributes (`PushConfig.Attributes`)
- Attributes are useful for routing, filtering, or adding metadata to push requests
- Currently requires manual config file editing

**Implementation:**

**Frontend (`SubscriptionDialog.tsx`):**
```typescript
const [pushAttributes, setPushAttributes] = useState<Array<{key: string, value: string}>>([]);

// Add after pushEndpoint field
{subscriptionType === 'push' && (
  <FormField label="Push Attributes (Optional)" helperText="Key-value pairs sent with each push request">
    <div className="space-y-2">
      {pushAttributes.map((attr, idx) => (
        <div key={idx} className="flex gap-2">
          <Input
            placeholder="Key"
            value={attr.key}
            onChange={(e) => updateAttribute(idx, 'key', e.target.value)}
            disabled={isSaving}
          />
          <Input
            placeholder="Value"
            value={attr.value}
            onChange={(e) => updateAttribute(idx, 'value', e.target.value)}
            disabled={isSaving}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeAttribute(idx)}
            disabled={isSaving}
          >
            <TrashIcon />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() => addAttribute()}
        disabled={isSaving}
      >
        Add Attribute
      </Button>
    </div>
  </FormField>
)}
```

**Backend:** Already supports attributes in `PushConfig.Attributes` - no changes needed.

**Estimated Time:** 2-3 hours

---

### 2. OIDC Token Configuration ⭐ HIGH PRIORITY

**Description:** Support authenticated push subscriptions using OIDC tokens.

**Why It's Important:**
- Required for secure push endpoints (Cloud Functions, Cloud Run, App Engine)
- GCP Pub/Sub supports OIDC authentication for push subscriptions
- Currently mentioned in templates but not implemented

**Implementation:**

**Frontend (`SubscriptionDialog.tsx`):**
```typescript
const [oidcEnabled, setOidcEnabled] = useState(false);
const [oidcServiceAccount, setOidcServiceAccount] = useState('');
const [oidcAudience, setOidcAudience] = useState('');

{subscriptionType === 'push' && (
  <>
    <FormField label="OIDC Authentication (Optional)">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={oidcEnabled}
            onCheckedChange={setOidcEnabled}
            disabled={isSaving}
          />
          <Label>Enable OIDC token authentication</Label>
        </div>
        {oidcEnabled && (
          <>
            <FormField label="Service Account Email" required={oidcEnabled}>
              <Input
                type="email"
                value={oidcServiceAccount}
                onChange={(e) => setOidcServiceAccount(e.target.value)}
                placeholder="service-account@project.iam.gserviceaccount.com"
                disabled={isSaving}
              />
            </FormField>
            <FormField label="Audience (Optional)">
              <Input
                value={oidcAudience}
                onChange={(e) => setOidcAudience(e.target.value)}
                placeholder="https://example.com"
                disabled={isSaving}
              />
            </FormField>
          </>
        )}
      </div>
    </FormField>
  </>
)}
```

**Backend (`internal/pubsub/admin/subscriptions.go`):**
```go
// Add OIDC token to PushConfig
if config.PushConfig != nil && config.PushConfig.OIDCToken != nil {
    req.PushConfig.OidcToken = &pubsubpb.PushConfig_OidcToken{
        ServiceAccountEmail: config.PushConfig.OIDCToken.ServiceAccountEmail,
    }
    if config.PushConfig.OIDCToken.Audience != "" {
        req.PushConfig.OidcToken.Audience = config.PushConfig.OIDCToken.Audience
    }
}
```

**Backend Models (`internal/models/template.go`):**
```go
type PushConfig struct {
    Endpoint   string            `json:"endpoint"`
    Attributes map[string]string `json:"attributes,omitempty"`
    OIDCToken  *OIDCTokenConfig  `json:"oidcToken,omitempty"`
}

type OIDCTokenConfig struct {
    ServiceAccountEmail string `json:"serviceAccountEmail"`
    Audience           string `json:"audience,omitempty"`
}
```

**Estimated Time:** 3-4 hours

---

### 3. Push Endpoint Validator ⭐ MEDIUM PRIORITY

**Description:** Validate push endpoint URL format and optionally test accessibility.

**Why It's Important:**
- Prevents configuration errors before subscription creation
- Validates HTTPS requirement (GCP requirement)
- Can optionally verify endpoint exists and responds

**Implementation:**

**Frontend (`SubscriptionDialog.tsx`):**
```typescript
const [endpointValidation, setEndpointValidation] = useState<{
  valid: boolean;
  error?: string;
}>({ valid: true });

const validatePushEndpoint = async (url: string) => {
  if (!url.trim()) {
    setEndpointValidation({ valid: false, error: 'Endpoint URL is required' });
    return;
  }

  // Basic URL validation
  try {
    const urlObj = new URL(url);

    // GCP requires HTTPS
    if (urlObj.protocol !== 'https:') {
      setEndpointValidation({ valid: false, error: 'Push endpoints must use HTTPS' });
      return;
    }

    // Optional: Test endpoint accessibility
    // Note: This requires CORS or backend proxy
    setEndpointValidation({ valid: true });
  } catch (e) {
    setEndpointValidation({ valid: false, error: 'Invalid URL format' });
  }
};

// In pushEndpoint Input onChange:
<Input
  type="url"
  value={pushEndpoint}
  onChange={(e) => {
    setPushEndpoint(e.target.value);
    validatePushEndpoint(e.target.value);
  }}
  error={!endpointValidation.valid}
  placeholder="https://example.com/webhook"
  disabled={isSaving}
/>
{!endpointValidation.valid && (
  <p className="text-sm text-red-500 mt-1">{endpointValidation.error}</p>
)}
```

**Backend (Optional - for endpoint testing):**
```go
func ValidatePushEndpoint(ctx context.Context, endpoint string) error {
    // Parse URL
    u, err := url.Parse(endpoint)
    if err != nil {
        return fmt.Errorf("invalid URL format: %w", err)
    }

    // Check HTTPS
    if u.Scheme != "https" {
        return fmt.Errorf("push endpoints must use HTTPS")
    }

    // Optional: Send HEAD request to verify endpoint
    // Note: This may fail due to CORS or authentication
    // Consider making this optional or async

    return nil
}
```

**Estimated Time:** 2-3 hours

---

### 4. Push Subscription Testing Tool ⭐ MEDIUM PRIORITY

**Description:** Send a test message to verify push subscription delivery.

**Why It's Important:**
- Verify push endpoint is working correctly
- Test authentication (OIDC) configuration
- Debug push delivery issues

**Implementation:**

**Frontend (`SubscriptionDetails.tsx`):**
```typescript
const [testingPush, setTestingPush] = useState(false);
const [testResult, setTestResult] = useState<{
  success: boolean;
  message?: string;
} | null>(null);

const handleTestPush = async () => {
  setTestingPush(true);
  setTestResult(null);
  try {
    // Publish a test message to the subscription's topic
    const testPayload = JSON.stringify({
      test: true,
      timestamp: new Date().toISOString(),
      source: 'pubsub-gui-test',
    });

    await PublishMessage(
      subscription.topic,
      testPayload,
      { 'test-message': 'true' }
    );

    setTestResult({
      success: true,
      message: 'Test message published. Check your endpoint for delivery.',
    });
  } catch (error: any) {
    setTestResult({
      success: false,
      message: 'Failed to send test message: ' + error.toString(),
    });
  } finally {
    setTestingPush(false);
  }
};

// In metadata tab, add button for push subscriptions:
{subscription.subscriptionType === 'push' && (
  <div className="mt-4 p-4 bg-slate-900 rounded border border-slate-700">
    <h4 className="text-sm font-medium mb-2">Test Push Delivery</h4>
    <p className="text-xs text-slate-400 mb-3">
      Send a test message to verify your push endpoint is working correctly.
    </p>
    <Button
      onClick={handleTestPush}
      loading={testingPush}
      variant="outline"
    >
      Send Test Message
    </Button>
    {testResult && (
      <Alert
        variant={testResult.success ? 'success' : 'destructive'}
        className="mt-3"
      >
        <AlertDescription>{testResult.message}</AlertDescription>
      </Alert>
    )}
  </div>
)}
```

**Estimated Time:** 1-2 hours

---

### 5. Push Configuration Templates ⭐ MEDIUM PRIORITY

**Description:** Pre-configured push subscription templates for common GCP patterns.

**Why It's Important:**
- Quick setup for common use cases
- Demonstrates best practices
- Reduces configuration errors

**Templates to Include:**

1. **Cloud Functions Template:**
   - Endpoint: `https://REGION-PROJECT.cloudfunctions.net/FUNCTION_NAME`
   - OIDC enabled with service account
   - Dead letter topic configured

2. **Cloud Run Template:**
   - Endpoint: `https://SERVICE-URL.run.app/PATH`
   - OIDC enabled
   - Retry policy configured

3. **App Engine Template:**
   - Endpoint: `https://PROJECT.appspot.com/PATH`
   - OIDC enabled
   - Standard retry policy

4. **Custom Webhook Template:**
   - User-defined endpoint
   - Optional OIDC
   - Basic retry policy

**Implementation:**

Create a template selector in `SubscriptionDialog.tsx`:
```typescript
const [pushTemplate, setPushTemplate] = useState<string>('custom');

const applyPushTemplate = (template: string) => {
  switch (template) {
    case 'cloud-functions':
      setPushEndpoint('https://REGION-PROJECT.cloudfunctions.net/FUNCTION_NAME');
      setOidcEnabled(true);
      // ... set other defaults
      break;
    case 'cloud-run':
      setPushEndpoint('https://SERVICE-URL.run.app/PATH');
      setOidcEnabled(true);
      // ... set other defaults
      break;
    // ... other templates
  }
};
```

**Estimated Time:** 3-4 hours

---

### 6. Push Endpoint Health Check ⭐ LOW PRIORITY

**Description:** Periodically check push endpoint health and display status.

**Why It's Important:**
- Proactive monitoring of endpoint availability
- Early detection of endpoint issues
- Visual indicator of endpoint health

**Implementation:**

**Backend:**
```go
func CheckPushEndpointHealth(ctx context.Context, endpoint string) (bool, error) {
    // Send HEAD request to endpoint
    req, err := http.NewRequestWithContext(ctx, "HEAD", endpoint, nil)
    if err != nil {
        return false, err
    }

    client := &http.Client{Timeout: 5 * time.Second}
    resp, err := client.Do(req)
    if err != nil {
        return false, err
    }
    defer resp.Body.Close()

    // Consider 2xx and 3xx as healthy
    return resp.StatusCode >= 200 && resp.StatusCode < 400, nil
}
```

**Frontend:**
```typescript
const [endpointHealth, setEndpointHealth] = useState<{
  healthy: boolean;
  lastChecked?: Date;
} | null>(null);

// In SubscriptionDetails.tsx, add health indicator
{subscription.subscriptionType === 'push' && subscription.pushEndpoint && (
  <div className="flex items-center gap-2">
    <span className="text-sm text-slate-400">Endpoint Health:</span>
    {endpointHealth?.healthy ? (
      <Badge variant="success">Healthy</Badge>
    ) : (
      <Badge variant="warning">Unhealthy</Badge>
    )}
    <Button
      variant="ghost"
      size="sm"
      onClick={checkEndpointHealth}
    >
      Check
    </Button>
  </div>
)}
```

**Estimated Time:** 2-3 hours

---

### 7. Push Delivery Metrics Dashboard ⭐ LOW PRIORITY

**Description:** Display push delivery metrics and statistics.

**Why It's Important:**
- Monitor push subscription performance
- Identify delivery issues
- Track success/failure rates

**Note:** This requires GCP Cloud Monitoring API integration, which may be out of scope for MVP.

**Implementation:**

Would require:
- Cloud Monitoring API integration
- Metrics collection and display
- Time-series charts
- Alert thresholds

**Estimated Time:** 8-10 hours (significant feature)

---

### 8. Push Delivery Logs Viewer ⭐ LOW PRIORITY

**Description:** View history of push delivery attempts and errors.

**Why It's Important:**
- Debug push delivery issues
- Track delivery history
- Identify patterns in failures

**Note:** This requires Cloud Logging API integration or subscription to dead letter topic.

**Implementation:**

Would require:
- Cloud Logging API integration
- Log filtering and display
- Error aggregation
- Export functionality

**Estimated Time:** 6-8 hours

---

## Priority Levels

### High Priority (Implement First)

1. **Push Attributes Editor** - Backend supports it, just needs UI
2. **OIDC Token Configuration** - Required for secure push endpoints
3. **Push Endpoint Validator** - Prevents configuration errors

**Total Estimated Time:** 7-10 hours

### Medium Priority (Nice to Have)

4. **Push Subscription Testing Tool** - Useful for debugging
5. **Push Configuration Templates** - Improves UX

**Total Estimated Time:** 4-6 hours

### Low Priority (Future Enhancements)

6. **Push Endpoint Health Check** - Nice monitoring feature
7. **Push Delivery Metrics Dashboard** - Requires Cloud Monitoring API
8. **Push Delivery Logs Viewer** - Requires Cloud Logging API

**Total Estimated Time:** 16-21 hours

---

## Technical Considerations

### Backend Changes Required

1. **OIDC Token Support:**
   - Update `PushConfig` model to include `OIDCToken`
   - Update `UpdateSubscriptionAdmin` to handle OIDC tokens
   - Update `CreateSubscriptionAdmin` to support OIDC tokens

2. **Push Endpoint Validation:**
   - Add `ValidatePushEndpoint` function
   - Consider rate limiting for health checks

3. **Push Testing:**
   - Use existing `PublishMessage` functionality
   - No new backend methods needed

### Frontend Changes Required

1. **SubscriptionDialog.tsx:**
   - Add push attributes editor
   - Add OIDC token configuration
   - Add endpoint validation
   - Add template selector

2. **SubscriptionDetails.tsx:**
   - Add push testing tool
   - Add endpoint health indicator
   - Display push-specific metadata

3. **Types:**
   - Update `PushConfig` interface to include `oidcToken`
   - Add `OIDCTokenConfig` interface

### Dependencies

- No new external dependencies required
- OIDC support uses existing GCP Pub/Sub client library
- Health checks use standard Go `net/http` package

---

## Testing Strategy

### Unit Tests

1. **Push Attributes:**
   - Test attribute serialization
   - Test empty attributes handling
   - Test attribute validation

2. **OIDC Configuration:**
   - Test OIDC token creation
   - Test audience handling
   - Test service account email validation

3. **Endpoint Validation:**
   - Test HTTPS requirement
   - Test URL format validation
   - Test invalid URL handling

### Integration Tests

1. **Create Push Subscription:**
   - With attributes
   - With OIDC token
   - With both attributes and OIDC

2. **Update Push Subscription:**
   - Change endpoint
   - Add/remove attributes
   - Enable/disable OIDC

3. **Push Testing:**
   - Send test message
   - Verify delivery (if test endpoint available)

### Manual Testing

1. **UI Testing:**
   - Test push attributes editor (add/remove)
   - Test OIDC configuration toggle
   - Test endpoint validation feedback
   - Test template application

2. **End-to-End Testing:**
   - Create push subscription with all features
   - Test push delivery to real endpoint
   - Verify OIDC authentication works

---

## Future Enhancements

### Advanced Features (Post-MVP)

1. **Push Retry Policy Visualization:**
   - Display retry intervals
   - Show exponential backoff settings
   - Visual timeline of retry attempts

2. **Push Endpoint Presets:**
   - Auto-detect Cloud Functions endpoints
   - Auto-detect Cloud Run endpoints
   - Suggest endpoint patterns

3. **Push Subscription Analytics:**
   - Delivery success rate
   - Average delivery latency
   - Error rate trends
   - Dead letter queue metrics

4. **Push Configuration Import/Export:**
   - Export push config as JSON
   - Import from existing subscription
   - Share configurations

5. **Push Endpoint Testing Suite:**
   - Test with different payloads
   - Test authentication
   - Test error handling
   - Performance testing

---

## Implementation Checklist

### Phase 1: High Priority Features

1. [ ] Implement push attributes editor in `SubscriptionDialog.tsx`
2. [ ] Add OIDC token configuration UI
3. [ ] Update backend models to support OIDC tokens
4. [ ] Update backend subscription creation/update to handle OIDC
5. [ ] Add push endpoint URL validation
6. [ ] Test push subscription creation with attributes
7. [ ] Test push subscription creation with OIDC
8. [ ] Update documentation

### Phase 2: Medium Priority Features

1. [ ] Implement push subscription testing tool
2. [ ] Create push configuration templates
3. [ ] Add template selector to `SubscriptionDialog.tsx`
4. [ ] Test template application
5. [ ] Update documentation

### Phase 3: Low Priority Features (Future)

1. [ ] Implement push endpoint health check
2. [ ] Add health indicator to `SubscriptionDetails.tsx`
3. [ ] Consider push delivery metrics dashboard
4. [ ] Consider push delivery logs viewer

---

## References

- [GCP Pub/Sub Push Subscriptions Documentation](https://cloud.google.com/pubsub/docs/push)
- [GCP Pub/Sub OIDC Authentication](https://cloud.google.com/pubsub/docs/push#authentication)
- [GCP Pub/Sub Push Attributes](https://cloud.google.com/pubsub/docs/push#attributes)
- Current implementation: `frontend/src/components/SubscriptionDialog.tsx`
- Backend models: `internal/models/template.go`
- Backend subscription admin: `internal/pubsub/admin/subscriptions.go`

---

**Last Updated:** 2026-01-06
**Status:** Planning Phase
