// Package version provides version checking and update functionality
package version

import (
	"fmt"
	"strings"

	hv "github.com/hashicorp/go-version"
)

// CheckForUpdates checks if a newer version is available
// Returns UpdateInfo with comparison results
// Skips check for "dev" builds
func CheckForUpdates() (*UpdateInfo, error) {
	currentVersion := GetVersion()

	// Skip check for dev builds
	if currentVersion == "dev" || strings.HasPrefix(strings.ToLower(currentVersion), "dev") {
		return &UpdateInfo{
			CurrentVersion:    currentVersion,
			LatestVersion:     currentVersion,
			ReleaseNotes:      "",
			ReleaseURL:        "",
			PublishedAt:       "",
			IsUpdateAvailable: false,
		}, nil
	}

	// Fetch latest release from GitHub
	release, err := FetchLatestRelease()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch latest release: %w", err)
	}

	// Normalize versions (remove 'v' prefix if present)
	currentNormalized := normalizeVersion(currentVersion)
	latestNormalized := normalizeVersion(release.TagName)

	// Compare versions using go-version library
	currentVer, err := hv.NewVersion(currentNormalized)
	if err != nil {
		return nil, fmt.Errorf("failed to parse current version '%s': %w", currentNormalized, err)
	}

	latestVer, err := hv.NewVersion(latestNormalized)
	if err != nil {
		return nil, fmt.Errorf("failed to parse latest version '%s': %w", latestNormalized, err)
	}

	isUpdateAvailable := latestVer.GreaterThan(currentVer)

	return &UpdateInfo{
		CurrentVersion:    currentVersion,
		LatestVersion:     release.TagName,
		ReleaseNotes:      release.Body,
		ReleaseURL:        release.HTMLURL,
		PublishedAt:       release.PublishedAt.Format("2006-01-02T15:04:05Z"),
		IsUpdateAvailable: isUpdateAvailable,
	}, nil
}

// normalizeVersion removes the 'v' prefix from version strings if present
func normalizeVersion(v string) string {
	v = strings.TrimSpace(v)
	if strings.HasPrefix(v, "v") || strings.HasPrefix(v, "V") {
		return v[1:]
	}
	return v
}
