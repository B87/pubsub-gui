// Package test provides test helpers for Pub/Sub emulator integration tests
package test

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"testing"
	"time"

	"cloud.google.com/go/pubsub/v2"
	pubsubpb "cloud.google.com/go/pubsub/v2/apiv1/pubsubpb"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

// StartEmulator starts the Pub/Sub emulator using Docker and returns the host and cleanup function
func StartEmulator(t *testing.T) (string, func()) {
	t.Helper()

	// Check if Docker is available
	if _, err := exec.LookPath("docker"); err != nil {
		t.Fatalf("Docker is required for Pub/Sub emulator but not found. Install Docker: https://www.docker.com/get-started")
	}

	// Check if Docker daemon is running
	checkCtx, checkCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer checkCancel()
	if err := exec.CommandContext(checkCtx, "docker", "info").Run(); err != nil {
		t.Fatalf("Docker daemon is not running. Start Docker Desktop or Docker daemon.")
	}

	emulatorHost := "localhost:8085"
	containerName := "pubsub-emulator-test-" + fmt.Sprintf("%d", time.Now().UnixNano())

	// Pull the official Google Cloud SDK emulators image (if not already present)
	// This is a no-op if the image already exists
	// Using :emulators tag which includes all emulator components
	imageName := "google/cloud-sdk:emulators"
	pullCtx, pullCancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer pullCancel()
	pullCmd := exec.CommandContext(pullCtx, "docker", "pull", imageName)
	pullCmd.Stdout = nil
	pullCmd.Stderr = nil
	if err := pullCmd.Run(); err != nil {
		t.Logf("Warning: Failed to pull Docker image (may already exist): %v", err)
	}

	// Start the emulator container
	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, "docker", "run",
		"--rm",
		"--name", containerName,
		"-p", emulatorHost+":8085",
		imageName,
		"gcloud", "beta", "emulators", "pubsub", "start", "--host-port=0.0.0.0:8085",
	)

	// Capture stderr for debugging
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	cmd.Stdout = nil // Suppress stdout

	// Start container in background
	if err := cmd.Start(); err != nil {
		t.Fatalf("failed to start emulator container: %v", err)
	}

	// Give container a moment to start
	time.Sleep(2 * time.Second)

	// Wait for emulator to be ready by attempting to create a test client
	// This verifies the emulator is actually responding, not just running
	maxWait := 15 * time.Second
	checkInterval := 500 * time.Millisecond
	deadline := time.Now().Add(maxWait)

	// Set environment variable early so client can connect
	os.Setenv("PUBSUB_EMULATOR_HOST", emulatorHost)

	// Poll until emulator is ready by performing an actual operation
	var lastErr error
	ready := false
	for time.Now().Before(deadline) && !ready {
		// Try to create a client and perform a real operation to verify emulator is ready
		testCtx, testCancel := context.WithTimeout(context.Background(), 5*time.Second)
		client, err := pubsub.NewClient(testCtx, "test-project", option.WithoutAuthentication())
		if err == nil {
			// Try to list topics - this verifies the emulator is actually responding
			req := &pubsubpb.ListTopicsRequest{
				Project: "projects/test-project",
			}
			it := client.TopicAdminClient.ListTopics(testCtx, req)
			// Try to get first result (or iterator.Done) to verify emulator responds
			_, listErr := it.Next()
			client.Close()
			testCancel()

			// If we got iterator.Done, emulator is ready
			if listErr == iterator.Done {
				ready = true
				break
			}
			// If we got a non-timeout error, emulator might not be ready yet
			if listErr != nil && !isTimeoutError(listErr) {
				lastErr = listErr
			}
		} else {
			testCancel()
			if !isTimeoutError(err) {
				lastErr = err
			}
		}
		time.Sleep(checkInterval)
	}

	// If we couldn't connect after maxWait, fail the test
	if !ready {
		// Try to get container logs for debugging
		logsCtx, logsCancel := context.WithTimeout(context.Background(), 5*time.Second)
		logsCmd := exec.CommandContext(logsCtx, "docker", "logs", containerName)
		var logsOut bytes.Buffer
		logsCmd.Stdout = &logsOut
		logsCmd.Stderr = &logsOut
		_ = logsCmd.Run()
		logsCancel()

		t.Fatalf("emulator not ready after %v. Last error: %v. Container logs: %s", maxWait, lastErr, logsOut.String())
	}

	cleanup := func() {
		// Stop and remove the container
		stopCtx, stopCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer stopCancel()
		stopCmd := exec.CommandContext(stopCtx, "docker", "stop", containerName)
		stopCmd.Stdout = nil
		stopCmd.Stderr = nil
		_ = stopCmd.Run()

		// Wait for the container process to finish
		cancel()
		_ = cmd.Wait()

		os.Unsetenv("PUBSUB_EMULATOR_HOST")
	}

	return emulatorHost, cleanup
}

// isTimeoutError checks if an error is a context deadline exceeded or timeout error
func isTimeoutError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return errStr == "context deadline exceeded" ||
		errStr == "context canceled" ||
		errStr == "deadline exceeded"
}
