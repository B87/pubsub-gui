// Package auth handles secure storage of OAuth tokens
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
		return fmt.Errorf("failed to delete token file: %w", err)
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
