# OAuth2 Personal Account Authentication - Implementation Plan

## Overview

This document outlines the implementation plan for adding **Google OAuth2 authentication** to the Pub/Sub GUI application. This will allow users to authenticate using their personal Google accounts in addition to the existing ADC (Application Default Credentials) and Service Account methods.

**Estimated Implementation Time:** 4-6 hours

---

## Table of Contents

1. [Why OAuth2 Personal Account Authentication](#why-oauth2-personal-account-authentication)
2. [OAuth2 Flow Overview](#oauth2-flow-overview)
3. [Architecture Design](#architecture-design)
4. [GCP Setup Requirements](#gcp-setup-requirements)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [Token Management](#token-management)
8. [Security Considerations](#security-considerations)
9. [Testing Strategy](#testing-strategy)
10. [Migration Guide](#migration-guide)
11. [Troubleshooting](#troubleshooting)

---

## Why OAuth2 Personal Account Authentication

### Use Cases

1. **Personal Projects**: Developers working on personal GCP projects without service accounts
2. **Multi-Account Management**: Users managing multiple Google accounts
3. **Easier Onboarding**: No need to set up ADC or download service account keys
4. **Temporary Access**: Quick access without long-term credential storage
5. **Better UX**: Visual, browser-based login instead of command-line tools

### Advantages Over Existing Methods

| Method | Pros | Cons |
|--------|------|------|
| **ADC** | No setup in app, secure | Requires gcloud CLI, complex setup |
| **Service Account** | Good for automation, secure | Requires JSON key file, file management |
| **OAuth2 (New)** | Easy to use, browser-based, no CLI | Requires OAuth client setup, token refresh |

---

## OAuth2 Flow Overview

### Standard OAuth2 Flow (3-Legged)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OAuth2 Authentication Flow                   │
└─────────────────────────────────────────────────────────────────────┘

1. User clicks "Sign in with Google"
   │
   ▼
2. App opens browser with Google consent screen
   │ URL: https://accounts.google.com/o/oauth2/v2/auth
   │ Params: client_id, redirect_uri, scope, state, code_challenge
   │
   ▼
3. User logs in with Google account and grants permissions
   │
   ▼
4. Google redirects to http://localhost:PORT/callback?code=AUTH_CODE
   │
   ▼
5. App exchanges AUTH_CODE for access token + refresh token
   │ POST: https://oauth2.googleapis.com/token
   │
   ▼
6. App stores tokens securely and creates Pub/Sub client
   │
   ▼
7. When access token expires, app uses refresh token to get new one
```

### PKCE Enhancement (Recommended)

For desktop applications, we'll use **PKCE** (Proof Key for Code Exchange) to prevent authorization code interception:

- Generates `code_verifier` (random string)
- Derives `code_challenge` from verifier (SHA256 hash)
- Sends `code_challenge` in authorization request
- Sends `code_verifier` when exchanging code for token
- Prevents attackers from using intercepted authorization codes

---

## Architecture Design

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Backend (Go)                             │
├─────────────────────────────────────────────────────────────────┤
│  internal/auth/
│  ├── oauth.go                 # OAuth2 flow implementation       │
│  ├── oauth_server.go          # Local callback server           │
│  ├── token_store.go           # Secure token storage            │
│  └── oauth_client.go          # Pub/Sub client with OAuth       │
│
│  internal/models/
│  ├── connection.go            # Updated ConnectionProfile       │
│  └── oauth.go                 # OAuth token models              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  frontend/src/components/
│  ├── ConnectionDialog.tsx     # Updated with OAuth option       │
│  ├── OAuthLoginButton.tsx     # OAuth login trigger             │
│  └── OAuthCallbackHandler.tsx # OAuth callback processor        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Configuration Storage                        │
├─────────────────────────────────────────────────────────────────┤
│  ~/.pubsub-gui/
│  ├── config.json              # Connection profiles             │
│  └── tokens/                  # OAuth tokens (encrypted)         │
│      └── {profile-id}.json    # Per-profile token storage       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action                Backend                     Google OAuth
────────────                ───────                     ────────────
Click "Login" ──────────▶ Start OAuth Flow
                          Generate PKCE codes
                          Start local server
                          Open browser ──────────────▶ Show consent
                                                       User approves
                          ◀─────────────────────────── Redirect with code
                          Exchange code for tokens ─▶ Validate & return
                          ◀───────────────────────── Access + Refresh tokens
                          Store tokens securely
                          Create Pub/Sub client
                          Emit success event
Update UI   ◀──────────── Connection successful
```

---

## GCP Setup Requirements

### Step 1: Create OAuth 2.0 Credentials

Users will need to create OAuth credentials in their GCP project:

1. **Open Google Cloud Console**
   - Navigate to: https://console.cloud.google.com/apis/credentials

2. **Create OAuth 2.0 Client ID**
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Desktop app**
   - Name: "Pub/Sub GUI Desktop Client"
   - Click "Create"

3. **Download Credentials**
   - Download the JSON file (e.g., `client_secret_XXXXX.json`)
   - Keep it secure (never commit to version control)

4. **Enable Required APIs**
   - Enable "Cloud Pub/Sub API" if not already enabled
   - Scopes needed:
     - `https://www.googleapis.com/auth/pubsub` (full access)
     - Or `https://www.googleapis.com/auth/cloud-platform` (broader access)

### OAuth Client JSON Structure

```json
{
  "installed": {
    "client_id": "123456789-abcdefghijklmnop.apps.googleusercontent.com",
    "project_id": "my-project-123",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "GOCSPX-xxxxxxxxxxxxxxxxxx",
    "redirect_uris": ["http://localhost"]
  }
}
```

### Consent Screen Configuration

Users should configure the OAuth consent screen:

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. User Type: **External** (for personal accounts)
3. App Information:
   - App name: "Pub/Sub GUI"
   - User support email: Your email
   - Developer contact: Your email
4. Scopes: Add `https://www.googleapis.com/auth/pubsub`
5. Test users: Add your Google account email(s)

**Note:** For personal use, the app can remain in "Testing" mode (no verification needed, up to 100 users).

---

## Backend Implementation

### Step 1: Add OAuth Dependencies

Update `go.mod`:

```bash
go get golang.org/x/oauth2
go get golang.org/x/oauth2/google
go get google.golang.org/api/option
```

### Step 2: OAuth Token Models

**Create `internal/models/oauth.go`:**

```go
package models

import (
    "encoding/json"
    "os"
    "time"
)

// OAuthToken represents stored OAuth2 tokens
type OAuthToken struct {
    AccessToken  string    `json:"access_token"`
    RefreshToken string    `json:"refresh_token"`
    TokenType    string    `json:"token_type"`
    Expiry       time.Time `json:"expiry"`
    Scopes       []string  `json:"scopes,omitempty"`
}

// IsExpired checks if the access token has expired
func (t *OAuthToken) IsExpired() bool {
    if t.Expiry.IsZero() {
        return false
    }
    // Consider token expired 1 minute before actual expiry (safety margin)
    return time.Now().Add(1 * time.Minute).After(t.Expiry)
}

// OAuthConfig represents OAuth2 client configuration
type OAuthConfig struct {
    ClientID     string   `json:"client_id"`
    ClientSecret string   `json:"client_secret"`
    RedirectURL  string   `json:"redirect_url"`
    Scopes       []string `json:"scopes"`
    AuthURL      string   `json:"auth_url"`
    TokenURL     string   `json:"token_url"`
}

// LoadOAuthConfigFromFile loads OAuth config from Google Cloud Console JSON
func LoadOAuthConfigFromFile(path string) (*OAuthConfig, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }

    // Parse the downloaded Google OAuth client JSON format
    var gcpConfig struct {
        Installed struct {
            ClientID     string   `json:"client_id"`
            ClientSecret string   `json:"client_secret"`
            AuthURI      string   `json:"auth_uri"`
            TokenURI     string   `json:"token_uri"`
            RedirectURIs []string `json:"redirect_uris"`
        } `json:"installed"`
    }

    if err := json.Unmarshal(data, &gcpConfig); err != nil {
        return nil, err
    }

    return &OAuthConfig{
        ClientID:     gcpConfig.Installed.ClientID,
        ClientSecret: gcpConfig.Installed.ClientSecret,
        AuthURL:      gcpConfig.Installed.AuthURI,
        TokenURL:     gcpConfig.Installed.TokenURI,
        RedirectURL:  "http://localhost:8888/callback", // We'll use this port
        Scopes:       []string{"https://www.googleapis.com/auth/pubsub"},
    }, nil
}
```

### Step 3: Update Connection Profile Model

**Update `internal/models/connection.go`:**

```go
// ConnectionProfile represents a saved connection configuration
type ConnectionProfile struct {
    ID                  string `json:"id"`
    Name                string `json:"name"`
    ProjectID           string `json:"projectId"`
    AuthMethod          string `json:"authMethod"` // "ADC" | "ServiceAccount" | "OAuth"
    ServiceAccountPath  string `json:"serviceAccountPath,omitempty"`
    OAuthClientPath     string `json:"oauthClientPath,omitempty"` // Path to OAuth client JSON
    OAuthEmail          string `json:"oauthEmail,omitempty"`      // Google account email (for display)
    EmulatorHost        string `json:"emulatorHost,omitempty"`
    IsDefault           bool   `json:"isDefault"`
    CreatedAt           string `json:"createdAt"`
}

// Validate checks if the ConnectionProfile has all required fields
func (cp *ConnectionProfile) Validate() error {
    if strings.TrimSpace(cp.ID) == "" {
        return errors.New("profile ID cannot be empty")
    }
    if strings.TrimSpace(cp.Name) == "" {
        return errors.New("profile name cannot be empty")
    }
    if strings.TrimSpace(cp.ProjectID) == "" {
        return errors.New("project ID cannot be empty")
    }

    // Updated validation for OAuth
    validAuthMethods := []string{"ADC", "ServiceAccount", "OAuth"}
    isValid := false
    for _, method := range validAuthMethods {
        if cp.AuthMethod == method {
            isValid = true
            break
        }
    }
    if !isValid {
        return errors.New("auth method must be 'ADC', 'ServiceAccount', or 'OAuth'")
    }

    if cp.AuthMethod == "ServiceAccount" && strings.TrimSpace(cp.ServiceAccountPath) == "" {
        return errors.New("service account path required when using ServiceAccount auth method")
    }
    if cp.AuthMethod == "OAuth" && strings.TrimSpace(cp.OAuthClientPath) == "" {
        return errors.New("OAuth client path required when using OAuth auth method")
    }
    return nil
}
```

### Step 4: Token Storage

**Create `internal/auth/token_store.go`:**

```go
package auth

import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "os"
    "path/filepath"

    "pubsub-gui/internal/models"
)

// TokenStore manages secure storage of OAuth tokens
type TokenStore struct {
    baseDir string
    key     []byte // Encryption key (32 bytes for AES-256)
}

// NewTokenStore creates a new token store
func NewTokenStore(configDir string) (*TokenStore, error) {
    tokenDir := filepath.Join(configDir, "tokens")

    // Create tokens directory if it doesn't exist
    if err := os.MkdirAll(tokenDir, 0700); err != nil {
        return nil, fmt.Errorf("failed to create tokens directory: %w", err)
    }

    // Generate or load encryption key
    key, err := loadOrGenerateKey(configDir)
    if err != nil {
        return nil, fmt.Errorf("failed to initialize encryption key: %w", err)
    }

    return &TokenStore{
        baseDir: tokenDir,
        key:     key,
    }, nil
}

// SaveToken saves an OAuth token for a profile (encrypted)
func (ts *TokenStore) SaveToken(profileID string, token *models.OAuthToken) error {
    // Serialize token to JSON
    data, err := json.Marshal(token)
    if err != nil {
        return fmt.Errorf("failed to serialize token: %w", err)
    }

    // Encrypt the token data
    encrypted, err := ts.encrypt(data)
    if err != nil {
        return fmt.Errorf("failed to encrypt token: %w", err)
    }

    // Write encrypted data to file
    tokenPath := filepath.Join(ts.baseDir, profileID+".json")
    if err := os.WriteFile(tokenPath, encrypted, 0600); err != nil {
        return fmt.Errorf("failed to write token file: %w", err)
    }

    return nil
}

// LoadToken loads an OAuth token for a profile (decrypted)
func (ts *TokenStore) LoadToken(profileID string) (*models.OAuthToken, error) {
    tokenPath := filepath.Join(ts.baseDir, profileID+".json")

    // Read encrypted data
    encrypted, err := os.ReadFile(tokenPath)
    if err != nil {
        if os.IsNotExist(err) {
            return nil, nil // No token exists yet
        }
        return nil, fmt.Errorf("failed to read token file: %w", err)
    }

    // Decrypt the data
    data, err := ts.decrypt(encrypted)
    if err != nil {
        return nil, fmt.Errorf("failed to decrypt token: %w", err)
    }

    // Deserialize JSON
    var token models.OAuthToken
    if err := json.Unmarshal(data, &token); err != nil {
        return nil, fmt.Errorf("failed to parse token: %w", err)
    }

    return &token, nil
}

// DeleteToken removes a token for a profile
func (ts *TokenStore) DeleteToken(profileID string) error {
    tokenPath := filepath.Join(ts.baseDir, profileID+".json")
    if err := os.Remove(tokenPath); err != nil && !os.IsNotExist(err) {
        return fmt.Errorf("failed to delete token: %w", err)
    }
    return nil
}

// encrypt encrypts data using AES-256-GCM
func (ts *TokenStore) encrypt(plaintext []byte) ([]byte, error) {
    block, err := aes.NewCipher(ts.key)
    if err != nil {
        return nil, err
    }

    aesGCM, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }

    // Create nonce
    nonce := make([]byte, aesGCM.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, err
    }

    // Encrypt and prepend nonce
    ciphertext := aesGCM.Seal(nonce, nonce, plaintext, nil)
    return ciphertext, nil
}

// decrypt decrypts data using AES-256-GCM
func (ts *TokenStore) decrypt(ciphertext []byte) ([]byte, error) {
    block, err := aes.NewCipher(ts.key)
    if err != nil {
        return nil, err
    }

    aesGCM, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }

    nonceSize := aesGCM.NonceSize()
    if len(ciphertext) < nonceSize {
        return nil, errors.New("ciphertext too short")
    }

    // Extract nonce and ciphertext
    nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

    // Decrypt
    plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return nil, err
    }

    return plaintext, nil
}

// loadOrGenerateKey loads or generates an encryption key for the token store
func loadOrGenerateKey(configDir string) ([]byte, error) {
    keyPath := filepath.Join(configDir, ".key")

    // Try to load existing key
    if data, err := os.ReadFile(keyPath); err == nil {
        if len(data) == 32 {
            return data, nil
        }
    }

    // Generate new key
    key := make([]byte, 32) // 32 bytes for AES-256
    if _, err := rand.Read(key); err != nil {
        return nil, fmt.Errorf("failed to generate encryption key: %w", err)
    }

    // Save key (600 permissions - owner read/write only)
    if err := os.WriteFile(keyPath, key, 0600); err != nil {
        return nil, fmt.Errorf("failed to save encryption key: %w", err)
    }

    return key, nil
}
```

### Step 5: OAuth Flow Implementation

**Create `internal/auth/oauth.go`:**

```go
package auth

import (
    "context"
    "crypto/rand"
    "crypto/sha256"
    "encoding/base64"
    "fmt"
    "net/url"

    "pubsub-gui/internal/models"

    "golang.org/x/oauth2"
    "golang.org/x/oauth2/google"
)

// OAuthAuthenticator handles OAuth2 authentication flow
type OAuthAuthenticator struct {
    config      *oauth2.Config
    tokenStore  *TokenStore
    callbackServer *CallbackServer
}

// NewOAuthAuthenticator creates a new OAuth authenticator
func NewOAuthAuthenticator(oauthConfig *models.OAuthConfig, tokenStore *TokenStore) *OAuthAuthenticator {
    config := &oauth2.Config{
        ClientID:     oauthConfig.ClientID,
        ClientSecret: oauthConfig.ClientSecret,
        RedirectURL:  oauthConfig.RedirectURL,
        Scopes:       oauthConfig.Scopes,
        Endpoint:     google.Endpoint,
    }

    return &OAuthAuthenticator{
        config:     config,
        tokenStore: tokenStore,
    }
}

// PKCEChallenge represents PKCE verification codes
type PKCEChallenge struct {
    Verifier  string
    Challenge string
}

// generatePKCE generates PKCE codes for secure OAuth flow
func generatePKCE() (*PKCEChallenge, error) {
    // Generate code verifier (random 43-128 character string)
    verifierBytes := make([]byte, 32)
    if _, err := rand.Read(verifierBytes); err != nil {
        return nil, err
    }
    verifier := base64.RawURLEncoding.EncodeToString(verifierBytes)

    // Generate code challenge (SHA256 hash of verifier)
    hash := sha256.Sum256([]byte(verifier))
    challenge := base64.RawURLEncoding.EncodeToString(hash[:])

    return &PKCEChallenge{
        Verifier:  verifier,
        Challenge: challenge,
    }, nil
}

// AuthenticateResult contains the result of OAuth authentication
type AuthenticateResult struct {
    Token      *oauth2.Token
    UserEmail  string
    Success    bool
    ErrorMsg   string
}

// Authenticate starts the OAuth2 flow and waits for completion
func (oa *OAuthAuthenticator) Authenticate(ctx context.Context) (*AuthenticateResult, error) {
    // Generate PKCE challenge
    pkce, err := generatePKCE()
    if err != nil {
        return nil, fmt.Errorf("failed to generate PKCE: %w", err)
    }

    // Generate random state for CSRF protection
    stateBytes := make([]byte, 16)
    if _, err := rand.Read(stateBytes); err != nil {
        return nil, fmt.Errorf("failed to generate state: %w", err)
    }
    state := base64.RawURLEncoding.EncodeToString(stateBytes)

    // Start local callback server
    callbackServer := NewCallbackServer(8888, state)
    if err := callbackServer.Start(); err != nil {
        return nil, fmt.Errorf("failed to start callback server: %w", err)
    }
    defer callbackServer.Stop()

    // Build authorization URL with PKCE
    authURL := oa.config.AuthCodeURL(state,
        oauth2.AccessTypeOffline,                       // Request refresh token
        oauth2.ApprovalForce,                           // Force consent screen
        oauth2.SetAuthURLParam("code_challenge", pkce.Challenge),
        oauth2.SetAuthURLParam("code_challenge_method", "S256"),
    )

    // Open browser for user to authenticate
    if err := openBrowser(authURL); err != nil {
        return &AuthenticateResult{
            Success:  false,
            ErrorMsg: fmt.Sprintf("Failed to open browser. Please visit: %s", authURL),
        }, nil
    }

    // Wait for callback with timeout
    result := callbackServer.WaitForCallback(ctx)

    if !result.Success {
        return result, nil
    }

    // Exchange authorization code for token
    token, err := oa.config.Exchange(ctx, result.AuthCode,
        oauth2.SetAuthURLParam("code_verifier", pkce.Verifier),
    )
    if err != nil {
        return &AuthenticateResult{
            Success:  false,
            ErrorMsg: fmt.Sprintf("Failed to exchange code for token: %v", err),
        }, nil
    }

    // Get user email from token info
    email, err := getUserEmail(ctx, token)
    if err != nil {
        email = "unknown" // Non-critical error
    }

    return &AuthenticateResult{
        Token:     token,
        UserEmail: email,
        Success:   true,
    }, nil
}

// RefreshToken refreshes an expired OAuth token
func (oa *OAuthAuthenticator) RefreshToken(ctx context.Context, oldToken *models.OAuthToken) (*oauth2.Token, error) {
    token := &oauth2.Token{
        AccessToken:  oldToken.AccessToken,
        RefreshToken: oldToken.RefreshToken,
        TokenType:    oldToken.TokenType,
        Expiry:       oldToken.Expiry,
    }

    // Use oauth2 library's built-in token refresh
    tokenSource := oa.config.TokenSource(ctx, token)
    newToken, err := tokenSource.Token()
    if err != nil {
        return nil, fmt.Errorf("failed to refresh token: %w", err)
    }

    return newToken, nil
}

// getUserEmail retrieves the user's email from the OAuth token
func getUserEmail(ctx context.Context, token *oauth2.Token) (string, error) {
    // Get user info from Google's userinfo endpoint
    client := oauth2.NewClient(ctx, oauth2.StaticTokenSource(token))
    resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    var userInfo struct {
        Email string `json:"email"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
        return "", err
    }

    return userInfo.Email, nil
}

// openBrowser opens the default browser with the given URL
func openBrowser(url string) error {
    // This will be implemented in oauth_browser.go with platform-specific code
    return OpenURL(url)
}
```

### Step 6: OAuth Callback Server

**Create `internal/auth/oauth_server.go`:**

```go
package auth

import (
    "context"
    "fmt"
    "html/template"
    "net/http"
    "time"
)

// CallbackServer handles the OAuth callback
type CallbackServer struct {
    port           int
    state          string
    server         *http.Server
    resultChan     chan *AuthenticateResult
}

// NewCallbackServer creates a new callback server
func NewCallbackServer(port int, state string) *CallbackServer {
    return &CallbackServer{
        port:       port,
        state:      state,
        resultChan: make(chan *AuthenticateResult, 1),
    }
}

// Start starts the callback server
func (cs *CallbackServer) Start() error {
    mux := http.NewServeMux()
    mux.HandleFunc("/callback", cs.handleCallback)

    cs.server = &http.Server{
        Addr:    fmt.Sprintf(":%d", cs.port),
        Handler: mux,
    }

    go func() {
        if err := cs.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            cs.resultChan <- &AuthenticateResult{
                Success:  false,
                ErrorMsg: fmt.Sprintf("Callback server error: %v", err),
            }
        }
    }()

    // Give server time to start
    time.Sleep(100 * time.Millisecond)

    return nil
}

// Stop stops the callback server
func (cs *CallbackServer) Stop() error {
    if cs.server != nil {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        return cs.server.Shutdown(ctx)
    }
    return nil
}

// WaitForCallback waits for the OAuth callback with timeout
func (cs *CallbackServer) WaitForCallback(ctx context.Context) *AuthenticateResult {
    select {
    case result := <-cs.resultChan:
        return result
    case <-ctx.Done():
        return &AuthenticateResult{
            Success:  false,
            ErrorMsg: "Authentication timeout",
        }
    case <-time.After(5 * time.Minute):
        return &AuthenticateResult{
            Success:  false,
            ErrorMsg: "Authentication timeout (5 minutes)",
        }
    }
}

// handleCallback handles the OAuth callback request
func (cs *CallbackServer) handleCallback(w http.ResponseWriter, r *http.Request) {
    // Validate state parameter (CSRF protection)
    state := r.URL.Query().Get("state")
    if state != cs.state {
        cs.sendErrorResponse(w, "Invalid state parameter")
        cs.resultChan <- &AuthenticateResult{
            Success:  false,
            ErrorMsg: "Invalid state parameter (possible CSRF attack)",
        }
        return
    }

    // Check for error
    if errMsg := r.URL.Query().Get("error"); errMsg != "" {
        cs.sendErrorResponse(w, fmt.Sprintf("Authentication error: %s", errMsg))
        cs.resultChan <- &AuthenticateResult{
            Success:  false,
            ErrorMsg: fmt.Sprintf("Authentication error: %s", errMsg),
        }
        return
    }

    // Get authorization code
    code := r.URL.Query().Get("code")
    if code == "" {
        cs.sendErrorResponse(w, "No authorization code received")
        cs.resultChan <- &AuthenticateResult{
            Success:  false,
            ErrorMsg: "No authorization code received",
        }
        return
    }

    // Send success response
    cs.sendSuccessResponse(w)

    // Send result
    cs.resultChan <- &AuthenticateResult{
        Success:  true,
        AuthCode: code,
    }
}

// sendSuccessResponse sends a success HTML page
func (cs *CallbackServer) sendSuccessResponse(w http.ResponseWriter) {
    w.Header().Set("Content-Type", "text/html")
    tmpl := template.Must(template.New("success").Parse(successPageHTML))
    tmpl.Execute(w, nil)
}

// sendErrorResponse sends an error HTML page
func (cs *CallbackServer) sendErrorResponse(w http.ResponseWriter, errorMsg string) {
    w.Header().Set("Content-Type", "text/html")
    tmpl := template.Must(template.New("error").Parse(errorPageHTML))
    tmpl.Execute(w, map[string]string{"Error": errorMsg})
}

const successPageHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        p {
            color: #666;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✓</div>
        <h1>Authentication Successful!</h1>
        <p>You have successfully authenticated with Google.</p>
        <p>You can close this window and return to Pub/Sub GUI.</p>
    </div>
</body>
</html>
`

const errorPageHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Error</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        p {
            color: #666;
            line-height: 1.6;
        }
        .error {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 5px;
            padding: 10px;
            margin-top: 20px;
            color: #856404;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✗</div>
        <h1>Authentication Failed</h1>
        <p>There was a problem authenticating with Google.</p>
        <div class="error">{{.Error}}</div>
        <p>Please close this window and try again.</p>
    </div>
</body>
</html>
`
```

### Step 7: Browser Opener (Platform-Specific)

**Create `internal/auth/oauth_browser.go`:**

```go
package auth

import (
    "fmt"
    "os/exec"
    "runtime"
)

// OpenURL opens a URL in the default browser
func OpenURL(url string) error {
    var cmd *exec.Cmd

    switch runtime.GOOS {
    case "darwin": // macOS
        cmd = exec.Command("open", url)
    case "windows":
        cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
    case "linux":
        // Try common Linux browsers
        browsers := []string{"xdg-open", "gnome-open", "kde-open"}
        for _, browser := range browsers {
            if _, err := exec.LookPath(browser); err == nil {
                cmd = exec.Command(browser, url)
                break
            }
        }
        if cmd == nil {
            return fmt.Errorf("no browser found on Linux")
        }
    default:
        return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
    }

    return cmd.Start()
}
```

### Step 8: OAuth Client Creation

**Create `internal/auth/oauth_client.go`:**

```go
package auth

import (
    "context"
    "fmt"

    "cloud.google.com/go/pubsub/v2"
    "golang.org/x/oauth2"
    "google.golang.org/api/option"
    "pubsub-gui/internal/models"
)

// ConnectWithOAuth creates a Pub/Sub client using OAuth2 credentials
func ConnectWithOAuth(ctx context.Context, projectID, oauthClientPath, profileID string, tokenStore *TokenStore) (*pubsub.Client, string, error) {
    // Load OAuth config from file
    oauthConfig, err := models.LoadOAuthConfigFromFile(oauthClientPath)
    if err != nil {
        return nil, "", fmt.Errorf("failed to load OAuth config: %w", err)
    }

    // Create OAuth authenticator
    authenticator := NewOAuthAuthenticator(oauthConfig, tokenStore)

    // Try to load existing token
    storedToken, err := tokenStore.LoadToken(profileID)
    var token *oauth2.Token
    var userEmail string

    if err == nil && storedToken != nil {
        // Check if token is expired
        if storedToken.IsExpired() {
            // Refresh the token
            token, err = authenticator.RefreshToken(ctx, storedToken)
            if err != nil {
                // Refresh failed, need to re-authenticate
                return nil, "", fmt.Errorf("token refresh failed, please re-authenticate: %w", err)
            }

            // Save refreshed token
            newStoredToken := &models.OAuthToken{
                AccessToken:  token.AccessToken,
                RefreshToken: token.RefreshToken,
                TokenType:    token.TokenType,
                Expiry:       token.Expiry,
            }
            tokenStore.SaveToken(profileID, newStoredToken)
        } else {
            // Token is still valid
            token = &oauth2.Token{
                AccessToken:  storedToken.AccessToken,
                RefreshToken: storedToken.RefreshToken,
                TokenType:    storedToken.TokenType,
                Expiry:       storedToken.Expiry,
            }
        }

        // Get user email (might be cached in profile)
        userEmail, _ = getUserEmail(ctx, token)
    } else {
        // No token exists, need to authenticate
        result, err := authenticator.Authenticate(ctx)
        if err != nil {
            return nil, "", fmt.Errorf("authentication failed: %w", err)
        }

        if !result.Success {
            return nil, "", fmt.Errorf("authentication failed: %s", result.ErrorMsg)
        }

        token = result.Token
        userEmail = result.UserEmail

        // Save token
        storedToken := &models.OAuthToken{
            AccessToken:  token.AccessToken,
            RefreshToken: token.RefreshToken,
            TokenType:    token.TokenType,
            Expiry:       token.Expiry,
        }
        if err := tokenStore.SaveToken(profileID, storedToken); err != nil {
            // Non-fatal error, log but continue
            fmt.Printf("Warning: failed to save token: %v\n", err)
        }
    }

    // Create Pub/Sub client with OAuth token
    client, err := pubsub.NewClient(ctx, projectID,
        option.WithTokenSource(oauth2.StaticTokenSource(token)),
    )
    if err != nil {
        return nil, "", fmt.Errorf("failed to create Pub/Sub client: %w", err)
    }

    return client, userEmail, nil
}
```

### Step 9: Update Connection Handler

**Update `internal/app/connection_handler.go`:**

```go
// Add new method for OAuth connection
func (h *ConnectionHandler) ConnectWithOAuth(projectID, oauthClientPath string) error {
    // Validate inputs
    if strings.TrimSpace(projectID) == "" {
        return errors.New("project ID cannot be empty")
    }
    if strings.TrimSpace(oauthClientPath) == "" {
        return errors.New("OAuth client path cannot be empty")
    }

    // Get or create profile ID for token storage
    profileID := h.getOrCreateOAuthProfileID(projectID, oauthClientPath)

    // Create token store
    configDir := filepath.Dir(h.configManager.GetConfigPath())
    tokenStore, err := auth.NewTokenStore(configDir)
    if err != nil {
        return fmt.Errorf("failed to initialize token store: %w", err)
    }

    // Connect with OAuth
    client, userEmail, err := auth.ConnectWithOAuth(h.ctx, projectID, oauthClientPath, profileID, tokenStore)
    if err != nil {
        return err
    }

    // Set client in manager
    if err := h.clientManager.SetClient(client, projectID); err != nil {
        client.Close()
        return fmt.Errorf("failed to set client: %w", err)
    }

    // Emit connection success event with user email
    runtime.EventsEmit(h.ctx, "connection:success", map[string]string{
        "projectId": projectID,
        "authMethod": "OAuth",
        "userEmail": userEmail,
    })

    return nil
}

func (h *ConnectionHandler) getOrCreateOAuthProfileID(projectID, oauthClientPath string) string {
    // Find existing profile with matching project and OAuth client
    for _, profile := range h.config.Profiles {
        if profile.AuthMethod == "OAuth" &&
           profile.ProjectID == projectID &&
           profile.OAuthClientPath == oauthClientPath {
            return profile.ID
        }
    }

    // Generate new profile ID
    return models.GenerateID()
}
```

### Step 10: Add Method to App

**Update `app.go`:**

```go
// ConnectWithOAuth connects to Pub/Sub using OAuth2 credentials
func (a *App) ConnectWithOAuth(projectID, oauthClientPath string) error {
    return a.connection.ConnectWithOAuth(projectID, oauthClientPath)
}
```

---

## Frontend Implementation

### Step 1: Update Types

**Update `frontend/src/types/index.ts`:**

```typescript
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
```

### Step 2: Update Connection Dialog

**Update `frontend/src/components/ConnectionDialog.tsx`:**

```typescript
import { useState } from 'react';
import { ConnectWithADC, ConnectWithOAuth } from '../../wailsjs/go/main/App';

type AuthMethod = 'ADC' | 'OAuth' | 'ServiceAccount';

interface ConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConnectionDialog({ open, onClose, onSuccess }: ConnectionDialogProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('ADC');
  const [projectId, setProjectId] = useState('');
  const [oauthClientPath, setOAuthClientPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveAsProfile, setSaveAsProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  if (!open) return null;

  const handleSelectOAuthFile = async () => {
    // Use Wails file picker
    const { OpenFileDialog } = await import('../../wailsjs/runtime/runtime');
    const selected = await OpenFileDialog({
      Title: 'Select OAuth Client JSON',
      Filters: [
        { DisplayName: 'JSON Files', Pattern: '*.json' },
      ],
    });

    if (selected) {
      setOAuthClientPath(selected);
    }
  };

  const handleConnect = async () => {
    if (!projectId.trim()) return;

    setLoading(true);
    setError('');

    try {
      if (authMethod === 'ADC') {
        await ConnectWithADC(projectId.trim());
      } else if (authMethod === 'OAuth') {
        if (!oauthClientPath.trim()) {
          setError('Please select OAuth client JSON file');
          return;
        }
        await ConnectWithOAuth(projectId.trim(), oauthClientPath.trim());
      }

      // TODO: Handle saveAsProfile logic

      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold">Connect to Google Cloud Pub/Sub</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Auth Method Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Authentication Method</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAuthMethod('ADC')}
                className={`flex-1 px-3 py-2 rounded border ${
                  authMethod === 'ADC'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                }`}
              >
                ADC
              </button>
              <button
                onClick={() => setAuthMethod('OAuth')}
                className={`flex-1 px-3 py-2 rounded border ${
                  authMethod === 'OAuth'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                }`}
              >
                OAuth (Google Account)
              </button>
            </div>
          </div>

          {/* Help Text */}
          {authMethod === 'ADC' && (
            <p className="text-sm text-slate-300">
              Connect using Application Default Credentials (ADC). Make sure you're authenticated with gcloud.
            </p>
          )}

          {authMethod === 'OAuth' && (
            <p className="text-sm text-slate-300">
              Connect using your personal Google account. You'll need an OAuth client JSON file from GCP Console.
            </p>
          )}

          {/* Project ID */}
          <div>
            <label htmlFor="projectId" className="block text-sm font-medium mb-2">
              GCP Project ID
            </label>
            <input
              id="projectId"
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="my-gcp-project"
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              autoFocus
            />
          </div>

          {/* OAuth Client File Selection */}
          {authMethod === 'OAuth' && (
            <div>
              <label htmlFor="oauthClient" className="block text-sm font-medium mb-2">
                OAuth Client JSON
              </label>
              <div className="flex gap-2">
                <input
                  id="oauthClient"
                  type="text"
                  value={oauthClientPath}
                  onChange={(e) => setOAuthClientPath(e.target.value)}
                  placeholder="Path to client_secret_*.json"
                  disabled={loading}
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  onClick={handleSelectOAuthFile}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-md transition-colors"
                >
                  Browse
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Download from{' '}
                <a
                  href="#"
                  onClick={() => window.open('https://console.cloud.google.com/apis/credentials')}
                  className="text-blue-400 hover:underline"
                >
                  GCP Console → APIs & Services → Credentials
                </a>
              </p>
            </div>
          )}

          {/* Save as Profile */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsProfile}
                onChange={(e) => setSaveAsProfile(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-300">Save as connection profile</span>
            </label>

            {saveAsProfile && (
              <div className="ml-6 space-y-3">
                <div>
                  <label htmlFor="profileName" className="block text-sm font-medium mb-2">
                    Connection Name
                  </label>
                  <input
                    id="profileName"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Production, Staging, etc."
                    disabled={loading}
                    className="w-full px-3 py-2 bg-slate-700 border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Set as default connection</span>
                </label>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Tips */}
          <div className="bg-slate-700 rounded-md p-3 text-xs text-slate-300">
            <p className="font-medium mb-1">💡 Tips:</p>
            {authMethod === 'ADC' && (
              <ul className="list-disc list-inside space-y-1">
                <li>Run <code className="bg-slate-800 px-1 rounded">gcloud auth application-default login</code></li>
                <li>Set <code className="bg-slate-800 px-1 rounded">PUBSUB_EMULATOR_HOST</code> for local emulator</li>
              </ul>
            )}
            {authMethod === 'OAuth' && (
              <ul className="list-disc list-inside space-y-1">
                <li>Create OAuth 2.0 Client ID (Desktop app) in GCP Console</li>
                <li>Download the JSON file and select it here</li>
                <li>Your browser will open for Google sign-in</li>
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={
              !projectId.trim() ||
              (authMethod === 'OAuth' && !oauthClientPath.trim()) ||
              loading ||
              (saveAsProfile && !profileName.trim())
            }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-md transition-colors"
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Handle OAuth Connection Success

**Listen for OAuth connection events:**

```typescript
// In App.tsx or connection context
useEffect(() => {
  const unsubscribe = EventsOn('connection:success', (data: any) => {
    if (data.authMethod === 'OAuth') {
      console.log(`Connected with OAuth as ${data.userEmail}`);
      // Show success notification
    }
  });

  return unsubscribe;
}, []);
```

---

## Token Management

### Token Lifecycle

1. **Initial Authentication**
   - User clicks "Connect with OAuth"
   - Browser opens, user logs in
   - Tokens stored encrypted

2. **Subsequent Connections**
   - App loads saved token
   - Checks if expired
   - Uses token if valid

3. **Token Refresh**
   - If access token expired
   - Use refresh token to get new access token
   - Update stored token

4. **Token Expiration**
   - If refresh token invalid/expired
   - Prompt user to re-authenticate
   - Start OAuth flow again

### Token Storage Security

- **Encryption**: AES-256-GCM encryption
- **Key Storage**: Encryption key stored in `~/.pubsub-gui/.key` (600 permissions)
- **File Permissions**: Token files have 600 permissions (owner read/write only)
- **Location**: `~/.pubsub-gui/tokens/{profile-id}.json`

### Token Cleanup

When deleting a profile:

```go
// In DeleteProfile method
if profile.AuthMethod == "OAuth" {
    tokenStore, _ := auth.NewTokenStore(configDir)
    tokenStore.DeleteToken(profileID)
}
```

---

## Security Considerations

### 1. OAuth Client Secret Protection

**Problem**: Client secret in JSON file could be compromised.

**Mitigation**:
- Desktop app type has less risk than web apps
- Store OAuth JSON in user's home directory (not in app bundle)
- Document that users should keep JSON file secure
- Consider using PKCE without client secret (native app flow)

### 2. Token Storage Security

**Protection Measures**:
- AES-256-GCM encryption for tokens
- File permissions 600 (owner only)
- Encryption key stored separately
- Key never leaves local machine

### 3. Redirect URI Security

**Measures**:
- Use PKCE to prevent authorization code interception
- Validate state parameter for CSRF protection
- Localhost-only redirect URI
- Random port binding (reduces conflicts)

### 4. Browser Opening Security

**Considerations**:
- Validate URL before opening
- Use system default browser
- No execution of arbitrary commands

### 5. Scope Limitation

**Best Practice**:
- Request minimum scopes needed
- Use `https://www.googleapis.com/auth/pubsub` only
- Avoid broader `cloud-platform` scope unless necessary

---

## Testing Strategy

### Manual Testing Checklist

#### OAuth Flow Testing

- [ ] Click "Connect with OAuth"
- [ ] Browser opens to Google consent screen
- [ ] Login with Google account
- [ ] Grant permissions
- [ ] Redirected to success page
- [ ] App shows "Connected"
- [ ] Topics and subscriptions load

#### Token Refresh Testing

- [ ] Connect with OAuth
- [ ] Wait for token to expire (or manually expire)
- [ ] Reconnect to same profile
- [ ] Verify token refreshed automatically
- [ ] No re-authentication required

#### Error Handling Testing

- [ ] Cancel OAuth flow in browser
- [ ] Verify error message shown
- [ ] Select invalid OAuth JSON file
- [ ] Verify validation error
- [ ] Revoke token in Google Account settings
- [ ] Reconnect and verify re-authentication required

#### Profile Management Testing

- [ ] Save OAuth connection as profile
- [ ] Switch to different profile
- [ ] Switch back to OAuth profile
- [ ] Verify reconnects without re-auth
- [ ] Delete OAuth profile
- [ ] Verify token file deleted

### Automated Testing

**Unit Tests (`internal/auth/oauth_test.go`):**

```go
func TestPKCEGeneration(t *testing.T) {
    pkce, err := generatePKCE()
    assert.NoError(t, err)
    assert.NotEmpty(t, pkce.Verifier)
    assert.NotEmpty(t, pkce.Challenge)
}

func TestTokenEncryption(t *testing.T) {
    tokenStore, _ := NewTokenStore(t.TempDir())
    token := &models.OAuthToken{
        AccessToken: "test-access",
        RefreshToken: "test-refresh",
    }

    err := tokenStore.SaveToken("test-profile", token)
    assert.NoError(t, err)

    loaded, err := tokenStore.LoadToken("test-profile")
    assert.NoError(t, err)
    assert.Equal(t, token.AccessToken, loaded.AccessToken)
}
```

---

## Migration Guide

### For Existing Users

OAuth authentication is a new option that doesn't affect existing ADC or Service Account connections.

**No Action Required**: Existing profiles continue to work.

**Optional**: Add OAuth profiles for easier access.

### For New Users

**Quick Start Guide**:

1. **Get OAuth Credentials**:
   - Go to https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 Client ID (Desktop app)
   - Download JSON file

2. **Connect to Pub/Sub GUI**:
   - Click "Connect"
   - Select "OAuth (Google Account)"
   - Enter project ID
   - Select downloaded JSON file
   - Click "Connect"

3. **Authenticate**:
   - Browser opens automatically
   - Sign in with Google
   - Grant permissions
   - Return to app

4. **Done**: Browse topics and subscriptions!

---

## Troubleshooting

### Common Issues

#### Issue: "Failed to open browser"

**Solution**:
- Manually copy the URL shown in error message
- Paste into browser
- Complete authentication
- App will detect callback

#### Issue: "Invalid OAuth client"

**Cause**: Wrong JSON file format or corrupted file

**Solution**:
- Re-download OAuth client JSON from GCP Console
- Ensure it's a Desktop app type (not Web app)
- Check JSON format matches expected structure

#### Issue: "Token refresh failed"

**Cause**: Refresh token expired or revoked

**Solution**:
- Delete the profile and recreate
- Or click "Reconnect" to re-authenticate
- Check if OAuth consent was revoked in Google Account settings

#### Issue: "Callback server failed to start"

**Cause**: Port 8888 already in use

**Solution**:
- Close other applications using port 8888
- Or modify code to use different port
- Check firewall isn't blocking localhost

#### Issue: "Scope not granted"

**Cause**: User didn't grant Pub/Sub permission

**Solution**:
- Re-authenticate
- Ensure you click "Allow" for all permissions
- Check OAuth consent screen configuration in GCP

---

## Future Enhancements

### Phase 2 Features

1. **Multiple Account Support**
   - Switch between Google accounts
   - Visual indicator of active account
   - Account-specific profiles

2. **Token Auto-Refresh**
   - Background token refresh
   - Seamless re-authentication
   - Proactive expiry handling

3. **OAuth Scope Management**
   - Configurable scopes
   - Minimal permission mode
   - Scope upgrade prompts

4. **Offline Support**
   - Cached credentials
   - Grace period for expired tokens
   - Offline mode detection

5. **Enterprise Support**
   - Workspace domain restriction
   - Admin-managed OAuth clients
   - Centralized credential management

---

## Implementation Checklist

### Backend Tasks

- [ ] Add OAuth dependencies to `go.mod`
- [ ] Create `internal/models/oauth.go`
- [ ] Update `internal/models/connection.go`
- [ ] Create `internal/auth/token_store.go`
- [ ] Create `internal/auth/oauth.go`
- [ ] Create `internal/auth/oauth_server.go`
- [ ] Create `internal/auth/oauth_browser.go`
- [ ] Create `internal/auth/oauth_client.go`
- [ ] Update `internal/app/connection_handler.go`
- [ ] Update `app.go` with ConnectWithOAuth method
- [ ] Test token encryption/decryption
- [ ] Test OAuth flow end-to-end
- [ ] Test token refresh logic

### Frontend Tasks

- [ ] Update TypeScript types
- [ ] Update `ConnectionDialog.tsx` with OAuth option
- [ ] Add file picker for OAuth JSON
- [ ] Handle OAuth connection events
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test UI flow
- [ ] Test profile saving

### Documentation Tasks

- [ ] Update `CLAUDE.md` with OAuth instructions
- [ ] Create user guide for OAuth setup
- [ ] Document GCP Console setup steps
- [ ] Add troubleshooting section to README
- [ ] Create video tutorial (optional)

### Testing Tasks

- [ ] Manual testing on macOS
- [ ] Manual testing on Windows
- [ ] Manual testing on Linux
- [ ] Token storage security audit
- [ ] OAuth flow security review
- [ ] Performance testing

---

## Resources

### Official Documentation

- **OAuth 2.0**: https://oauth.net/2/
- **Google OAuth**: https://developers.google.com/identity/protocols/oauth2
- **PKCE**: https://oauth.net/2/pkce/
- **GCP OAuth Setup**: https://cloud.google.com/docs/authentication/end-user

### Libraries

- **golang.org/x/oauth2**: OAuth 2.0 client library for Go
- **golang.org/x/oauth2/google**: Google-specific OAuth utilities

### Security References

- **OAuth 2.0 for Native Apps**: RFC 8252
- **PKCE**: RFC 7636
- **OAuth Security Best Practices**: https://tools.ietf.org/html/draft-ietf-oauth-security-topics

---

**Last Updated:** 2026-01-06
**Status:** Implementation Plan
**Target Release:** v2.0.0 (with OAuth support)
