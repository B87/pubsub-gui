// Package app provides handler structs for organizing App methods by domain
package app

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"pubsub-gui/internal/logger"
)

// LogEntry represents a single log entry
type LogEntry struct {
	Time   string                 `json:"time"`
	Level  string                 `json:"level"`
	Msg    string                 `json:"msg"`
	Fields map[string]interface{} `json:"fields,omitempty"`
}

// FilteredLogsResult represents the result of a filtered log query
type FilteredLogsResult struct {
	Entries []LogEntry `json:"entries"`
	Total   int        `json:"total"`
}

// LogsHandler handles log reading operations
type LogsHandler struct {
	logsDir string
}

// NewLogsHandler creates a new LogsHandler
func NewLogsHandler() *LogsHandler {
	return &LogsHandler{
		logsDir: logger.GetLogsDir(),
	}
}

// GetLogs returns logs for a specific date
func (h *LogsHandler) GetLogs(date string, limit, offset int) ([]LogEntry, error) {
	// Parse date to validate format
	_, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %w", err)
	}

	// Construct file path
	fileName := "logs-" + date + ".json"
	filePath := filepath.Join(h.logsDir, fileName)

	// Read file line by line
	entries, err := h.readLogFile(filePath, "", "", "", "", limit, offset)
	if err != nil {
		// If file doesn't exist, return empty slice (no logs for that date)
		if os.IsNotExist(err) {
			return []LogEntry{}, nil
		}
		return nil, err
	}

	return entries, nil
}

// GetLogsFiltered returns filtered logs across a date range
func (h *LogsHandler) GetLogsFiltered(startDate, endDate, levelFilter, searchTerm string, limit, offset int) (FilteredLogsResult, error) {
	result := FilteredLogsResult{
		Entries: []LogEntry{},
		Total:   0,
	}

	// Parse dates
	var start, end time.Time
	var err error

	if startDate != "" {
		start, err = time.Parse("2006-01-02", startDate)
		if err != nil {
			return result, fmt.Errorf("invalid start date format: %w", err)
		}
	}

	if endDate != "" {
		end, err = time.Parse("2006-01-02", endDate)
		if err != nil {
			return result, fmt.Errorf("invalid end date format: %w", err)
		}
		// Set end to end of day
		end = end.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	} else {
		// If no end date, use today
		end = time.Now()
	}

	if startDate == "" {
		// If no start date, use end date (single day)
		start = end
		start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	}

	// Get all log files in date range
	logFiles, err := h.getLogFilesInRange(start, end)
	if err != nil {
		return result, err
	}

	// Read and filter entries from all files
	allEntries := []LogEntry{}
	for _, filePath := range logFiles {
		entries, err := h.readLogFile(filePath, startDate, endDate, levelFilter, searchTerm, 0, 0) // 0,0 = no limit
		if err != nil {
			// Skip files that don't exist or can't be read
			continue
		}
		allEntries = append(allEntries, entries...)
	}

	// Sort by time (newest first)
	sort.Slice(allEntries, func(i, j int) bool {
		ti, _ := time.Parse(time.RFC3339, allEntries[i].Time)
		tj, _ := time.Parse(time.RFC3339, allEntries[j].Time)
		return ti.After(tj)
	})

	// Set total before pagination
	result.Total = len(allEntries)

	// Apply pagination
	if limit > 0 {
		startIdx := offset
		endIdx := offset + limit
		if startIdx > len(allEntries) {
			startIdx = len(allEntries)
		}
		if endIdx > len(allEntries) {
			endIdx = len(allEntries)
		}
		if startIdx < endIdx {
			result.Entries = allEntries[startIdx:endIdx]
		}
	} else {
		result.Entries = allEntries
	}

	return result, nil
}

// readLogFile reads a log file and filters entries
func (h *LogsHandler) readLogFile(filePath, startDate, endDate, levelFilter, searchTerm string, limit, offset int) ([]LogEntry, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var entries []LogEntry
	scanner := bufio.NewScanner(file)
	lineCount := 0

	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}

		// Parse JSON - slog outputs time, level, msg, and additional fields
		var rawEntry map[string]interface{}
		if err := json.Unmarshal([]byte(line), &rawEntry); err != nil {
			// Skip invalid JSON lines
			continue
		}

		// Convert slog format to LogEntry format
		entry := LogEntry{
			Fields: make(map[string]interface{}),
		}

		// Extract time (slog uses "time" field)
		if timeVal, ok := rawEntry["time"].(string); ok {
			entry.Time = timeVal
		}

		// Extract level (slog JSON handler outputs level as string like "INFO", "ERROR", etc.)
		if levelVal, ok := rawEntry["level"].(string); ok {
			// Normalize to uppercase
			entry.Level = strings.ToUpper(strings.TrimSpace(levelVal))
		} else {
			// If level is missing, skip this entry (invalid format)
			continue
		}

		// Extract message (slog uses "msg" field)
		if msgVal, ok := rawEntry["msg"].(string); ok {
			entry.Msg = msgVal
		} else {
			// If msg is missing, skip this entry (invalid format)
			continue
		}

		// Ensure we have time field
		if entry.Time == "" {
			// If time is missing, skip this entry (invalid format)
			continue
		}

		// All other fields go into Fields map
		for k, v := range rawEntry {
			if k != "time" && k != "level" && k != "msg" {
				entry.Fields[k] = v
			}
		}

		// Apply filters
		if !h.matchesFilters(entry, startDate, endDate, levelFilter, searchTerm) {
			continue
		}

		// Apply offset
		if offset > 0 && lineCount < offset {
			lineCount++
			continue
		}

		entries = append(entries, entry)
		lineCount++

		// Apply limit
		if limit > 0 && len(entries) >= limit {
			break
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return entries, nil
}

// matchesFilters checks if an entry matches all filters
func (h *LogsHandler) matchesFilters(entry LogEntry, startDate, endDate, levelFilter, searchTerm string) bool {
	// Filter by level (normalize to uppercase for comparison)
	entryLevelUpper := strings.ToUpper(strings.TrimSpace(entry.Level))
	if levelFilter != "" && levelFilter != "all" && levelFilter != "none" {
		levels := strings.Split(levelFilter, ",")
		levelMatch := false
		for _, level := range levels {
			if strings.EqualFold(strings.TrimSpace(level), entryLevelUpper) {
				levelMatch = true
				break
			}
		}
		if !levelMatch {
			return false
		}
	} else if levelFilter == "none" {
		return false
	}

	// Filter by date range
	if startDate != "" || endDate != "" {
		entryTime, err := time.Parse(time.RFC3339, entry.Time)
		if err != nil {
			// Skip entries with invalid timestamps
			return false
		}

		if startDate != "" {
			start, err := time.Parse("2006-01-02", startDate)
			if err == nil {
				start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
				if entryTime.Before(start) {
					return false
				}
			}
		}

		if endDate != "" {
			end, err := time.Parse("2006-01-02", endDate)
			if err == nil {
				end = time.Date(end.Year(), end.Month(), end.Day(), 23, 59, 59, 0, end.Location())
				if entryTime.After(end) {
					return false
				}
			}
		}
	}

	// Filter by search term
	if searchTerm != "" {
		searchLower := strings.ToLower(searchTerm)
		msgLower := strings.ToLower(entry.Msg)
		if !strings.Contains(msgLower, searchLower) {
			// Also search in fields
			found := false
			for _, v := range entry.Fields {
				valStr := fmt.Sprintf("%v", v)
				if strings.Contains(strings.ToLower(valStr), searchLower) {
					found = true
					break
				}
			}
			if !found {
				return false
			}
		}
	}

	return true
}

// getLogFilesInRange returns all log file paths in the date range
func (h *LogsHandler) getLogFilesInRange(start, end time.Time) ([]string, error) {
	var files []string

	// Iterate through each day in range
	current := start
	for !current.After(end) {
		dateStr := current.Format("2006-01-02")
		fileName := "logs-" + dateStr + ".json"
		filePath := filepath.Join(h.logsDir, fileName)

		// Check if file exists
		if _, err := os.Stat(filePath); err == nil {
			files = append(files, filePath)
		}

		// Move to next day
		current = current.AddDate(0, 0, 1)
	}

	return files, nil
}
