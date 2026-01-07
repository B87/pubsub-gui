// Package version provides version checking and update functionality
package version

import "fmt"

const (
	// GitHubOwner is the GitHub organization/username for the repository
	GitHubOwner = "B87"
	// GitHubRepo is the repository name
	GitHubRepo = "pubsub-gui"
)

// version is set via ldflags during build (main.version -> SetVersion()) or by SetVersion()
// Default to "dev" for development builds
// Note: Direct ldflags injection to internal/version.version is not possible due to unexported variable,
// so we use SetVersion() called from main.go which reads from main.version (set via ldflags)
var version = "dev"

// SetVersion sets the application version
// This should be called from main package with the version from ldflags
func SetVersion(v string) {
	if v != "" {
		version = v
	}
}

// GetVersion returns the application version
// Falls back to "dev" if not set
func GetVersion() string {
	if version == "" {
		return "dev"
	}
	return version
}

// GetReleasesURL returns the GitHub releases API URL for the repository
func GetReleasesURL() string {
	return fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", GitHubOwner, GitHubRepo)
}
