// Package version provides version checking and update functionality
package version

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// FetchLatestRelease fetches the latest release from GitHub API
// Skips draft and prerelease versions
func FetchLatestRelease() (*GitHubRelease, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	url := GetReleasesURL()
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set User-Agent header
	userAgent := fmt.Sprintf("pubsub-gui/%s", GetVersion())
	req.Header.Set("User-Agent", userAgent)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch release: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var release GitHubRelease
	if err := json.Unmarshal(body, &release); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Skip draft and prerelease versions
	if release.Draft || release.Prerelease {
		return nil, fmt.Errorf("latest release is draft or prerelease, skipping")
	}

	return &release, nil
}
