package version

import (
	"strings"
	"testing"
)

func TestGetVersion(t *testing.T) {
	// Save original version and restore after all tests
	originalVersion := version
	defer func() {
		version = originalVersion
	}()

	tests := []struct {
		name  string
		setup func()
		want  string
	}{
		{
			name: "default dev version",
			setup: func() {
				version = "dev"
			},
			want: "dev",
		},
		{
			name: "set version to v1.0.0",
			setup: func() {
				version = "v1.0.0"
			},
			want: "v1.0.0",
		},
		{
			name: "set version to 1.2.3",
			setup: func() {
				version = "1.2.3"
			},
			want: "1.2.3",
		},
		{
			name: "empty version returns dev",
			setup: func() {
				version = ""
			},
			want: "dev", // GetVersion returns "dev" if version is empty
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset before each test
			version = originalVersion
			tt.setup()
			got := GetVersion()
			if got != tt.want {
				t.Errorf("GetVersion() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestSetVersion(t *testing.T) {
	// Run tests sequentially to avoid shared state issues
	t.Run("set valid version", func(t *testing.T) {
		originalVersion := version
		defer func() {
			version = originalVersion
		}()

		SetVersion("v2.0.0")
		got := GetVersion()
		if got != "v2.0.0" {
			t.Errorf("SetVersion(%q) then GetVersion() = %q, want %q", "v2.0.0", got, "v2.0.0")
		}
	})

	t.Run("set version without v prefix", func(t *testing.T) {
		originalVersion := version
		defer func() {
			version = originalVersion
		}()

		SetVersion("2.1.0")
		got := GetVersion()
		if got != "2.1.0" {
			t.Errorf("SetVersion(%q) then GetVersion() = %q, want %q", "2.1.0", got, "2.1.0")
		}
	})

	t.Run("empty version does not change version", func(t *testing.T) {
		originalVersion := version
		defer func() {
			version = originalVersion
		}()

		// Set a known version first
		SetVersion("test-version")
		SetVersion("") // SetVersion("") doesn't change version (see implementation)
		got := GetVersion()
		// SetVersion("") doesn't modify version, so it should still be "test-version"
		if got != "test-version" {
			t.Errorf("SetVersion(%q) then GetVersion() = %q, want %q (SetVersion doesn't change version when empty)", "", got, "test-version")
		}
	})

	t.Run("directly setting empty version returns dev", func(t *testing.T) {
		originalVersion := version
		defer func() {
			version = originalVersion
		}()

		// Directly set version to empty (simulating what GetVersion handles)
		version = ""
		got := GetVersion()
		if got != "dev" {
			t.Errorf("GetVersion() with empty version = %q, want %q", got, "dev")
		}
	})
}

func TestGetReleasesURL(t *testing.T) {
	got := GetReleasesURL()
	want := "https://api.github.com/repos/B87/pubsub-gui/releases/latest"

	if got != want {
		t.Errorf("GetReleasesURL() = %q, want %q", got, want)
	}

	// Verify it contains the correct owner and repo
	if !strings.Contains(got, GitHubOwner) {
		t.Errorf("GetReleasesURL() = %q, should contain owner %q", got, GitHubOwner)
	}
	if !strings.Contains(got, GitHubRepo) {
		t.Errorf("GetReleasesURL() = %q, should contain repo %q", got, GitHubRepo)
	}
}
