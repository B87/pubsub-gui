// Package auth handles Pub/Sub client creation with OAuth2 credentials
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
	authenticator := NewOAuthAuthenticator(oauthConfig)

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
			if err := tokenStore.SaveToken(profileID, newStoredToken); err != nil {
				// Non-fatal error, log but continue
				fmt.Printf("Warning: failed to save refreshed token: %v\n", err)
			}
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
