// Package logger provides structured logging with dual output (stdout + JSON file)
package logger

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	"pubsub-gui/internal/config"
)

var (
	globalLogger *slog.Logger
	loggerMu     sync.RWMutex
	logFile      *os.File
	fileMu       sync.Mutex
	currentDate  string
	logsDir      string
)

// InitLogger initializes the global logger with dual output
func InitLogger() error {
	loggerMu.Lock()
	defer loggerMu.Unlock()

	// Get logs directory path
	configDir, err := config.GetConfigDir()
	if err != nil {
		return err
	}
	logsDir = filepath.Join(configDir, "logs")

	// Create logs directory if it doesn't exist
	if err := os.MkdirAll(logsDir, 0700); err != nil {
		return err
	}

	// Initialize current date
	currentDate = time.Now().Format("2006-01-02")

	// Open initial log file
	if err := openLogFile(); err != nil {
		return err
	}

	// Create text handler for stdout (human-readable)
	textHandler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})

	// Create JSON handler for file
	jsonHandler := slog.NewJSONHandler(logFile, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})

	// Create multi-handler that writes to both
	multiHandler := NewMultiHandler(textHandler, jsonHandler)

	// Create logger with multi-handler
	globalLogger = slog.New(multiHandler)

	return nil
}

// openLogFile opens or creates the log file for the current date
func openLogFile() error {
	fileMu.Lock()
	defer fileMu.Unlock()

	// Close existing file if open
	if logFile != nil {
		logFile.Close()
	}

	// Construct file path
	fileName := "logs-" + currentDate + ".json"
	filePath := filepath.Join(logsDir, fileName)

	// Open file in append mode (create if doesn't exist)
	file, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		return err
	}

	logFile = file
	return nil
}

// checkAndRotate checks if date has changed and rotates file if needed
func checkAndRotate() error {
	today := time.Now().Format("2006-01-02")
	if today != currentDate {
		currentDate = today
		return openLogFile()
	}
	return nil
}

// GetLogger returns the global logger instance
func GetLogger() *slog.Logger {
	loggerMu.RLock()
	defer loggerMu.RUnlock()

	// Check and rotate if needed (with file lock)
	fileMu.Lock()
	if err := checkAndRotate(); err != nil {
		// If rotation fails, log to stderr (can't use logger)
		os.Stderr.WriteString("Warning: failed to rotate log file: " + err.Error() + "\n")
	}
	fileMu.Unlock()

	return globalLogger
}

// Convenience functions for common log levels

// Info logs an info message
func Info(msg string, args ...any) {
	GetLogger().Info(msg, args...)
}

// Error logs an error message
func Error(msg string, args ...any) {
	GetLogger().Error(msg, args...)
}

// Warn logs a warning message
func Warn(msg string, args ...any) {
	GetLogger().Warn(msg, args...)
}

// Debug logs a debug message
func Debug(msg string, args ...any) {
	GetLogger().Debug(msg, args...)
}

// GetLogsDir returns the logs directory path
func GetLogsDir() string {
	return logsDir
}

// Close closes the log file (called on shutdown)
func Close() error {
	fileMu.Lock()
	defer fileMu.Unlock()

	if logFile != nil {
		return logFile.Close()
	}
	return nil
}

// MultiHandler is a slog handler that writes to multiple handlers
type MultiHandler struct {
	handlers []slog.Handler
}

// NewMultiHandler creates a new multi-handler
func NewMultiHandler(handlers ...slog.Handler) *MultiHandler {
	return &MultiHandler{
		handlers: handlers,
	}
}

// Enabled reports whether the handler handles records at the given level
func (m *MultiHandler) Enabled(ctx context.Context, level slog.Level) bool {
	// Enabled if any handler is enabled
	for _, h := range m.handlers {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

// Handle handles the record by writing to all handlers
func (m *MultiHandler) Handle(ctx context.Context, record slog.Record) error {
	var firstErr error
	for _, h := range m.handlers {
		if err := h.Handle(ctx, record); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

// WithAttrs returns a new handler with the given attributes
func (m *MultiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	handlers := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		handlers[i] = h.WithAttrs(attrs)
	}
	return NewMultiHandler(handlers...)
}

// WithGroup returns a new handler with the given group
func (m *MultiHandler) WithGroup(name string) slog.Handler {
	handlers := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		handlers[i] = h.WithGroup(name)
	}
	return NewMultiHandler(handlers...)
}
