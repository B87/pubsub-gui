// Package auth handles OAuth2 authentication flow
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"pubsub-gui/internal/models"
)

// OAuthAuthenticator handles OAuth2 authentication flow
type OAuthAuthenticator struct {
	config *oauth2.Config
}

// NewOAuthAuthenticator creates a new OAuth authenticator
func NewOAuthAuthenticator(oauthConfig *models.OAuthConfig) *OAuthAuthenticator {
	config := &oauth2.Config{
		ClientID:     oauthConfig.ClientID,
		ClientSecret: oauthConfig.ClientSecret,
		RedirectURL:  oauthConfig.RedirectURL,
		Scopes:       oauthConfig.Scopes,
		Endpoint:     google.Endpoint,
	}

	return &OAuthAuthenticator{
		config: config,
	}
}

// PKCEChallenge represents PKCE verification codes
type PKCEChallenge struct {
	Verifier  string
	Challenge string
}

// generatePKCE generates PKCE codes for secure OAuth flow
func generatePKCE() (*PKCEChallenge, error) {
	// Generate code verifier (random 32 bytes, base64url encoded)
	verifierBytes := make([]byte, 32)
	if _, err := rand.Read(verifierBytes); err != nil {
		return nil, err
	}
	verifier := base64.RawURLEncoding.EncodeToString(verifierBytes)

	// Generate code challenge (SHA256 hash of verifier, base64url encoded)
	hash := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(hash[:])

	return &PKCEChallenge{
		Verifier:  verifier,
		Challenge: challenge,
	}, nil
}

// AuthenticateResult contains the result of OAuth authentication
type AuthenticateResult struct {
	Token     *oauth2.Token
	UserEmail string
	Success   bool
	ErrorMsg  string
	AuthCode  string // Used internally for code exchange
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
	// Ensure server is stopped even if authentication fails or is cancelled
	defer func() {
		if err := callbackServer.Stop(); err != nil {
			fmt.Printf("Warning: failed to stop callback server: %v\n", err)
		}
	}()

	// Build authorization URL with PKCE
	authURL := oa.config.AuthCodeURL(state,
		oauth2.AccessTypeOffline, // Request refresh token
		oauth2.ApprovalForce,     // Force consent screen
		oauth2.SetAuthURLParam("code_challenge", pkce.Challenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
	)

	// Open browser for user to authenticate
	if err := OpenURL(authURL); err != nil {
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
