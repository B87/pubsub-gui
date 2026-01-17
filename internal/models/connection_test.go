package models

import (
	"strings"
	"testing"
)

func TestConnectionProfile_Validate(t *testing.T) {
	tests := []struct {
		name    string
		profile ConnectionProfile
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid profile with ADC",
			profile: ConnectionProfile{
				ID:         "test-id",
				Name:       "Test Profile",
				ProjectID:  "my-project",
				AuthMethod: "ADC",
			},
			wantErr: false,
		},
		{
			name: "valid profile with ServiceAccount",
			profile: ConnectionProfile{
				ID:                 "test-id",
				Name:               "Test Profile",
				ProjectID:          "my-project",
				AuthMethod:         "ServiceAccount",
				ServiceAccountPath: "/path/to/sa.json",
			},
			wantErr: false,
		},
		{
			name: "valid profile with OAuth",
			profile: ConnectionProfile{
				ID:              "test-id",
				Name:            "Test Profile",
				ProjectID:       "my-project",
				AuthMethod:      "OAuth",
				OAuthClientPath: "/path/to/oauth.json",
			},
			wantErr: false,
		},
		{
			name: "empty ID",
			profile: ConnectionProfile{
				ID:         "",
				Name:       "Test Profile",
				ProjectID:  "my-project",
				AuthMethod: "ADC",
			},
			wantErr: true,
			errMsg:  "profile ID cannot be empty",
		},
		{
			name: "empty name",
			profile: ConnectionProfile{
				ID:         "test-id",
				Name:       "",
				ProjectID:  "my-project",
				AuthMethod: "ADC",
			},
			wantErr: true,
			errMsg:  "profile name cannot be empty",
		},
		{
			name: "empty project ID",
			profile: ConnectionProfile{
				ID:         "test-id",
				Name:       "Test Profile",
				ProjectID:  "",
				AuthMethod: "ADC",
			},
			wantErr: true,
			errMsg:  "project ID cannot be empty",
		},
		{
			name: "invalid auth method",
			profile: ConnectionProfile{
				ID:         "test-id",
				Name:       "Test Profile",
				ProjectID:  "my-project",
				AuthMethod: "Invalid",
			},
			wantErr: true,
			errMsg:  "auth method must be 'ADC', 'ServiceAccount', or 'OAuth'",
		},
		{
			name: "ServiceAccount without path",
			profile: ConnectionProfile{
				ID:         "test-id",
				Name:       "Test Profile",
				ProjectID:  "my-project",
				AuthMethod: "ServiceAccount",
			},
			wantErr: true,
			errMsg:  "service account path required",
		},
		{
			name: "OAuth without path",
			profile: ConnectionProfile{
				ID:         "test-id",
				Name:       "Test Profile",
				ProjectID:  "my-project",
				AuthMethod: "OAuth",
			},
			wantErr: true,
			errMsg:  "OAuth client path required",
		},
		// Emulator mode validation tests
		{
			name: "valid emulator mode off",
			profile: ConnectionProfile{
				ID:           "test-id",
				Name:         "Test Profile",
				ProjectID:    "my-project",
				AuthMethod:   "ADC",
				EmulatorMode: EmulatorModeOff,
			},
			wantErr: false,
		},
		{
			name: "valid emulator mode external",
			profile: ConnectionProfile{
				ID:           "test-id",
				Name:         "Test Profile",
				ProjectID:    "my-project",
				AuthMethod:   "ADC",
				EmulatorMode: EmulatorModeExternal,
				EmulatorHost: "localhost:8085",
			},
			wantErr: false,
		},
		{
			name: "valid emulator mode managed",
			profile: ConnectionProfile{
				ID:           "test-id",
				Name:         "Test Profile",
				ProjectID:    "my-project",
				AuthMethod:   "ADC",
				EmulatorMode: EmulatorModeManaged,
				ManagedEmulator: &ManagedEmulatorConfig{
					Port:      8085,
					AutoStart: true,
					AutoStop:  true,
				},
			},
			wantErr: false,
		},
		{
			name: "invalid emulator mode",
			profile: ConnectionProfile{
				ID:           "test-id",
				Name:         "Test Profile",
				ProjectID:    "my-project",
				AuthMethod:   "ADC",
				EmulatorMode: "invalid",
			},
			wantErr: true,
			errMsg:  "emulator mode must be 'off', 'external', or 'managed'",
		},
		{
			name: "external mode without host",
			profile: ConnectionProfile{
				ID:           "test-id",
				Name:         "Test Profile",
				ProjectID:    "my-project",
				AuthMethod:   "ADC",
				EmulatorMode: EmulatorModeExternal,
			},
			wantErr: true,
			errMsg:  "emulator host required when using external emulator mode",
		},
		{
			name: "managed mode with port 0 (valid, defaults to 8085)",
			profile: ConnectionProfile{
				ID:           "test-id",
				Name:         "Test Profile",
				ProjectID:    "my-project",
				AuthMethod:   "ADC",
				EmulatorMode: EmulatorModeManaged,
				ManagedEmulator: &ManagedEmulatorConfig{
					Port: 0,
				},
			},
			wantErr: false,
		},
		{
			name: "managed mode with invalid port (too low)",
			profile: ConnectionProfile{
				ID:           "test-id",
				Name:         "Test Profile",
				ProjectID:    "my-project",
				AuthMethod:   "ADC",
				EmulatorMode: EmulatorModeManaged,
				ManagedEmulator: &ManagedEmulatorConfig{
					Port: -1,
				},
			},
			wantErr: true,
			errMsg:  "managed emulator port must be 0 (default) or between 1 and 65535",
		},
		{
			name: "managed mode with invalid port (too high)",
			profile: ConnectionProfile{
				ID:           "test-id",
				Name:         "Test Profile",
				ProjectID:    "my-project",
				AuthMethod:   "ADC",
				EmulatorMode: EmulatorModeManaged,
				ManagedEmulator: &ManagedEmulatorConfig{
					Port: 65536,
				},
			},
			wantErr: true,
			errMsg:  "managed emulator port must be 0 (default) or between 1 and 65535",
		},
		{
			name: "managed mode with invalid bind address",
			profile: ConnectionProfile{
				ID:           "test-id",
				Name:         "Test Profile",
				ProjectID:    "my-project",
				AuthMethod:   "ADC",
				EmulatorMode: EmulatorModeManaged,
				ManagedEmulator: &ManagedEmulatorConfig{
					Port:        8085,
					BindAddress: "192.168.1.1",
				},
			},
			wantErr: true,
			errMsg:  "managed emulator bind address must be '127.0.0.1' or '0.0.0.0'",
		},
		{
			name: "managed mode with valid bind address 0.0.0.0",
			profile: ConnectionProfile{
				ID:           "test-id",
				Name:         "Test Profile",
				ProjectID:    "my-project",
				AuthMethod:   "ADC",
				EmulatorMode: EmulatorModeManaged,
				ManagedEmulator: &ManagedEmulatorConfig{
					Port:        8085,
					BindAddress: "0.0.0.0",
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.profile.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("ConnectionProfile.Validate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && tt.errMsg != "" {
				if err == nil || !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ConnectionProfile.Validate() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}

func TestConnectionProfile_GetEffectiveEmulatorMode(t *testing.T) {
	tests := []struct {
		name    string
		profile ConnectionProfile
		want    EmulatorMode
	}{
		{
			name: "explicit off mode",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeOff,
			},
			want: EmulatorModeOff,
		},
		{
			name: "explicit external mode",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeExternal,
				EmulatorHost: "localhost:8085",
			},
			want: EmulatorModeExternal,
		},
		{
			name: "explicit managed mode",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeManaged,
			},
			want: EmulatorModeManaged,
		},
		{
			name: "migration - emulatorHost set without mode",
			profile: ConnectionProfile{
				EmulatorHost: "localhost:8085",
			},
			want: EmulatorModeExternal,
		},
		{
			name:    "migration - no emulator config",
			profile: ConnectionProfile{},
			want:    EmulatorModeOff,
		},
		{
			name: "migration - empty emulatorHost",
			profile: ConnectionProfile{
				EmulatorHost: "",
			},
			want: EmulatorModeOff,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.profile.GetEffectiveEmulatorMode()
			if got != tt.want {
				t.Errorf("ConnectionProfile.GetEffectiveEmulatorMode() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestConnectionProfile_GetEffectiveEmulatorHost(t *testing.T) {
	tests := []struct {
		name    string
		profile ConnectionProfile
		want    string
	}{
		{
			name: "external mode returns emulatorHost",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeExternal,
				EmulatorHost: "custom-host:9090",
			},
			want: "custom-host:9090",
		},
		{
			name: "managed mode with config returns constructed host",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeManaged,
				ManagedEmulator: &ManagedEmulatorConfig{
					Port:        8086,
					BindAddress: "127.0.0.1",
				},
			},
			want: "127.0.0.1:8086",
		},
		{
			name: "managed mode with 0.0.0.0 returns localhost",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeManaged,
				ManagedEmulator: &ManagedEmulatorConfig{
					Port:        8087,
					BindAddress: "0.0.0.0",
				},
			},
			want: "127.0.0.1:8087",
		},
		{
			name: "managed mode without config returns default",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeManaged,
			},
			want: "127.0.0.1:8085",
		},
		{
			name: "managed mode with zero port uses default",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeManaged,
				ManagedEmulator: &ManagedEmulatorConfig{
					Port: 0,
				},
			},
			want: "127.0.0.1:8085",
		},
		{
			name: "managed mode with empty bind address uses localhost",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeManaged,
				ManagedEmulator: &ManagedEmulatorConfig{
					Port:        8088,
					BindAddress: "",
				},
			},
			want: "127.0.0.1:8088",
		},
		{
			name: "off mode returns empty string",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeOff,
			},
			want: "",
		},
		{
			name: "migration - emulatorHost set returns it",
			profile: ConnectionProfile{
				EmulatorHost: "legacy-host:8085",
			},
			want: "legacy-host:8085",
		},
		{
			name:    "migration - no config returns empty",
			profile: ConnectionProfile{},
			want:    "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.profile.GetEffectiveEmulatorHost()
			if got != tt.want {
				t.Errorf("ConnectionProfile.GetEffectiveEmulatorHost() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestConnectionProfile_IsEmulatorEnabled(t *testing.T) {
	tests := []struct {
		name    string
		profile ConnectionProfile
		want    bool
	}{
		{
			name: "off mode returns false",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeOff,
			},
			want: false,
		},
		{
			name: "external mode returns true",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeExternal,
				EmulatorHost: "localhost:8085",
			},
			want: true,
		},
		{
			name: "managed mode returns true",
			profile: ConnectionProfile{
				EmulatorMode: EmulatorModeManaged,
			},
			want: true,
		},
		{
			name: "migration - emulatorHost set returns true",
			profile: ConnectionProfile{
				EmulatorHost: "localhost:8085",
			},
			want: true,
		},
		{
			name:    "migration - no config returns false",
			profile: ConnectionProfile{},
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.profile.IsEmulatorEnabled()
			if got != tt.want {
				t.Errorf("ConnectionProfile.IsEmulatorEnabled() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDefaultManagedEmulatorConfig(t *testing.T) {
	config := DefaultManagedEmulatorConfig()

	if config.Port != 8085 {
		t.Errorf("DefaultManagedEmulatorConfig().Port = %d, want 8085", config.Port)
	}
	if config.Image != "google/cloud-sdk:emulators" {
		t.Errorf("DefaultManagedEmulatorConfig().Image = %s, want google/cloud-sdk:emulators", config.Image)
	}
	if !config.AutoStart {
		t.Error("DefaultManagedEmulatorConfig().AutoStart = false, want true")
	}
	if !config.AutoStop {
		t.Error("DefaultManagedEmulatorConfig().AutoStop = false, want true")
	}
	if config.BindAddress != "127.0.0.1" {
		t.Errorf("DefaultManagedEmulatorConfig().BindAddress = %s, want 127.0.0.1", config.BindAddress)
	}
}

func TestItoa(t *testing.T) {
	tests := []struct {
		input int
		want  string
	}{
		{0, "0"},
		{1, "1"},
		{8085, "8085"},
		{65535, "65535"},
		{12345, "12345"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			got := itoa(tt.input)
			if got != tt.want {
				t.Errorf("itoa(%d) = %s, want %s", tt.input, got, tt.want)
			}
		})
	}
}

// Benchmark tests
func BenchmarkConnectionProfile_Validate(b *testing.B) {
	profile := ConnectionProfile{
		ID:           "test-id",
		Name:         "Test Profile",
		ProjectID:    "my-project",
		AuthMethod:   "ADC",
		EmulatorMode: EmulatorModeManaged,
		ManagedEmulator: &ManagedEmulatorConfig{
			Port:        8085,
			AutoStart:   true,
			AutoStop:    true,
			BindAddress: "127.0.0.1",
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = profile.Validate()
	}
}

func BenchmarkConnectionProfile_GetEffectiveEmulatorHost(b *testing.B) {
	profile := ConnectionProfile{
		EmulatorMode: EmulatorModeManaged,
		ManagedEmulator: &ManagedEmulatorConfig{
			Port:        8085,
			BindAddress: "127.0.0.1",
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = profile.GetEffectiveEmulatorHost()
	}
}
