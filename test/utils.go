// Package test provides utility functions for testing
package test

import (
	"strings"
)

// Contains checks if a string contains a substring (case-insensitive)
func Contains(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}

// IntPtr returns a pointer to an int
func IntPtr(i int) *int {
	return &i
}
