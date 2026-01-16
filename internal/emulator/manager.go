// Package emulator provides managed Docker emulator functionality
package emulator

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"net"
	"os/exec"
	"strings"
	"sync"
	"time"

	"pubsub-gui/internal/logger"
	"pubsub-gui/internal/models"
)

// Status represents the current status of a managed emulator
type Status string

const (
	StatusStopped  Status = "stopped"
	StatusStarting Status = "starting"
	StatusRunning  Status = "running"
	StatusStopping Status = "stopping"
	StatusError    Status = "error"
)

// EmulatorInfo contains information about a running emulator instance
type EmulatorInfo struct {
	ProfileID     string `json:"profileId"`
	ContainerName string `json:"containerName"`
	Host          string `json:"host"`
	Port          int    `json:"port"`
	Status        Status `json:"status"`
	Error         string `json:"error,omitempty"`
}

// Manager manages Docker-based Pub/Sub emulator instances
type Manager struct {
	mu        sync.RWMutex
	emulators map[string]*EmulatorInfo // profileID -> emulator info
	cancels   map[string]context.CancelFunc
	ctx       context.Context
}

// NewManager creates a new emulator manager
func NewManager(ctx context.Context) *Manager {
	return &Manager{
		emulators: make(map[string]*EmulatorInfo),
		cancels:   make(map[string]context.CancelFunc),
		ctx:       ctx,
	}
}

// CheckDocker validates that Docker is installed and the daemon is running
func (m *Manager) CheckDocker() error {
	// Check if docker CLI is available
	_, err := exec.LookPath("docker")
	if err != nil {
		return fmt.Errorf("docker CLI not found: please install Docker Desktop or Docker Engine")
	}

	// Check if docker daemon is running
	ctx, cancel := context.WithTimeout(m.ctx, 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "docker", "info")
	output, err := cmd.CombinedOutput()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("docker daemon not responding (timeout)")
		}
		return fmt.Errorf("docker daemon not running: %s", strings.TrimSpace(string(output)))
	}

	return nil
}

// containerName generates a unique container name for a profile
func containerName(profileID string) string {
	return fmt.Sprintf("pubsub-gui-emulator-%s", profileID)
}

// resolvedConfig holds resolved configuration values with defaults applied
type resolvedConfig struct {
	Port        int
	Image       string
	BindAddress string
	DataDir     string
}

// resolveConfig applies defaults to the emulator configuration
func resolveConfig(config *models.ManagedEmulatorConfig) resolvedConfig {
	rc := resolvedConfig{
		Port:        8085,
		Image:       "google/cloud-sdk:emulators",
		BindAddress: "127.0.0.1",
	}
	if config == nil {
		return rc
	}
	if config.Port != 0 {
		rc.Port = config.Port
	}
	if config.Image != "" {
		rc.Image = config.Image
	}
	if config.BindAddress != "" {
		rc.BindAddress = config.BindAddress
	}
	rc.DataDir = config.DataDir
	return rc
}

// buildDockerArgs builds the docker run command arguments
func buildDockerArgs(containerName string, cfg resolvedConfig) []string {
	args := []string{"run", "--rm", "--name", containerName}

	// Port mapping: allow LAN access only if explicitly set to 0.0.0.0
	if cfg.BindAddress == "0.0.0.0" {
		args = append(args, "-p", fmt.Sprintf("%d:8085", cfg.Port))
	} else {
		args = append(args, "-p", fmt.Sprintf("127.0.0.1:%d:8085", cfg.Port))
	}

	// Data directory volume mount if specified
	if cfg.DataDir != "" {
		args = append(args, "-v", fmt.Sprintf("%s:/data", cfg.DataDir))
	}

	// Image and command
	args = append(args, cfg.Image, "gcloud", "beta", "emulators", "pubsub", "start", "--host-port=0.0.0.0:8085")

	if cfg.DataDir != "" {
		args = append(args, "--data-dir=/data")
	}
	return args
}

// tryReuseContainer checks if an existing container can be reused, returns true if reused
func (m *Manager) tryReuseContainer(info *EmulatorInfo, cfg resolvedConfig, profileID string) bool {
	running, err := m.isContainerRunning(info.ContainerName)
	if err != nil {
		logger.Warn("Error checking existing container", "container", info.ContainerName, "error", err)
		return false
	}
	if !running {
		return false
	}

	configMatches, err := m.validateContainerConfig(info.ContainerName, cfg.Image, cfg.Port, cfg.BindAddress)
	if err != nil {
		logger.Warn("Error validating container config, recreating", "container", info.ContainerName, "error", err)
		m.stopContainer(info.ContainerName)
		m.removeContainer(info.ContainerName)
		return false
	}
	if !configMatches {
		logger.Info("Container config mismatch, recreating", "container", info.ContainerName, "profileId", profileID)
		m.stopContainer(info.ContainerName)
		m.removeContainer(info.ContainerName)
		return false
	}

	logger.Info("Reusing existing emulator container", "container", info.ContainerName, "profileId", profileID)
	m.mu.Lock()
	info.Status = StatusRunning
	m.mu.Unlock()
	return true
}

// Start starts the emulator for a profile
func (m *Manager) Start(profileID string, config *models.ManagedEmulatorConfig) error {
	cfg := resolveConfig(config)
	if config == nil {
		logger.Info("Using default emulator config", "profileId", profileID)
	}

	m.mu.Lock()
	if info, exists := m.emulators[profileID]; exists {
		if info.Status == StatusRunning || info.Status == StatusStarting {
			m.mu.Unlock()
			return nil
		}
	}

	info := &EmulatorInfo{
		ProfileID:     profileID,
		ContainerName: containerName(profileID),
		Status:        StatusStarting,
		Port:          cfg.Port,
		Host:          cfg.BindAddress,
	}
	m.emulators[profileID] = info
	m.mu.Unlock()

	// Try to reuse existing container
	if m.tryReuseContainer(info, cfg, profileID) {
		return nil
	}

	m.removeContainer(info.ContainerName)

	if err := m.checkPortAvailable(cfg.BindAddress, cfg.Port); err != nil {
		m.setError(profileID, err)
		return err
	}

	ctx, cancel := context.WithCancel(m.ctx)
	m.mu.Lock()
	m.cancels[profileID] = cancel
	m.mu.Unlock()

	args := buildDockerArgs(info.ContainerName, cfg)
	logger.Info("Starting emulator container", "profileId", profileID, "container", info.ContainerName, "port", cfg.Port, "image", cfg.Image)

	go m.runContainer(ctx, profileID, args)
	time.Sleep(500 * time.Millisecond)
	go m.waitForEmulator(ctx, profileID, fmt.Sprintf("127.0.0.1:%d", cfg.Port))

	return nil
}

// runContainer runs the docker container and streams logs
func (m *Manager) runContainer(ctx context.Context, profileID string, args []string) {
	cmd := exec.CommandContext(ctx, "docker", args...)

	// Get stdout pipe for log streaming
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		m.setError(profileID, fmt.Errorf("failed to create stdout pipe: %w", err))
		return
	}

	// Get stderr pipe for log streaming
	stderr, err := cmd.StderrPipe()
	if err != nil {
		m.setError(profileID, fmt.Errorf("failed to create stderr pipe: %w", err))
		return
	}

	if err := cmd.Start(); err != nil {
		m.setError(profileID, fmt.Errorf("failed to start container: %w", err))
		return
	}

	// Stream stdout logs
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			logger.Info(line,
				"source", "emulator",
				"profileId", profileID,
				"stream", "stdout",
			)
		}
	}()

	// Stream stderr logs
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			logger.Info(line,
				"source", "emulator",
				"profileId", profileID,
				"stream", "stderr",
			)
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	m.mu.Lock()
	info := m.emulators[profileID]
	if info != nil {
		if ctx.Err() == context.Canceled {
			// Expected stop
			info.Status = StatusStopped
			logger.Info("Emulator stopped", "profileId", profileID)
		} else if err != nil {
			// Unexpected error
			info.Status = StatusError
			info.Error = err.Error()
			logger.Error("Emulator process exited with error", "profileId", profileID, "error", err)
		} else {
			// Clean exit
			info.Status = StatusStopped
			logger.Info("Emulator exited", "profileId", profileID)
		}
	}
	m.mu.Unlock()
}

// waitForEmulator waits for the emulator to be responsive
func (m *Manager) waitForEmulator(ctx context.Context, profileID string, host string) {
	const maxRetries = 30 // 30 seconds total
	for range maxRetries {
		select {
		case <-ctx.Done():
			return
		default:
		}

		conn, err := net.DialTimeout("tcp", host, time.Second)
		if err == nil {
			conn.Close()
			m.mu.Lock()
			if info, exists := m.emulators[profileID]; exists {
				info.Status = StatusRunning
				logger.Info("Emulator is ready", "profileId", profileID, "host", host)
			}
			m.mu.Unlock()
			return
		}

		time.Sleep(time.Second)
	}

	// Timeout waiting for emulator
	m.mu.Lock()
	if info, exists := m.emulators[profileID]; exists {
		if info.Status == StatusStarting {
			info.Status = StatusError
			info.Error = "timeout waiting for emulator to start"
			logger.Error("Timeout waiting for emulator", "profileId", profileID)
		}
	}
	m.mu.Unlock()
}

// Stop stops the emulator for a profile
func (m *Manager) Stop(profileID string) error {
	m.mu.Lock()
	info, exists := m.emulators[profileID]
	cancel, hasCancel := m.cancels[profileID]
	m.mu.Unlock()

	if !exists || info.Status == StatusStopped {
		return nil // Already stopped
	}

	logger.Info("Stopping emulator", "profileId", profileID)

	m.mu.Lock()
	info.Status = StatusStopping
	m.mu.Unlock()

	// Cancel context to signal graceful stop
	if hasCancel {
		cancel()
	}

	// Give container a moment to stop gracefully
	time.Sleep(500 * time.Millisecond)

	// Force stop if still running
	containerName := containerName(profileID)
	if running, _ := m.isContainerRunning(containerName); running {
		logger.Info("Force stopping container", "container", containerName)
		m.stopContainer(containerName)
	}

	m.mu.Lock()
	info.Status = StatusStopped
	delete(m.cancels, profileID)
	m.mu.Unlock()

	return nil
}

// StopAll stops all running emulators
func (m *Manager) StopAll() {
	m.mu.RLock()
	profileIDs := make([]string, 0, len(m.emulators))
	for id := range m.emulators {
		profileIDs = append(profileIDs, id)
	}
	m.mu.RUnlock()

	for _, id := range profileIDs {
		m.Stop(id)
	}
}

// GetStatus returns the status of an emulator for a profile
func (m *Manager) GetStatus(profileID string) *EmulatorInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	info, exists := m.emulators[profileID]
	if !exists {
		return &EmulatorInfo{
			ProfileID: profileID,
			Status:    StatusStopped,
		}
	}

	// Return a copy
	return &EmulatorInfo{
		ProfileID:     info.ProfileID,
		ContainerName: info.ContainerName,
		Host:          info.Host,
		Port:          info.Port,
		Status:        info.Status,
		Error:         info.Error,
	}
}

// IsRunning returns true if the emulator for a profile is running
func (m *Manager) IsRunning(profileID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	info, exists := m.emulators[profileID]
	return exists && info.Status == StatusRunning
}

// checkPortAvailable checks if a port is available for binding
func (m *Manager) checkPortAvailable(host string, port int) error {
	addr := fmt.Sprintf("%s:%d", host, port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("port %d is already in use on %s", port, host)
	}
	ln.Close()
	return nil
}

// isContainerRunning checks if a container with the given name is running
func (m *Manager) isContainerRunning(name string) (bool, error) {
	ctx, cancel := context.WithTimeout(m.ctx, 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "docker", "inspect", "-f", "{{.State.Running}}", name)
	output, err := cmd.Output()
	if err != nil {
		// Check if it's a context deadline error
		if errors.Is(err, context.DeadlineExceeded) {
			return false, err
		}

		// Check if it's an ExitError (container not found case)
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			// Check stderr for "No such" or "No such object" (expected container not found case)
			stderr := string(exitErr.Stderr)
			if strings.Contains(stderr, "No such") || strings.Contains(stderr, "No such object") {
				return false, nil // Container doesn't exist - expected case
			}
			// Other ExitError cases (permission denied, etc.) should be returned
			return false, err
		}

		// Any other error (non-ExitError) should be returned
		return false, err
	}

	return strings.TrimSpace(string(output)) == "true", nil
}

// parsePortMapping parses Docker port mapping output and extracts the bind address for the expected port.
// The portMapping format is like "8085/tcp=127.0.0.1:8085 " or "8085/tcp=0.0.0.0:8085 ".
// Returns the bind address and whether the expected port was found.
func parsePortMapping(portMapping string, expectedPort int) (bindAddr string, found bool) {
	const containerPort = "8085/tcp" // Container always listens on 8085 internally
	expectedPortStr := fmt.Sprintf("%d", expectedPort)

	for mapping := range strings.FieldsSeq(portMapping) {
		if !strings.HasPrefix(mapping, containerPort+"=") {
			continue
		}
		parts := strings.Split(mapping, "=")
		if len(parts) != 2 {
			continue
		}
		hostPort := parts[1]
		if !strings.HasSuffix(hostPort, ":"+expectedPortStr) {
			continue
		}
		// Extract bind address (everything before the last colon)
		if lastColon := strings.LastIndex(hostPort, ":"); lastColon > 0 {
			return hostPort[:lastColon], true
		}
		return "0.0.0.0", true // Default if no IP specified
	}
	return "", false
}

// normalizeBindAddr normalizes bind addresses for comparison.
// Empty string defaults to the provided defaultAddr.
func normalizeBindAddr(addr, defaultAddr string) string {
	if addr == "" {
		return defaultAddr
	}
	return addr
}

// validateContainerConfig checks if a running container's configuration matches the requested config.
// Returns true if config matches, false if it doesn't, and error if inspection fails.
func (m *Manager) validateContainerConfig(containerName, expectedImage string, expectedPort int, expectedBindAddr string) (bool, error) {
	ctx, cancel := context.WithTimeout(m.ctx, 5*time.Second)
	defer cancel()

	// Validate image
	cmd := exec.CommandContext(ctx, "docker", "inspect", "-f", "{{.Config.Image}}", containerName)
	imageOutput, err := cmd.Output()
	if err != nil {
		return false, fmt.Errorf("failed to inspect container image: %w", err)
	}
	actualImage := strings.TrimSpace(string(imageOutput))
	normalizedExpectedImage := normalizeBindAddr(expectedImage, "google/cloud-sdk:emulators")

	if actualImage != normalizedExpectedImage {
		logger.Info("Container image mismatch", "container", containerName, "expected", normalizedExpectedImage, "actual", actualImage)
		return false, nil
	}

	// Validate port mapping
	cmd = exec.CommandContext(ctx, "docker", "inspect", "-f", "{{range $k, $v := .NetworkSettings.Ports}}{{$k}}={{range $v}}{{.HostIp}}:{{.HostPort}}{{end}} {{end}}", containerName)
	portOutput, err := cmd.Output()
	if err != nil {
		return false, fmt.Errorf("failed to inspect container ports: %w", err)
	}

	portMapping := strings.TrimSpace(string(portOutput))
	actualBindAddr, found := parsePortMapping(portMapping, expectedPort)
	if !found {
		logger.Info("Container port mapping not found", "container", containerName, "expectedHostPort", expectedPort, "actualMapping", portMapping)
		return false, nil
	}

	// Validate bind address
	normalizedExpected := normalizeBindAddr(expectedBindAddr, "127.0.0.1")
	normalizedActual := normalizeBindAddr(actualBindAddr, "0.0.0.0")

	if normalizedActual != normalizedExpected {
		logger.Info("Container bind address mismatch", "container", containerName, "expected", normalizedExpected, "actual", normalizedActual)
		return false, nil
	}

	return true, nil
}

// stopContainer stops a container
func (m *Manager) stopContainer(name string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "docker", "stop", name)
	cmd.Run() // Ignore errors

	// Force remove if still exists
	cmd = exec.CommandContext(ctx, "docker", "rm", "-f", name)
	cmd.Run() // Ignore errors
}

// removeContainer removes a stopped container
func (m *Manager) removeContainer(name string) {
	ctx, cancel := context.WithTimeout(m.ctx, 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "docker", "rm", "-f", name)
	cmd.Run() // Ignore errors - container may not exist
}

// setError sets the error status for an emulator
func (m *Manager) setError(profileID string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if info, exists := m.emulators[profileID]; exists {
		info.Status = StatusError
		info.Error = err.Error()
	}

	logger.Error("Emulator error", "profileId", profileID, "error", err)
}
