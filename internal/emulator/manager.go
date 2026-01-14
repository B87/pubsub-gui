// Package emulator provides managed Docker emulator functionality
package emulator

import (
	"bufio"
	"context"
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

// Start starts the emulator for a profile
func (m *Manager) Start(profileID string, config *models.ManagedEmulatorConfig) error {
	m.mu.Lock()

	// Check if already running
	if info, exists := m.emulators[profileID]; exists {
		if info.Status == StatusRunning || info.Status == StatusStarting {
			m.mu.Unlock()
			return nil // Already running or starting
		}
	}

	// Set initial status
	info := &EmulatorInfo{
		ProfileID:     profileID,
		ContainerName: containerName(profileID),
		Status:        StatusStarting,
	}

	// Apply defaults
	port := config.Port
	if port == 0 {
		port = 8085
	}
	info.Port = port

	image := config.Image
	if image == "" {
		image = "google/cloud-sdk:emulators"
	}

	bindAddress := config.BindAddress
	if bindAddress == "" {
		bindAddress = "127.0.0.1"
	}
	info.Host = bindAddress

	m.emulators[profileID] = info
	m.mu.Unlock()

	// Check if container already exists and is running FIRST (before port check)
	// This handles the case where the emulator persists from a previous session
	existingRunning, err := m.isContainerRunning(info.ContainerName)
	if err != nil {
		logger.Warn("Error checking existing container", "container", info.ContainerName, "error", err)
	}

	if existingRunning {
		logger.Info("Reusing existing emulator container", "container", info.ContainerName, "profileId", profileID)
		m.mu.Lock()
		info.Status = StatusRunning
		m.mu.Unlock()
		return nil
	}

	// Remove any stopped container with the same name
	m.removeContainer(info.ContainerName)

	// Now check for port conflicts (only if we need to start a new container)
	if err := m.checkPortAvailable(bindAddress, port); err != nil {
		m.setError(profileID, err)
		return err
	}

	// Create context for this emulator
	ctx, cancel := context.WithCancel(m.ctx)
	m.mu.Lock()
	m.cancels[profileID] = cancel
	m.mu.Unlock()

	// Build docker run command
	args := []string{
		"run",
		"--rm",
		"--name", info.ContainerName,
	}

	// Port mapping
	if bindAddress == "0.0.0.0" {
		// Allow LAN access (explicit opt-in)
		args = append(args, "-p", fmt.Sprintf("%d:8085", port))
	} else {
		// Default: localhost only (more secure)
		args = append(args, "-p", fmt.Sprintf("127.0.0.1:%d:8085", port))
	}

	// Data directory volume mount if specified
	if config.DataDir != "" {
		args = append(args, "-v", fmt.Sprintf("%s:/data", config.DataDir))
	}

	// Image and command
	args = append(args, image)
	args = append(args, "gcloud", "beta", "emulators", "pubsub", "start", "--host-port=0.0.0.0:8085")

	// Add data-dir flag if data directory is mounted
	if config.DataDir != "" {
		args = append(args, "--data-dir=/data")
	}

	logger.Info("Starting emulator container",
		"profileId", profileID,
		"container", info.ContainerName,
		"port", port,
		"image", image,
	)

	// Start docker container in background
	go m.runContainer(ctx, profileID, args)

	// Wait briefly for container to start
	time.Sleep(500 * time.Millisecond)

	// Verify emulator is responding
	go m.waitForEmulator(ctx, profileID, fmt.Sprintf("127.0.0.1:%d", port))

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
	maxRetries := 30 // 30 seconds total
	for i := 0; i < maxRetries; i++ {
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
		return false, nil // Container doesn't exist
	}

	return strings.TrimSpace(string(output)) == "true", nil
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
