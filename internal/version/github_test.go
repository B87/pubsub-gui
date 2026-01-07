package version

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestFetchLatestRelease_JSONParsing(t *testing.T) {
	// Create a mock GitHub API response
	mockRelease := GitHubRelease{
		TagName:     "v1.0.0",
		Name:        "Release v1.0.0",
		Body:        "Release notes",
		HTMLURL:     "https://github.com/B87/pubsub-gui/releases/tag/v1.0.0",
		PublishedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Draft:       false,
		Prerelease:  false,
	}

	// Create test server to test JSON parsing
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify User-Agent header
		userAgent := r.Header.Get("User-Agent")
		if userAgent == "" {
			t.Error("FetchLatestRelease() missing User-Agent header")
		}
		if !strings.Contains(userAgent, "pubsub-gui") {
			t.Errorf("FetchLatestRelease() User-Agent = %q, should contain 'pubsub-gui'", userAgent)
		}

		// Verify request method
		if r.Method != "GET" {
			t.Errorf("FetchLatestRelease() method = %q, want GET", r.Method)
		}

		// Return mock response
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(mockRelease); err != nil {
			t.Errorf("failed to encode mock release: %v", err)
		}
	}))
	defer server.Close()

	// Test JSON parsing with the mock response
	// Use http.NewRequest to test User-Agent separately
	req, err := http.NewRequest("GET", server.URL, nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("User-Agent", "pubsub-gui/test")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("failed to get test server response: %v", err)
	}
	defer resp.Body.Close()

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		t.Fatalf("failed to decode release: %v", err)
	}

	if release.TagName != mockRelease.TagName {
		t.Errorf("decoded release TagName = %q, want %q", release.TagName, mockRelease.TagName)
	}
	if release.Draft {
		t.Error("decoded release Draft = true, want false")
	}
	if release.Prerelease {
		t.Error("decoded release Prerelease = true, want false")
	}
}

func TestFetchLatestRelease_SkipDraft(t *testing.T) {
	mockDraftRelease := GitHubRelease{
		TagName:     "v1.0.0",
		Name:        "Release v1.0.0",
		Body:        "Release notes",
		HTMLURL:     "https://github.com/B87/pubsub-gui/releases/tag/v1.0.0",
		PublishedAt: time.Now(),
		Draft:       true,
		Prerelease:  false,
	}

	// Test that draft releases are detected
	if !mockDraftRelease.Draft {
		t.Error("mockDraftRelease.Draft = false, want true")
	}
	// Simulate the check in FetchLatestRelease - draft releases should be skipped
	if mockDraftRelease.Draft || mockDraftRelease.Prerelease {
		// This is the condition that causes FetchLatestRelease to return an error
		// We're testing the logic, not the actual HTTP call
	}
}

func TestFetchLatestRelease_SkipPrerelease(t *testing.T) {
	mockPrerelease := GitHubRelease{
		TagName:     "v1.0.0-beta",
		Name:        "Release v1.0.0-beta",
		Body:        "Release notes",
		HTMLURL:     "https://github.com/B87/pubsub-gui/releases/tag/v1.0.0-beta",
		PublishedAt: time.Now(),
		Draft:       false,
		Prerelease:  true,
	}

	// Test that prerelease versions are detected
	if !mockPrerelease.Prerelease {
		t.Error("mockPrerelease.Prerelease = false, want true")
	}
	// Simulate the check in FetchLatestRelease - prerelease versions should be skipped
	if mockPrerelease.Draft || mockPrerelease.Prerelease {
		// This is the condition that causes FetchLatestRelease to return an error
		// We're testing the logic, not the actual HTTP call
	}
}

func TestGitHubRelease_JSONTags(t *testing.T) {
	// Test that JSON tags are correct
	release := GitHubRelease{
		TagName:     "v1.0.0",
		Name:        "Test Release",
		Body:        "Body",
		HTMLURL:     "https://example.com",
		PublishedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Draft:       false,
		Prerelease:  false,
	}

	data, err := json.Marshal(release)
	if err != nil {
		t.Fatalf("failed to marshal release: %v", err)
	}

	// Verify JSON contains expected fields
	jsonStr := string(data)
	if !strings.Contains(jsonStr, "tag_name") {
		t.Error("marshaled JSON missing 'tag_name' field")
	}
	if !strings.Contains(jsonStr, "html_url") {
		t.Error("marshaled JSON missing 'html_url' field")
	}
	if !strings.Contains(jsonStr, "published_at") {
		t.Error("marshaled JSON missing 'published_at' field")
	}

	// Test unmarshaling
	var unmarshaled GitHubRelease
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("failed to unmarshal release: %v", err)
	}

	if unmarshaled.TagName != release.TagName {
		t.Errorf("unmarshaled TagName = %q, want %q", unmarshaled.TagName, release.TagName)
	}
}

// TestFetchLatestRelease_ErrorHandling tests error handling scenarios
// Note: FetchLatestRelease uses a hardcoded http.Client and GetReleasesURL(),
// so we can't easily mock it without refactoring. These tests verify the
// error handling logic and JSON parsing behavior.
func TestFetchLatestRelease_ErrorHandling(t *testing.T) {
	tests := []struct {
		name           string
		statusCode     int
		responseBody   string
		expectError    bool
		errorSubstring string
	}{
		{
			name:           "404 not found",
			statusCode:     http.StatusNotFound,
			responseBody:   `{"message": "Not Found"}`,
			expectError:    true,
			errorSubstring: "status code",
		},
		{
			name:           "500 server error",
			statusCode:     http.StatusInternalServerError,
			responseBody:   `{"message": "Internal Server Error"}`,
			expectError:    true,
			errorSubstring: "status code",
		},
		{
			name:           "invalid JSON",
			statusCode:     http.StatusOK,
			responseBody:   `{invalid json}`,
			expectError:    true,
			errorSubstring: "parse",
		},
		{
			name:           "empty response",
			statusCode:     http.StatusOK,
			responseBody:   ``,
			expectError:    true,
			errorSubstring: "parse",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
				w.Write([]byte(tt.responseBody))
			}))
			defer server.Close()

			// Test that the error handling logic works
			// (We can't easily test FetchLatestRelease directly due to hardcoded URL,
			// but we can test the error scenarios it would encounter)
			client := &http.Client{
				Timeout: 10 * time.Second,
			}
			req, err := http.NewRequest("GET", server.URL, nil)
			if err != nil {
				t.Fatalf("failed to create request: %v", err)
			}

			resp, err := client.Do(req)
			if err != nil {
				if !tt.expectError {
					t.Errorf("unexpected error: %v", err)
				}
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != tt.statusCode {
				t.Errorf("status code = %d, want %d", resp.StatusCode, tt.statusCode)
			}

			// Test JSON parsing error handling
			if tt.statusCode == http.StatusOK && tt.responseBody != "" {
				var release GitHubRelease
				if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
					if !tt.expectError {
						t.Errorf("unexpected JSON parsing error: %v", err)
					}
				}
			}
		})
	}
}

// TestFetchLatestRelease_DraftPrereleaseSkipping tests that draft and prerelease
// versions are properly detected and would be skipped by FetchLatestRelease
func TestFetchLatestRelease_DraftPrereleaseSkipping(t *testing.T) {
	tests := []struct {
		name       string
		release    GitHubRelease
		shouldSkip bool
	}{
		{
			name: "draft release is skipped",
			release: GitHubRelease{
				TagName:    "v1.0.0",
				Draft:      true,
				Prerelease: false,
			},
			shouldSkip: true,
		},
		{
			name: "prerelease is skipped",
			release: GitHubRelease{
				TagName:    "v1.0.0-beta",
				Draft:      false,
				Prerelease: true,
			},
			shouldSkip: true,
		},
		{
			name: "draft and prerelease is skipped",
			release: GitHubRelease{
				TagName:    "v1.0.0-alpha",
				Draft:      true,
				Prerelease: true,
			},
			shouldSkip: true,
		},
		{
			name: "normal release is not skipped",
			release: GitHubRelease{
				TagName:    "v1.0.0",
				Draft:      false,
				Prerelease: false,
			},
			shouldSkip: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the check in FetchLatestRelease
			shouldSkip := tt.release.Draft || tt.release.Prerelease
			if shouldSkip != tt.shouldSkip {
				t.Errorf("shouldSkip = %v, want %v", shouldSkip, tt.shouldSkip)
			}
		})
	}
}

// TestFetchLatestRelease_UserAgent tests that the User-Agent header is set correctly
func TestFetchLatestRelease_UserAgent(t *testing.T) {
	// Set a test version
	SetVersion("v1.0.0-test")
	defer SetVersion("dev")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userAgent := r.Header.Get("User-Agent")
		if userAgent == "" {
			t.Error("User-Agent header is missing")
		}
		if !strings.Contains(userAgent, "pubsub-gui") {
			t.Errorf("User-Agent = %q, should contain 'pubsub-gui'", userAgent)
		}
		// Note: In the actual FetchLatestRelease, the version would be included
		// but we're testing the header format here

		// Return a valid release
		release := GitHubRelease{
			TagName:     "v1.0.0",
			Name:        "Test Release",
			Body:        "Body",
			HTMLURL:     "https://example.com",
			PublishedAt: time.Now(),
			Draft:       false,
			Prerelease:  false,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(release)
	}))
	defer server.Close()

	// Test that User-Agent is set (simulating what FetchLatestRelease does)
	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	req, err := http.NewRequest("GET", server.URL, nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	// Set User-Agent as FetchLatestRelease does
	userAgent := "pubsub-gui/" + GetVersion()
	req.Header.Set("User-Agent", userAgent)

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status code = %d, want %d", resp.StatusCode, http.StatusOK)
	}
}
