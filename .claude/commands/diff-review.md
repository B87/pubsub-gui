# Git Diff Code Review Command

This command performs a comprehensive code review of the current git diff, ensuring compliance with all project rules in `.cursor/rules`.

## Usage

```bash
# Review staged changes
git diff --cached | review-diff

# Review unstaged changes
git diff | review-diff

# Review changes in a specific commit
git diff HEAD~1 HEAD | review-diff

# Review changes between branches
git diff main...feature-branch | review-diff
```

## Review Process

When reviewing a git diff, perform the following checks in order:

### 1. Extract Changed Files

```bash
# Get list of changed files from diff
git diff --name-only
# or
git diff --cached --name-only
```

### 2. Theme System Compliance (Frontend Files)

For any changes to `frontend/src/**/*.tsx`, `frontend/src/**/*.ts`, or `frontend/src/**/*.css`:

**Check for hardcoded colors:**
- ❌ **REJECT**: `style={{ color: '#fff' }}`, `style={{ backgroundColor: '#1e293b' }}`
- ❌ **REJECT**: `className="bg-[#1e293b]"`, `className="text-[#fff]"`
- ✅ **ACCEPT**: `style={{ color: 'var(--color-text-primary)' }}`
- ✅ **ACCEPT**: `className="bg-slate-900"` (mapped to theme variables)

**Check for semantic CSS variables:**
- ✅ **PREFERRED**: Use `var(--color-*)` via inline styles or custom CSS classes
- ⚠️ **FALLBACK**: Tailwind classes (`bg-slate-800`, `text-slate-100`) are acceptable but not preferred

**Pattern to search for:**
```bash
# Search for hardcoded hex colors
grep -E '(#[0-9a-fA-F]{3,6}|rgb\(|rgba\()' <changed-file>

# Search for hardcoded color values in style attributes
grep -E 'style=\{[^}]*#[0-9a-fA-F]' <changed-file>
```

**Action if violations found:**
- Replace hardcoded colors with semantic CSS variables
- Use `var(--color-bg-primary)`, `var(--color-text-primary)`, etc.
- Reference `.cursor/rules/theme-system.mdc` for available tokens

### 3. Wails Backend Patterns (Go Files)

For any changes to `*.go` files:

**Check error handling:**
- ✅ **REQUIRED**: All public methods on `App` struct must return `error`
- ❌ **REJECT**: Methods without error return type
- ✅ **REQUIRED**: Use custom errors from `internal/models/errors.go` (e.g., `models.ErrNotConnected`)

**Check context usage:**
- ✅ **REQUIRED**: Use stored `a.ctx` from `startup()` hook
- ❌ **REJECT**: `context.Background()` or `context.TODO()`
- Pattern: `admin.ListTopicsAdmin(a.ctx, client, projectID)`

**Check event emission:**
- ✅ **REQUIRED**: Emit events after state-changing operations
- ✅ **REQUIRED**: Use `resource:action` format (e.g., `topic:created`, `subscription:deleted`)
- Pattern: `runtime.EventsEmit(a.ctx, "topic:created", map[string]interface{}{"topicID": topicID})`

**Check resource synchronization:**
- ✅ **REQUIRED**: Call `go a.syncResources()` after mutations (CreateTopic, DeleteTopic, etc.)
- ✅ **REQUIRED**: Emit `resources:updated` event in `syncResources()`

**Check mutex usage:**
- ✅ **REQUIRED**: Use `sync.RWMutex` for concurrent map/slice access
- ✅ **REQUIRED**: Lock before reading/writing shared state
- Pattern: `a.resourceMu.Lock()` / `a.resourceMu.Unlock()`

**Check resource ID normalization:**
- ✅ **REQUIRED**: Normalize resource IDs before admin API calls
- Pattern: Extract short ID from full path if `strings.HasPrefix(id, "projects/")`
- See `.cursor/rules/pubsub/pubsub.mdc` for normalization patterns

**Pattern to search for:**
```bash
# Check for context.Background() usage
grep -n 'context\.Background()' <changed-file>

# Check for missing error returns
grep -n '^func (a \*App) [A-Z]' <changed-file> | grep -v 'error'

# Check for missing event emissions after mutations
grep -n 'CreateTopic\|DeleteTopic\|CreateSubscription\|DeleteSubscription' <changed-file>
```

### 4. React/TypeScript Patterns (Frontend Files)

For any changes to `frontend/src/**/*.tsx` or `frontend/src/**/*.ts`:

**Check error display:**
- ✅ **REQUIRED**: All user-facing errors MUST be displayed in UI, not just `console.error`
- ❌ **REJECT**: `console.error()` as only error handling
- ✅ **REQUIRED**: Use error state and display error messages to users
- Pattern: `{error && <div style={{...}}>{error}</div>}`

**Check async state management:**
- ✅ **REQUIRED**: Always `await` async operations that update state
- ❌ **REJECT**: Fire-and-forget async calls that update state
- ✅ **REQUIRED**: Clear dependent state before connection/profile switches
- ✅ **REQUIRED**: Verify connection before loading resources after switch

**Check event listener cleanup:**
- ✅ **REQUIRED**: Unsubscribe from Wails events in `useEffect` cleanup
- ✅ **REQUIRED**: Set up listeners once with empty dependency array
- Pattern: `return () => unsubscribe();`

**Check local filtering pattern:**
- ✅ **REQUIRED**: Use `useMemo` for filtering relationships locally
- ❌ **REJECT**: Backend API calls for filtering (e.g., "get subscriptions for topic")
- ✅ **REQUIRED**: Pass full lists as props, filter in child components

**Check Wails bindings:**
- ❌ **REJECT**: Editing files in `frontend/wailsjs/` (auto-generated)
- ✅ **REQUIRED**: Import from `wailsjs/go/main/App`
- ✅ **REQUIRED**: Handle errors with try/catch

**Pattern to search for:**
```bash
# Check for console.error without UI error display
grep -n 'console\.error' <changed-file>

# Check for un-awaited async calls
grep -n 'await.*\(\)' <changed-file> | grep -v 'await'

# Check for missing cleanup in useEffect
grep -A 10 'useEffect' <changed-file> | grep -v 'return.*=>'
```

### 5. Pub/Sub Patterns (Go Files)

For any changes to `internal/pubsub/**/*.go`:

**Check resource normalization:**
- ✅ **REQUIRED**: Normalize topic/subscription IDs before admin API calls
- ✅ **REQUIRED**: Extract short ID from full path if provided
- Pattern: See `internal/pubsub/admin/topics.go:84-130` for normalization

**Check error messages:**
- ✅ **REQUIRED**: User-friendly error messages with permission hints
- ✅ **REQUIRED**: Include context (resource name, operation)
- Pattern: `fmt.Errorf("failed to create topic %s: %w. Ensure you have 'pubsub.topics.create' permission", topicName, err)`

**Check iterator handling:**
- ✅ **REQUIRED**: Check for `iterator.Done` when iterating
- Pattern: `if err == iterator.Done { break }`

**Check context cancellation:**
- ✅ **REQUIRED**: Distinguish between cancellation and errors
- Pattern: `if err != nil && !errors.Is(err, context.Canceled) { return err }`

### 6. Codacy Integration

**After identifying all changed files:**

For each changed file:
1. Run Codacy analysis:
   ```bash
   # Use Codacy MCP tool
   codacy_cli_analyze --rootPath <workspace-path> --file <changed-file>
   ```

2. If issues found:
   - Propose fixes for each issue
   - Apply fixes automatically if possible
   - Document any issues that require manual intervention

3. For dependency changes:
   - If `package.json`, `go.mod`, or other dependency files changed:
   - Run security scan: `codacy_cli_analyze --rootPath <workspace-path> --tool trivy`
   - Fix any vulnerabilities before proceeding

### 7. Type Safety (TypeScript Files)

For any changes to `frontend/src/**/*.ts` or `frontend/src/**/*.tsx`:

**Check type definitions:**
- ✅ **REQUIRED**: All props have TypeScript interfaces
- ✅ **REQUIRED**: Import types from `types/index.ts`
- ❌ **REJECT**: Excessive use of `any` type
- ✅ **ACCEPTABLE**: `as any` for Wails-generated types when necessary

**Check Wails type conversion:**
- ✅ **REQUIRED**: Use `main.TypeName.createFrom()` for complex Wails types
- Pattern: `main.SubscriptionUpdateParams.createFrom({...})`

### 8. Component Structure (React Files)

For any changes to `frontend/src/components/**/*.tsx`:

**Check component structure:**
- ✅ **REQUIRED**: Use `useTheme()` hook for theme access
- ✅ **REQUIRED**: Proper prop interfaces
- ✅ **REQUIRED**: Error state management
- ✅ **REQUIRED**: Loading states for async operations

**Check accessibility:**
- ✅ **REQUIRED**: ARIA labels for interactive elements
- ✅ **REQUIRED**: Keyboard navigation support
- ✅ **REQUIRED**: Focus states visible

## Review Output Format

After completing the review, provide output in this format:

```markdown
## Code Review Results

### Files Changed
- `path/to/file1.tsx` (15 additions, 3 deletions)
- `path/to/file2.go` (8 additions, 2 deletions)

### Compliance Checks

#### ✅ Theme System Compliance
- All colors use semantic CSS variables
- No hardcoded hex/rgb colors found

#### ✅ Wails Patterns
- All methods return errors
- Context usage correct
- Events emitted after mutations
- Resource sync triggered

#### ⚠️ Issues Found

**File: `path/to/file.tsx`**
- Line 42: Hardcoded color `#fff` should use `var(--color-text-primary)`
- Line 78: Missing error display in UI (only console.error)

**File: `path/to/file.go`**
- Line 156: Missing `go a.syncResources()` after CreateTopic

### Codacy Analysis
- ✅ No issues found in `path/to/file1.tsx`
- ⚠️ 2 issues found in `path/to/file2.go` (fixed automatically)

### Recommendations
1. Replace hardcoded colors with CSS variables
2. Add error display component
3. Trigger resource sync after mutations
```

## Automated Fixes

When violations are found, automatically apply fixes when possible:

1. **Hardcoded colors**: Replace with semantic CSS variables
2. **Missing error returns**: Add error return type and return statements
3. **Missing event emissions**: Add `runtime.EventsEmit()` calls
4. **Missing resource sync**: Add `go a.syncResources()` calls
5. **Missing error display**: Add error state and UI display

## Manual Review Required

Flag for manual review when:
- Complex logic changes that require understanding business context
- Security-sensitive changes (authentication, authorization)
- Breaking API changes
- Performance-critical changes
- Changes affecting multiple systems

## References

- Theme System: `.cursor/rules/theme-system.mdc`
- React/Tailwind: `.cursor/rules/react-tailwind.mdc`
- Wails Patterns: `.cursor/rules/wails.mdc`
- Pub/Sub Guidelines: `.cursor/rules/pubsub/pubsub.mdc`
- Codacy Rules: `.cursor/rules/codacy.mdc`
