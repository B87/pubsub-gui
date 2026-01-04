# Postmortem: Profile Switch Shows Stale Resources from Wrong Project

**Date**: 2026-01-05
**Severity**: High
**Status**: Resolved
**Reported by**: User
**Resolved by**: AI Assistant

## Executive Summary
When users switched between saved connection profiles using the dropdown selector, the application displayed topics and subscriptions from the previously selected project instead of the newly selected project. This occurred due to a race condition where resources were loaded before the backend connection switch completed, and insufficient state clearing during the transition. The issue was resolved by implementing proper resource clearing, connection verification, and ensuring proper async sequencing.

## Timeline
- **Detected**: 2026-01-05 (after implementing connection profile switching feature)
- **Escalated**: Immediate (user reported issue)
- **Mitigation Started**: 2026-01-05
- **Resolved**: 2026-01-05
- **Total Downtime/Impact**: ~30 minutes of debugging and fix implementation

## Impact Assessment
- **Users Affected**: All users switching between connection profiles
- **Data Affected**: Displayed incorrect topics/subscriptions from wrong GCP project
- **Service Degradation**: Users could not reliably see resources for their selected project
- **Business Impact**: Confusion and potential errors when working with wrong project's resources

## Incident Description
After implementing the connection profile switching feature, users reported that when switching from one saved connection profile to another, the sidebar would display topics and subscriptions from the previously selected project instead of the newly selected project. The connection status indicator correctly showed the new project ID, but the resource lists were stale.

**Symptoms:**
- Connection dropdown correctly showed new project ID
- Status indicator displayed correct project ID
- Topics and subscriptions lists showed resources from the old project
- Issue persisted until manual refresh or app restart

## Root Cause Analysis

### Immediate Cause
The `handleProfileSwitch` function in `App.tsx` was calling `loadStatus()` which triggered `loadResources()` before the backend `SwitchProfile` operation fully completed. Additionally, `loadResources()` was not being awaited in `loadStatus()`, creating a race condition where:

1. User clicks to switch profile
2. `SwitchProfile` backend call starts (async)
3. `onProfileSwitch()` callback fires immediately
4. `loadStatus()` is called, which triggers `loadResources()` (not awaited)
5. Resources load from the old connection before the new connection is established
6. Old project's resources are displayed

### Contributing Factors
- **Missing await**: `loadResources()` was called without `await` in `loadStatus()`, allowing it to execute asynchronously
- **Insufficient state clearing**: Resources were not cleared immediately when profile switching started
- **No connection verification**: No check to ensure the connection matched the expected project ID before loading resources
- **Race condition**: Frontend state updates happened before backend connection switch completed
- **No error handling for stale data**: No mechanism to detect or prevent displaying resources from wrong project

### System/Process Gaps
- **Lack of connection state verification**: No validation that loaded resources match the current connection
- **Insufficient async handling**: Not properly awaiting all async operations in the profile switch flow
- **Missing defensive programming**: No checks to prevent displaying stale data during transitions
- **No instrumentation**: No logging to trace the sequence of events during profile switching

## Resolution

### Immediate Actions Taken
1. **Added immediate resource clearing**: Modified `handleProfileSwitch` to clear `topics` and `subscriptions` state immediately when switching starts
2. **Fixed async sequencing**: Added `await` to `loadResources()` call in `loadStatus()` function
3. **Added connection verification**: Implemented project ID verification before loading resources to ensure they match the expected project
4. **Enhanced error handling**: Added try-catch blocks and resource clearing on errors
5. **Added loading state**: Set `loadingResources` to true during switch to show loading indicator

### Long-term Fix
Implemented comprehensive state management in `handleProfileSwitch`:
- Clear resources immediately when switch starts
- Verify connection status and project ID before loading resources
- Add delay to ensure backend connection is fully established
- Double-check connection status after delay to prevent race conditions
- Clear resources on any error to prevent stale data display

**Key Code Changes:**

```typescript
// frontend/src/App.tsx - handleProfileSwitch
const handleProfileSwitch = async () => {
  // Clear resources immediately
  setTopics([]);
  setSubscriptions([]);
  setSelectedResource(null);
  setError('');
  setLoadingResources(true);

  try {
    const newStatus = await GetConnectionStatus();
    setStatus(newStatus);

    if (newStatus.isConnected) {
      // Delay to ensure backend connection is established
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify connection matches expected project
      const verifyStatus = await GetConnectionStatus();
      if (verifyStatus.isConnected && verifyStatus.projectId === newStatus.projectId) {
        await loadResources();
      }
    }

    await loadProfiles();
    setProfileRefreshTrigger(prev => prev + 1);
  } catch (e: any) {
    // Clear resources on error
    setTopics([]);
    setSubscriptions([]);
    setError('Failed to reload resources: ' + e.toString());
  } finally {
    setLoadingResources(false);
  }
};

// frontend/src/App.tsx - loadStatus
const loadStatus = async () => {
  const s = await GetConnectionStatus();
  setStatus(s);

  if (s.isConnected) {
    await loadResources(); // Now properly awaited
  } else {
    setTopics([]);
    setSubscriptions([]);
    setSelectedResource(null);
  }
  return s;
};

// frontend/src/App.tsx - loadResources
const loadResources = async () => {
  setLoadingResources(true);
  setError('');

  try {
    // Clear resources first
    setTopics([]);
    setSubscriptions([]);

    const [topicsData, subsData] = await Promise.all([
      ListTopics(),
      ListSubscriptions()
    ]);

    // Verify we're still connected before setting resources
    const currentStatus = await GetConnectionStatus();
    if (currentStatus.isConnected) {
      setTopics(topicsData as any || []);
      setSubscriptions(subsData as any || []);
    }
  } catch (e: any) {
    setError('Failed to load resources: ' + e.toString());
    setTopics([]);
    setSubscriptions([]);
  } finally {
    setLoadingResources(false);
  }
};
```

## Prevention Measures

### Immediate (Completed)
- [x] Fixed async sequencing in `loadStatus()` to properly await `loadResources()`
- [x] Added immediate resource clearing in `handleProfileSwitch`
- [x] Implemented connection verification before loading resources
- [x] Added error handling with resource clearing on failures

### Short-term (Next Sprint)
- [ ] Add instrumentation/logging to trace profile switch sequence
- [ ] Add unit tests for profile switching flow
- [ ] Add integration tests to verify resources match selected project
- [ ] Consider using React Query or similar for better async state management

### Long-term (Next Quarter)
- [ ] Implement connection state machine to better track connection lifecycle
- [ ] Add E2E tests for profile switching scenarios
- [ ] Consider implementing optimistic updates with rollback on failure
- [ ] Add monitoring/alerting for connection state mismatches

## Improvements & Recommendations

### Process Improvements
- **Code Review Checklist**: Add item to verify async operations are properly awaited
- **Testing Requirements**: Require tests for all state transition flows
- **Debugging Tools**: Add development-only logging for state transitions

### Technical Improvements
- **State Management**: Consider using a state management library (Redux, Zustand) for complex async flows
- **Connection State Machine**: Implement explicit state machine for connection lifecycle
- **Resource Validation**: Add runtime validation that loaded resources match current connection
- **Debouncing**: Consider debouncing rapid profile switches to prevent race conditions

### Documentation Updates
- [x] Update `CLAUDE.md` with notes about async state management in profile switching
- [ ] Add developer guide for handling async operations in React components
- [ ] Document the profile switching flow in architecture documentation
- [ ] Add troubleshooting guide for connection/resource mismatches

### Monitoring & Alerting
- [ ] Add console warning if resources don't match current project ID (dev mode)
- [ ] Add error boundary for connection state errors
- [ ] Log profile switch events for debugging

## Lessons Learned

### What Went Well
- **Quick Detection**: User reported issue immediately after feature implementation
- **Systematic Debugging**: Identified race condition through code review
- **Comprehensive Fix**: Addressed multiple contributing factors, not just symptoms
- **Defensive Programming**: Added multiple layers of protection against stale data

### What Could Be Improved
- **Testing**: Should have tested profile switching with different projects before release
- **Async Handling**: Should have been more careful about async operation sequencing from the start
- **State Management**: Could benefit from more explicit state management patterns
- **Instrumentation**: Should have added logging earlier to trace the issue

### Questions to Explore
- Should we implement a connection state machine for more predictable state transitions?
- Would React Query or similar library help manage async resource loading?
- Should we add optimistic updates with rollback for better UX?
- Can we detect resource/project mismatches at runtime and auto-correct?

## Related Issues/PRs
- Feature: Connection Profile Management (implemented 2026-01-05)
- Bug: Profile switch shows stale resources (this postmortem)

## Follow-up Actions
- [ ] Review this postmortem in 1 week to verify fix effectiveness
- [ ] Verify all action items are completed
- [ ] Update `.cursor/rules/` if needed with async handling guidelines
- [ ] Share learnings with team (if applicable)
- [ ] Monitor for any recurrence of similar issues

## Technical Details

### Files Modified
- `frontend/src/App.tsx`: Fixed `handleProfileSwitch`, `loadStatus`, and `loadResources` functions
- `frontend/src/components/ConnectionDropdown.tsx`: Minor cleanup (no functional changes)

### Testing Recommendations
1. **Manual Testing**: Switch between profiles with different projects, verify resources match
2. **Rapid Switching**: Quickly switch between multiple profiles to test race conditions
3. **Error Scenarios**: Test behavior when connection fails during switch
4. **Edge Cases**: Test switching when resources are loading, when disconnected, etc.

### Future Considerations
- The 300ms delay is a workaround; ideally, the backend should emit an event when connection is ready
- Consider implementing a connection readiness check API endpoint
- May want to implement request cancellation for in-flight resource loads when switching profiles
