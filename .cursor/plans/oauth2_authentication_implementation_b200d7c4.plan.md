---
name: OAuth2 Authentication Implementation
overview: Implement OAuth2 personal account authentication for Pub/Sub GUI, allowing users to authenticate with their Google accounts via browser-based OAuth flow with PKCE security, encrypted token storage, and seamless integration with existing ADC and Service Account methods.
todos:
  - id: oauth-models
    content: Create internal/models/oauth.go with OAuthToken, OAuthConfig structs and LoadOAuthConfigFromFile function
    status: completed
  - id: update-connection-model
    content: Update internal/models/connection.go to add OAuthClientPath and OAuthEmail fields, update Validate() method
    status: completed
  - id: token-store
    content: Create internal/auth/token_store.go with encrypted token storage using AES-256-GCM
    status: completed
  - id: oauth-server
    content: Create internal/auth/oauth_server.go with local HTTP callback server on port 8888
    status: completed
  - id: oauth-browser
    content: Create internal/auth/oauth_browser.go with platform-specific browser opening (macOS, Windows, Linux)
    status: completed
  - id: oauth-authenticator
    content: Create internal/auth/oauth.go with OAuth flow, PKCE implementation, and token refresh logic
    status: completed
    dependencies:
      - oauth-server
      - oauth-browser
  - id: oauth-client
    content: Create internal/auth/oauth_client.go with ConnectWithOAuth function that creates Pub/Sub client using OAuth tokens
    status: completed
    dependencies:
      - oauth-authenticator
      - token-store
      - oauth-models
  - id: update-connection-handler
    content: Update internal/app/connection.go to add ConnectWithOAuth method and update connectWithProfile/DeleteProfile for OAuth support
    status: completed
    dependencies:
      - oauth-client
  - id: update-app-methods
    content: Add ConnectWithOAuth method to app.go that delegates to connection handler
    status: completed
    dependencies:
      - update-connection-handler
  - id: update-frontend-types
    content: Update frontend/src/types/index.ts to add oauthClientPath and oauthEmail to ConnectionProfile interface
    status: completed
  - id: update-connection-dialog
    content: Update frontend/src/components/ConnectionDialog.tsx to add OAuth auth method selection, file picker, and OAuth-specific UI
    status: completed
    dependencies:
      - update-frontend-types
  - id: handle-oauth-events
    content: Update frontend/src/App.tsx to listen for connection:success events and display OAuth user email
    status: completed
    dependencies:
      - update-connection-dialog
---

# OAuth2 Authentication Implementation Plan

## Overview

Add OAuth2 personal account authentication to Pub/Sub GUI, enabling users to authenticate with their Google accounts through a browser-based flow. This complements existing ADC and Service Account methods.

## Architecture

The implementation follows the existing handler pattern and integrates with the current connection management system:

```
Backend Flow:
User → ConnectionDialog → ConnectWithOAuth → OAuthAuthenticator →
  Browser → Google OAuth → Callback Server → Token Exchange →
  TokenStore (encrypted) → Pub/Sub Client

Frontend Flow:
ConnectionDialog → Auth Method Selection → OAuth File Picker →
  Connect → Loading State → Success/Error Handling
```

## Implementation Steps

### Phase 1: Backend Foundation

#### 1.1 Add OAuth Dependencies

- **File**: `go.mod`
- **Action**: Verify `golang.org/x/oauth2` and `golang.org/x/oauth2/google` are available (already present)
- **Note**: Dependencies already exist, no changes needed

#### 1.2 Create OAuth Models

- **File**: `internal/models/oauth.go` (new)
- **Content**:
  - `OAuthToken` struct with AccessToken, RefreshToken, Expiry, Scopes
  - `OAuthConfig` struct for client configuration
  - `LoadOAuthConfigFromFile()` function to parse GCP OAuth client JSON
  - `IsExpired()` method for token expiry checking

#### 1.3 Update Connection Profile Model

- **File**: `internal/models/connection.go`
- **Changes**:
  - Add `OAuthClientPath string` field to `ConnectionProfile`
  - Add `OAuthEmail string` field (for display purposes)
  - Update `Validate()` to accept "OAuth" as valid auth method
  - Add validation for OAuth client path when auth method is "OAuth"

#### 1.4 Create Token Storage System

- **File**: `internal/auth/token_store.go` (new)
- **Content**:
  - `TokenStore` struct with encryption key management
  - `SaveToken()` - encrypts and saves token to `~/.pubsub-gui/tokens/{profile-id}.json`
  - `LoadToken()` - loads and decrypts token
  - `DeleteToken()` - removes token file
  - AES-256-GCM encryption implementation
  - Key generation/storage in `~/.pubsub-gui/.key` (600 permissions)

#### 1.5 Create OAuth Callback Server

- **File**: `internal/auth/oauth_server.go` (new)
- **Content**:
  - `CallbackServer` struct managing local HTTP server on port 8888
  - `Start()` - starts server in goroutine
  - `Stop()` - graceful shutdown
  - `WaitForCallback()` - waits for OAuth callback with timeout
  - `handleCallback()` - validates state, extracts auth code
  - HTML templates for success/error pages

#### 1.6 Create Browser Opener

- **File**: `internal/auth/oauth_browser.go` (new)
- **Content**:
  - `OpenURL()` function with platform-specific implementations
  - macOS: `open` command
  - Windows: `rundll32 url.dll,FileProtocolHandler`
  - Linux: `xdg-open`, `gnome-open`, or `kde-open`

#### 1.7 Create OAuth Authenticator

- **File**: `internal/auth/oauth.go` (new)
- **Content**:
  - `OAuthAuthenticator` struct wrapping `oauth2.Config`
  - `PKCEChallenge` struct for PKCE codes
  - `generatePKCE()` - creates code verifier and challenge
  - `Authenticate()` - full OAuth flow:

    1. Generate PKCE codes
    2. Generate random state for CSRF protection
    3. Start callback server
    4. Build authorization URL with PKCE
    5. Open browser
    6. Wait for callback
    7. Exchange code for token (with code_verifier)
    8. Get user email from token

  - `RefreshToken()` - refreshes expired access token
  - `getUserEmail()` - fetches email from Google userinfo API

#### 1.8 Create OAuth Client Connection

- **File**: `internal/auth/oauth_client.go` (new)
- **Content**:
  - `ConnectWithOAuth()` function:

    1. Load OAuth config from JSON file
    2. Create OAuth authenticator
    3. Try to load existing token from TokenStore
    4. If token exists and valid: use it
    5. If token expired: refresh it
    6. If no token or refresh fails: start authentication flow
    7. Save token to TokenStore
    8. Create Pub/Sub client with OAuth token source
    9. Return client and user email

### Phase 2: Backend Integration

#### 2.1 Update Connection Handler

- **File**: `internal/app/connection.go`
- **Changes**:
  - Add `ConnectWithOAuth()` method:
    - Validate inputs (projectID, oauthClientPath)
    - Initialize TokenStore
    - Call `auth.ConnectWithOAuth()`
    - Set client in ClientManager
    - Trigger resource sync
    - Emit `connection:success` event with OAuth metadata
  - Update `connectWithProfile()` to handle "OAuth" auth method
  - Update `DeleteProfile()` to delete OAuth tokens when profile deleted

#### 2.2 Update App Methods

- **File**: `app.go`
- **Changes**:
  - Add `ConnectWithOAuth(projectID, oauthClientPath string) error` method
  - Delegate to `a.connection.ConnectWithOAuth()`

### Phase 3: Frontend Implementation

#### 3.1 Update TypeScript Types

- **File**: `frontend/src/types/index.ts`
- **Changes**:
  - Update `ConnectionProfile` interface:
    - Add `oauthClientPath?: string`
    - Add `oauthEmail?: string`
    - Update `authMethod` type to include `'OAuth'`

#### 3.2 Update Connection Dialog

- **File**: `frontend/src/components/ConnectionDialog.tsx`
- **Changes**:
  - Add auth method selection UI (tabs or radio buttons):
    - "ADC" (existing)
    - "OAuth (Google Account)" (new)
  - Add OAuth-specific fields:
    - File input/browser for OAuth client JSON
    - Help text with GCP Console link
  - Update `handleConnect` to:
    - Call `ConnectWithOAuth()` when OAuth selected
    - Pass OAuth client path
  - Add conditional rendering based on selected auth method
  - Update help text/tips section for OAuth

#### 3.3 Handle OAuth Connection Events

- **File**: `frontend/src/App.tsx` (or connection context)
- **Changes**:
  - Listen for `connection:success` event
  - Display user email when OAuth method used
  - Show success notification

### Phase 4: Testing & Validation

#### 4.1 Manual Testing Checklist

- [ ] OAuth flow: browser opens, user authenticates, callback received
- [ ] Token storage: tokens saved encrypted, loaded correctly
- [ ] Token refresh: expired tokens refresh automatically
- [ ] Profile management: OAuth profiles save/load/delete correctly
- [ ] Error handling: invalid JSON, cancelled flow, expired refresh tokens
- [ ] Multi-platform: test browser opening on macOS, Windows, Linux

#### 4.2 Security Validation

- [ ] Token encryption working (verify files are encrypted)
- [ ] File permissions correct (600 for tokens, 600 for key)
- [ ] PKCE implementation prevents code interception
- [ ] State parameter prevents CSRF attacks
- [ ] Token cleanup on profile deletion

## Key Implementation Details

### Token Storage Location

- **Tokens**: `~/.pubsub-gui/tokens/{profile-id}.json` (encrypted)
- **Key**: `~/.pubsub-gui/.key` (AES-256 key, 600 permissions)

### OAuth Flow Port

- **Default**: Port 8888 for callback server
- **Fallback**: Handle port conflicts gracefully

### PKCE Implementation

- Code verifier: 32 random bytes, base64url encoded
- Code challenge: SHA256 hash of verifier, base64url encoded
- Method: S256

### Error Handling

- Browser open failure: show URL for manual copy
- Callback timeout: 5 minute timeout
- Token refresh failure: prompt re-authentication
- Invalid OAuth JSON: clear validation error

## Files to Create

1. `internal/models/oauth.go` - OAuth models and config loading
2. `internal/auth/token_store.go` - Encrypted token storage
3. `internal/auth/oauth_server.go` - Callback HTTP server
4. `internal/auth/oauth_browser.go` - Platform-specific browser opening
5. `internal/auth/oauth.go` - OAuth flow implementation
6. `internal/auth/oauth_client.go` - Pub/Sub client creation with OAuth

## Files to Modify

1. `internal/models/connection.go` - Add OAuth fields, update validation
2. `internal/app/connection.go` - Add ConnectWithOAuth method, update connectWithProfile
3. `app.go` - Add ConnectWithOAuth method
4. `frontend/src/types/index.ts` - Update ConnectionProfile interface
5. `frontend/src/components/ConnectionDialog.tsx` - Add OAuth UI
6. `frontend/src/App.tsx` - Handle OAuth connection events

## Dependencies

- ✅ `golang.org/x/oauth2` - Already in go.mod
- ✅ `golang.org/x/oauth2/google` - Already in go.mod
- ✅ Standard library: `crypto/aes`, `crypto/cipher`, `crypto/rand`, `net/http`, `os/exec`

## Security Considerations

1. **Token Encryption**: AES-256-GCM with per-installation key
2. **PKCE**: Prevents authorization code interception
3. **State Parameter**: CSRF protection
4. **File Permissions**: 600 (owner read/write only)
5. **Localhost Only**: Callback server only accepts localhost connections
6. **Token Cleanup**: Tokens deleted when profiles deleted

## Testing Strategy

1. **Unit Tests**: Token encryption/decryption, PKCE generation
2. **Integration Tests**: OAuth flow with mock server
3. **Manual Tests**: Full flow on each platform
4. **Security Tests**: Verify encryption, permissions, PKCE

## Migration Notes

- Existing ADC and Service Account profiles continue to work
- OAuth is additive, no breaking changes
- Users can mix authentication methods in profiles