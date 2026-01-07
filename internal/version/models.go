// Package version provides version checking and update functionality
package version

import "time"

// GitHubRelease represents a GitHub release from the API
type GitHubRelease struct {
	TagName     string    `json:"tag_name"`
	Name        string    `json:"name"`
	Body        string    `json:"body"`
	HTMLURL     string    `json:"html_url"`
	PublishedAt time.Time `json:"published_at"`
	Draft       bool      `json:"draft"`
	Prerelease  bool      `json:"prerelease"`
}

// UpdateInfo represents information about an available update
type UpdateInfo struct {
	CurrentVersion    string `json:"currentVersion"`
	LatestVersion     string `json:"latestVersion"`
	ReleaseNotes      string `json:"releaseNotes"`
	ReleaseURL        string `json:"releaseUrl"`
	PublishedAt       string `json:"publishedAt"`
	IsUpdateAvailable bool   `json:"isUpdateAvailable"`
}
