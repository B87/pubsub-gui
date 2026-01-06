// Package models defines OAuth2 token and configuration structures
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
