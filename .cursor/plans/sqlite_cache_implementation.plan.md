# SQLite Cache Implementation Plan (GORM)

**Plan ID:** sqlite_cache_implementation_gorm

**Created:** 2026-01-07

**Status:** Draft

**Owner:** Development Team

**ORM:** GORM v2

---

## Overview

Implement SQLite-based local caching using GORM ORM for PubSub resources (topics, subscriptions) and messages to improve performance, reduce API calls, enable offline access, and provide persistent message history.

### Problem Statement

Currently, the application:

- Fetches all resources from GCP on every connection
- Stores messages only in memory (500 message buffer)
- Loses message history on app restart
- Makes repeated API calls for the same data
- Has no visibility into cache size or health

### Goals

1. **Persistent Cache**: Store topics, subscriptions, and messages in SQLite using GORM
2. **Size Management**: Implement configurable database size limits with automatic cleanup
3. **Performance**: Reduce API calls by ~95% through intelligent caching
4. **Offline Access**: View cached data when disconnected
5. **UI Monitoring**: Provide real-time visibility into cache status and health
6. **Message History**: Persist monitored messages across app restarts

---

## Technical Approach

### Database Architecture

**Location:** `~/.pubsub-gui/cache.db`

**ORM:** GORM v2 with SQLite driver

**Schema Design (GORM Models):**

```go
package cache

import (
    "time"
    "gorm.io/gorm"
)

// CacheMetadata stores key-value pairs for cache configuration
type CacheMetadata struct {
    Key       string    `gorm:"primaryKey"`
    Value     string    `gorm:"not null"`
    UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

// Project represents a cached GCP project
type Project struct {
    ProjectID    string         `gorm:"primaryKey"`
    ProfileID    string         `gorm:"index"`
    LastSynced   *time.Time
    SyncStatus   string         `gorm:"type:varchar(20);check:sync_status IN ('success','partial','error')"`
    ErrorMessage string
    CreatedAt    time.Time      `gorm:"autoCreateTime"`
    UpdatedAt    time.Time      `gorm:"autoUpdateTime"`

    // Relationships
    Topics        []Topic        `gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE"`
    Subscriptions []Subscription `gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE"`
    Messages      []Message      `gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE"`
}

// Topic represents a cached Pub/Sub topic
type Topic struct {
    ID                        uint      `gorm:"primaryKey;autoIncrement"`
    ProjectID                 string    `gorm:"not null;index;uniqueIndex:idx_project_topic"`
    TopicID                   string    `gorm:"not null;uniqueIndex:idx_project_topic"`
    TopicName                 string    `gorm:"not null"`
    Labels                    string    `gorm:"type:text"` // JSON
    MessageStoragePolicy      string    `gorm:"type:text"` // JSON
    MessageRetentionDuration  string
    CreatedAt                 time.Time `gorm:"autoCreateTime"`
    UpdatedAt                 time.Time `gorm:"autoUpdateTime;index"`
}

// Subscription represents a cached Pub/Sub subscription
type Subscription struct {
    ID                       uint      `gorm:"primaryKey;autoIncrement"`
    ProjectID                string    `gorm:"not null;index;uniqueIndex:idx_project_sub"`
    SubscriptionID           string    `gorm:"not null;uniqueIndex:idx_project_sub"`
    SubscriptionName         string    `gorm:"not null"`
    TopicID                  string    `gorm:"index"`
    AckDeadlineSeconds       int32
    RetainAckedMessages      bool
    MessageRetentionDuration string
    Filter                   string
    DeadLetterTopic          string
    MaxDeliveryAttempts      int32
    PushEndpoint             string
    CreatedAt                time.Time `gorm:"autoCreateTime"`
    UpdatedAt                time.Time `gorm:"autoUpdateTime;index"`
}

// Message represents a cached Pub/Sub message
type Message struct {
    ID             uint      `gorm:"primaryKey;autoIncrement"`
    ProjectID      string    `gorm:"not null;index;uniqueIndex:idx_project_message"`
    TopicID        string    `gorm:"index"`
    SubscriptionID string    `gorm:"index"`
    MessageID      string    `gorm:"not null;uniqueIndex:idx_project_message"`
    PublishTime    time.Time `gorm:"not null;index:idx_publish_time,sort:desc"`
    Data           string    `gorm:"type:text"` // Base64 encoded
    Attributes     string    `gorm:"type:text"` // JSON
    OrderingKey    string
    ReceivedAt     time.Time `gorm:"autoCreateTime;index:idx_received_at,sort:desc"`
}

// CacheStat stores periodic cache statistics for monitoring
type CacheStat struct {
    ID                     uint      `gorm:"primaryKey;autoIncrement"`
    RecordedAt             time.Time `gorm:"autoCreateTime;index:idx_recorded_at,sort:desc"`
    DbSizeBytes            int64
    TopicsCount            int
    SubscriptionsCount     int
    MessagesCount          int
    OldestMessageAgeHours  float64
    APICallsSaved          int
}
```

**GORM Advantages:**

- **Auto Migrations**: Schema creation and updates handled automatically
- **Type Safety**: Models are type-safe Go structs
- **Query Builder**: Chainable, readable queries
- **Relationships**: Foreign keys and cascades built-in
- **Hooks**: BeforeCreate, AfterUpdate for business logic
- **Transactions**: Automatic transaction management

### Size Management Strategy

**Configuration (in `~/.pubsub-gui/config.json`):**

```json
{
  "cache": {
    "maxDbSizeMB": 500,
    "maxMessagesPerTopic": 10000,
    "maxMessagesPerSubscription": 10000,
    "maxMessageAgeDays": 30,
    "enableAutoCleanup": true,
    "cleanupIntervalMinutes": 60
  }
}
```

**Size Limits:**

- **Default Max DB Size**: 500 MB (configurable)
- **Max Messages Per Topic**: 10,000 (configurable)
- **Max Messages Per Subscription**: 10,000 (configurable)
- **Max Message Age**: 30 days (configurable)
- **Cleanup Trigger**: When DB reaches 90% of max size

**Cleanup Strategy (Priority Order):**

1. Delete messages older than `maxMessageAgeDays`
2. Delete oldest messages from topics/subscriptions exceeding `maxMessagesPerTopic/Subscription`
3. Delete cache stats older than 90 days
4. Vacuum database to reclaim space

### Sync Strategy

**When to Write to Cache:**

- After successful `SyncResources()` (topics, subscriptions)
- On resource creation/update/deletion (immediate)
- On message received during monitoring (batch inserts every 5 seconds)
- On manual refresh triggered by user

**When to Read from Cache:**

- On app startup (before API sync)
- On connection to a project (check cache freshness)
- When offline (read-only mode)
- For message history (always read from cache + memory buffer)

**Cache Freshness:**

- Resources are "fresh" if synced within last 5 minutes
- Stale resources trigger background sync but still display cached data
- User can force refresh via UI

**Concurrency:**

- GORM handles connection pooling automatically
- Use GORM transactions for batch operations
- WAL mode for better read/write concurrency
- PrepareStmt caching for performance

---

## Implementation Plan

### Phase 1: Backend Infrastructure (Go)

#### Step 1.1: Create GORM Cache Package

**File:** `internal/cache/db.go`

```go
package cache

import (
    "path/filepath"
    "gorm.io/gorm"
    "gorm.io/driver/sqlite"
    "gorm.io/gorm/logger"
)

type CacheDB struct {
    db     *gorm.DB
    config CacheConfig
}

type CacheConfig struct {
    MaxDbSizeMB                 int
    MaxMessagesPerTopic         int
    MaxMessagesPerSubscription  int
    MaxMessageAgeDays           int
    EnableAutoCleanup           bool
    CleanupIntervalMinutes      int
}

// NewCacheDB creates a new cache database connection
func NewCacheDB(dbPath string, config CacheConfig) (*CacheDB, error) {
    db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
        Logger: logger.Default.LogMode(logger.Silent),
        PrepareStmt: true, // Cache prepared statements
    })
    if err != nil {
        return nil, err
    }

    // Configure SQLite for better concurrency
    sqlDB, _ := db.DB()
    sqlDB.SetMaxOpenConns(10)
    sqlDB.Exec("PRAGMA journal_mode=WAL")
    sqlDB.Exec("PRAGMA synchronous=NORMAL")
    sqlDB.Exec("PRAGMA cache_size=-64000") // 64MB cache

    return &CacheDB{db: db, config: config}, nil
}

// Initialize runs auto-migrations
func (c *CacheDB) Initialize() error {
    return c.db.AutoMigrate(
        &CacheMetadata{},
        &Project{},
        &Topic{},
        &Subscription{},
        &Message{},
        &CacheStat{},
    )
}

// Close closes the database connection
func (c *CacheDB) Close() error {
    sqlDB, err := c.db.DB()
    if err != nil {
        return err
    }
    return sqlDB.Close()
}

// GetDB returns the underlying GORM DB for custom queries
func (c *CacheDB) GetDB() *gorm.DB {
    return c.db
}
```

#### Step 1.2: Implement Repository Pattern

**File:** `internal/cache/topics_repo.go`

```go
package cache

import (
    "encoding/json"
    "gorm.io/gorm"
    "gorm.io/gorm/clause"
)

type TopicsRepository struct {
    db *gorm.DB
}

func NewTopicsRepository(db *gorm.DB) *TopicsRepository {
    return &TopicsRepository{db: db}
}

// UpsertTopics inserts or updates topics for a project
func (r *TopicsRepository) UpsertTopics(projectID string, topics []admin.TopicInfo) error {
    var models []Topic

    for _, t := range topics {
        labels, _ := json.Marshal(t.Labels)
        policy, _ := json.Marshal(t.MessageStoragePolicy)

        models = append(models, Topic{
            ProjectID:                projectID,
            TopicID:                  t.ID,
            TopicName:                t.Name,
            Labels:                   string(labels),
            MessageStoragePolicy:     string(policy),
            MessageRetentionDuration: t.MessageRetentionDuration,
        })
    }

    // Upsert using GORM's Clauses
    return r.db.Clauses(clause.OnConflict{
        Columns:   []clause.Column{{Name: "project_id"}, {Name: "topic_id"}},
        DoUpdates: clause.AssignmentColumns([]string{"topic_name", "labels", "message_storage_policy", "message_retention_duration", "updated_at"}),
    }).Create(&models).Error
}

// GetTopics retrieves all topics for a project
func (r *TopicsRepository) GetTopics(projectID string) ([]admin.TopicInfo, error) {
    var topics []Topic

    err := r.db.Where("project_id = ?", projectID).Find(&topics).Error
    if err != nil {
        return nil, err
    }

    var result []admin.TopicInfo
    for _, t := range topics {
        var labels map[string]string
        var policy map[string]interface{}
        json.Unmarshal([]byte(t.Labels), &labels)
        json.Unmarshal([]byte(t.MessageStoragePolicy), &policy)

        result = append(result, admin.TopicInfo{
            ID:                       t.TopicID,
            Name:                     t.TopicName,
            Labels:                   labels,
            MessageStoragePolicy:     policy,
            MessageRetentionDuration: t.MessageRetentionDuration,
        })
    }

    return result, nil
}

// DeleteTopic removes a topic from cache
func (r *TopicsRepository) DeleteTopic(projectID, topicID string) error {
    return r.db.Where("project_id = ? AND topic_id = ?", projectID, topicID).Delete(&Topic{}).Error
}

// GetTopicsCount returns the count of topics for a project
func (r *TopicsRepository) GetTopicsCount(projectID string) (int64, error) {
    var count int64
    err := r.db.Model(&Topic{}).Where("project_id = ?", projectID).Count(&count).Error
    return count, err
}
```

**File:** `internal/cache/subscriptions_repo.go`

```go
package cache

import (
    "gorm.io/gorm"
    "gorm.io/gorm/clause"
)

type SubscriptionsRepository struct {
    db *gorm.DB
}

func NewSubscriptionsRepository(db *gorm.DB) *SubscriptionsRepository {
    return &SubscriptionsRepository{db: db}
}

// UpsertSubscriptions inserts or updates subscriptions for a project
func (r *SubscriptionsRepository) UpsertSubscriptions(projectID string, subs []admin.SubscriptionInfo) error {
    var models []Subscription

    for _, s := range subs {
        models = append(models, Subscription{
            ProjectID:                projectID,
            SubscriptionID:           s.ID,
            SubscriptionName:         s.Name,
            TopicID:                  s.Topic,
            AckDeadlineSeconds:       int32(s.AckDeadlineSeconds),
            RetainAckedMessages:      s.RetainAckedMessages,
            MessageRetentionDuration: s.MessageRetentionDuration,
            Filter:                   s.Filter,
            DeadLetterTopic:          s.DeadLetterTopic,
            MaxDeliveryAttempts:      int32(s.MaxDeliveryAttempts),
            PushEndpoint:             s.PushEndpoint,
        })
    }

    return r.db.Clauses(clause.OnConflict{
        Columns:   []clause.Column{{Name: "project_id"}, {Name: "subscription_id"}},
        DoUpdates: clause.AssignmentColumns([]string{
            "subscription_name", "topic_id", "ack_deadline_seconds",
            "retain_acked_messages", "message_retention_duration", "filter",
            "dead_letter_topic", "max_delivery_attempts", "push_endpoint", "updated_at",
        }),
    }).Create(&models).Error
}

// GetSubscriptions retrieves all subscriptions for a project
func (r *SubscriptionsRepository) GetSubscriptions(projectID string) ([]admin.SubscriptionInfo, error) {
    var subs []Subscription

    err := r.db.Where("project_id = ?", projectID).Find(&subs).Error
    if err != nil {
        return nil, err
    }

    var result []admin.SubscriptionInfo
    for _, s := range subs {
        result = append(result, admin.SubscriptionInfo{
            ID:                       s.SubscriptionID,
            Name:                     s.SubscriptionName,
            Topic:                    s.TopicID,
            AckDeadlineSeconds:       int(s.AckDeadlineSeconds),
            RetainAckedMessages:      s.RetainAckedMessages,
            MessageRetentionDuration: s.MessageRetentionDuration,
            Filter:                   s.Filter,
            DeadLetterTopic:          s.DeadLetterTopic,
            MaxDeliveryAttempts:      int(s.MaxDeliveryAttempts),
            PushEndpoint:             s.PushEndpoint,
        })
    }

    return result, nil
}

// DeleteSubscription removes a subscription from cache
func (r *SubscriptionsRepository) DeleteSubscription(projectID, subID string) error {
    return r.db.Where("project_id = ? AND subscription_id = ?", projectID, subID).Delete(&Subscription{}).Error
}

// GetSubscriptionsCount returns the count of subscriptions
func (r *SubscriptionsRepository) GetSubscriptionsCount(projectID string) (int64, error) {
    var count int64
    err := r.db.Model(&Subscription{}).Where("project_id = ?", projectID).Count(&count).Error
    return count, err
}
```

**File:** `internal/cache/messages_repo.go`

```go
package cache

import (
    "encoding/json"
    "time"
    "gorm.io/gorm"
    "gorm.io/gorm/clause"
)

type MessagesRepository struct {
    db *gorm.DB
}

func NewMessagesRepository(db *gorm.DB) *MessagesRepository {
    return &MessagesRepository{db: db}
}

// InsertMessages batch inserts messages (using transaction)
func (r *MessagesRepository) InsertMessages(projectID string, messages []subscriber.PubSubMessage) error {
    if len(messages) == 0 {
        return nil
    }

    var models []Message

    for _, m := range messages {
        attrs, _ := json.Marshal(m.Attributes)

        models = append(models, Message{
            ProjectID:      projectID,
            TopicID:        m.TopicID,
            SubscriptionID: m.SubscriptionID,
            MessageID:      m.ID,
            PublishTime:    m.PublishTime,
            Data:           m.Data,
            Attributes:     string(attrs),
            OrderingKey:    m.OrderingKey,
        })
    }

    // Batch insert with ignore on conflict (deduplication)
    return r.db.Clauses(clause.OnConflict{
        Columns:   []clause.Column{{Name: "project_id"}, {Name: "message_id"}},
        DoNothing: true, // Skip duplicates
    }).CreateInBatches(models, 100).Error
}

// GetMessages retrieves messages for a topic or subscription
func (r *MessagesRepository) GetMessages(projectID, resourceID string, limit int) ([]subscriber.PubSubMessage, error) {
    var messages []Message

    query := r.db.Where("project_id = ?", projectID)

    // Filter by topic or subscription
    query = query.Where("topic_id = ? OR subscription_id = ?", resourceID, resourceID)

    // Order by publish time descending, limit results
    err := query.Order("publish_time DESC").Limit(limit).Find(&messages).Error
    if err != nil {
        return nil, err
    }

    var result []subscriber.PubSubMessage
    for _, m := range messages {
        var attrs map[string]string
        json.Unmarshal([]byte(m.Attributes), &attrs)

        result = append(result, subscriber.PubSubMessage{
            ID:             m.MessageID,
            TopicID:        m.TopicID,
            SubscriptionID: m.SubscriptionID,
            PublishTime:    m.PublishTime,
            Data:           m.Data,
            Attributes:     attrs,
            OrderingKey:    m.OrderingKey,
        })
    }

    return result, nil
}

// GetMessagesCount returns message count for a resource
func (r *MessagesRepository) GetMessagesCount(projectID string, resourceID string) (int64, error) {
    var count int64
    query := r.db.Model(&Message{}).Where("project_id = ?", projectID)

    if resourceID != "" {
        query = query.Where("topic_id = ? OR subscription_id = ?", resourceID, resourceID)
    }

    err := query.Count(&count).Error
    return count, err
}

// DeleteOldMessages deletes messages older than specified days
func (r *MessagesRepository) DeleteOldMessages(projectID string, olderThanDays int) (int64, error) {
    cutoff := time.Now().AddDate(0, 0, -olderThanDays)

    result := r.db.Where("project_id = ? AND publish_time < ?", projectID, cutoff).Delete(&Message{})
    return result.RowsAffected, result.Error
}

// TrimMessages keeps only the newest N messages for a resource
func (r *MessagesRepository) TrimMessages(projectID, resourceID string, maxCount int) (int64, error) {
    // Find IDs of messages to keep (newest N)
    var keepIDs []uint
    r.db.Model(&Message{}).
        Select("id").
        Where("project_id = ? AND (topic_id = ? OR subscription_id = ?)", projectID, resourceID, resourceID).
        Order("publish_time DESC").
        Limit(maxCount).
        Pluck("id", &keepIDs)

    // Delete messages not in the keep list
    result := r.db.Where("project_id = ? AND (topic_id = ? OR subscription_id = ?) AND id NOT IN ?",
        projectID, resourceID, resourceID, keepIDs).Delete(&Message{})

    return result.RowsAffected, result.Error
}
```

#### Step 1.3: Integrate with App

**File:** `app.go`

```go
type App struct {
    // ... existing fields
    cacheDB      *cache.CacheDB
    topicsRepo   *cache.TopicsRepository
    subsRepo     *cache.SubscriptionsRepository
    messagesRepo *cache.MessagesRepository
}

func NewApp() *App {
    app := &App{}

    // Initialize cache on startup
    cacheDB, err := cache.NewCacheDB(getCachePath(), getCacheConfig())
    if err != nil {
        log.Printf("Failed to initialize cache: %v", err)
        return app
    }

    if err := cacheDB.Initialize(); err != nil {
        log.Printf("Failed to run migrations: %v", err)
        return app
    }

    app.cacheDB = cacheDB
    app.topicsRepo = cache.NewTopicsRepository(cacheDB.GetDB())
    app.subsRepo = cache.NewSubscriptionsRepository(cacheDB.GetDB())
    app.messagesRepo = cache.NewMessagesRepository(cacheDB.GetDB())

    return app
}

// Modified methods:
func (a *App) SyncResources() error {
    // 1. Try to load from cache first (if fresh)
    if isCacheFresh(a.currentProjectID) {
        topics, _ := a.topicsRepo.GetTopics(a.currentProjectID)
        subs, _ := a.subsRepo.GetSubscriptions(a.currentProjectID)

        a.resourceMu.Lock()
        a.topics = topics
        a.subscriptions = subs
        a.resourceMu.Unlock()

        runtime.EventsEmit(a.ctx, "resources:updated", map[string]interface{}{
            "topics":        topics,
            "subscriptions": subs,
            "fromCache":     true,
        })
    }

    // 2. Fetch from API in parallel (background sync)
    go func() {
        topics, subs := fetchFromAPI()

        // 3. Update cache on success
        a.topicsRepo.UpsertTopics(a.currentProjectID, topics)
        a.subsRepo.UpsertSubscriptions(a.currentProjectID, subs)

        // 4. Update in-memory state
        a.resourceMu.Lock()
        a.topics = topics
        a.subscriptions = subs
        a.resourceMu.Unlock()

        // 5. Emit update event
        runtime.EventsEmit(a.ctx, "resources:updated", map[string]interface{}{
            "topics":        topics,
            "subscriptions": subs,
            "fromCache":     false,
        })
    }()

    return nil
}

// New cache management methods
func (a *App) GetCacheStats() (cache.CacheStats, error) {
    // Implementation
}

func (a *App) ClearCache() error {
    return a.cacheDB.GetDB().Exec("DELETE FROM messages; DELETE FROM subscriptions; DELETE FROM topics; DELETE FROM projects;").Error
}

func (a *App) OptimizeCache() error {
    // Run cleanup + vacuum
    return a.cacheDB.Cleanup()
}
```

#### Step 1.4: Background Cleanup Worker

**File:** `internal/cache/cleanup.go`

```go
package cache

import (
    "time"
    "log"
)

type CleanupWorker struct {
    db       *CacheDB
    interval time.Duration
    stopChan chan struct{}
}

func NewCleanupWorker(db *CacheDB, intervalMinutes int) *CleanupWorker {
    return &CleanupWorker{
        db:       db,
        interval: time.Duration(intervalMinutes) * time.Minute,
        stopChan: make(chan struct{}),
    }
}

func (w *CleanupWorker) Start() {
    ticker := time.NewTicker(w.interval)

    go func() {
        for {
            select {
            case <-ticker.C:
                w.runCleanup()
            case <-w.stopChan:
                ticker.Stop()
                return
            }
        }
    }()
}

func (w *CleanupWorker) Stop() {
    close(w.stopChan)
}

func (w *CleanupWorker) runCleanup() error {
    log.Println("Starting cache cleanup...")

    // Check DB size
    size, _ := w.db.GetDatabaseSize()
    maxSize := int64(w.db.config.MaxDbSizeMB * 1024 * 1024)

    if size < int64(float64(maxSize)*0.9) {
        log.Println("Cache size OK, skipping cleanup")
        return nil
    }

    // Run cleanup algorithm
    result, err := w.db.Cleanup()
    if err != nil {
        log.Printf("Cleanup failed: %v", err)
        return err
    }

    log.Printf("Cleanup completed: deleted %d messages, freed %d MB",
        result.MessagesDeleted, result.SpaceFreedMB)

    return nil
}
```

**File:** `internal/cache/stats.go`

```go
package cache

import (
    "time"
)

type CacheStats struct {
    DbSizeMB              float64
    DbSizePercentUsed     float64
    MaxDbSizeMB           int
    TopicsCount           int64
    SubscriptionsCount    int64
    MessagesCount         int64
    OldestMessageAgeHours float64
    LastCleanup           *time.Time
    APICallsSaved         int
}

type CleanupResult struct {
    MessagesDeleted int64
    SpaceFreedMB    int64
    Duration        time.Duration
}

// GetStats retrieves current cache statistics
func (c *CacheDB) GetStats() (CacheStats, error) {
    stats := CacheStats{
        MaxDbSizeMB: c.config.MaxDbSizeMB,
    }

    // DB size
    size, _ := c.GetDatabaseSize()
    stats.DbSizeMB = float64(size) / 1024 / 1024
    stats.DbSizePercentUsed = (stats.DbSizeMB / float64(c.config.MaxDbSizeMB)) * 100

    // Counts
    c.db.Model(&Topic{}).Count(&stats.TopicsCount)
    c.db.Model(&Subscription{}).Count(&stats.SubscriptionsCount)
    c.db.Model(&Message{}).Count(&stats.MessagesCount)

    // Oldest message age
    var oldestMessage Message
    if err := c.db.Order("publish_time ASC").First(&oldestMessage).Error; err == nil {
        age := time.Since(oldestMessage.PublishTime)
        stats.OldestMessageAgeHours = age.Hours()
    }

    // API calls saved (estimated)
    stats.APICallsSaved = int(stats.TopicsCount + stats.SubscriptionsCount)

    return stats, nil
}

// GetDatabaseSize returns the database file size in bytes
func (c *CacheDB) GetDatabaseSize() (int64, error) {
    var pageCount int64
    var pageSize int64

    c.db.Raw("PRAGMA page_count").Scan(&pageCount)
    c.db.Raw("PRAGMA page_size").Scan(&pageSize)

    return pageCount * pageSize, nil
}

// Cleanup runs the cleanup algorithm
func (c *CacheDB) Cleanup() (CleanupResult, error) {
    startTime := time.Now()
    result := CleanupResult{}

    startSize, _ := c.GetDatabaseSize()

    // Use repositories to clean up
    messagesRepo := NewMessagesRepository(c.db)

    // Step 1: Delete old messages
    deleted, _ := messagesRepo.DeleteOldMessages("", c.config.MaxMessageAgeDays)
    result.MessagesDeleted += deleted

    // Step 2: Trim excess messages per topic/subscription
    // (would need to iterate through all topics/subs)

    // Step 3: Delete old cache stats
    c.db.Where("recorded_at < ?", time.Now().AddDate(0, 0, -90)).Delete(&CacheStat{})

    // Step 4: Vacuum
    c.db.Exec("VACUUM")

    endSize, _ := c.GetDatabaseSize()
    result.SpaceFreedMB = (startSize - endSize) / 1024 / 1024
    result.Duration = time.Since(startTime)

    // Record cleanup stats
    c.recordCleanup(result)

    return result, nil
}

func (c *CacheDB) recordCleanup(result CleanupResult) {
    stats, _ := c.GetStats()

    c.db.Create(&CacheStat{
        DbSizeBytes:           int64(stats.DbSizeMB * 1024 * 1024),
        TopicsCount:           int(stats.TopicsCount),
        SubscriptionsCount:    int(stats.SubscriptionsCount),
        MessagesCount:         int(stats.MessagesCount),
        OldestMessageAgeHours: stats.OldestMessageAgeHours,
        APICallsSaved:         stats.APICallsSaved,
    })
}
```

### Phase 2: Frontend Integration (React)

#### Step 2.1: Cache Context

**File:** `frontend/src/contexts/CacheContext.tsx`

```tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { GetCacheStats, ClearCache, OptimizeCache } from '../../wailsjs/go/main/App';

interface CacheStats {
  dbSizeMB: number;
  dbSizePercentUsed: number;
  maxDbSizeMB: number;
  topicsCount: number;
  subscriptionsCount: number;
  messagesCount: number;
  oldestMessageAgeHours: number;
  lastCleanup: string | null;
  apiCallsSaved: number;
}

interface CacheContextType {
  stats: CacheStats | null;
  refreshStats: () => Promise<void>;
  clearCache: () => Promise<void>;
  optimizeCache: () => Promise<void>;
  isOptimizing: boolean;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

export const CacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const refreshStats = async () => {
    try {
      const newStats = await GetCacheStats();
      setStats(newStats);
    } catch (error) {
      console.error('Failed to fetch cache stats:', error);
    }
  };

  const clearCache = async () => {
    try {
      await ClearCache();
      await refreshStats();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  const optimizeCache = async () => {
    setIsOptimizing(true);
    try {
      await OptimizeCache();
      await refreshStats();
    } catch (error) {
      console.error('Failed to optimize cache:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  useEffect(() => {
    refreshStats();

    // Listen for cache events
    EventsOn('cache:stats-updated', (newStats: CacheStats) => {
      setStats(newStats);
    });

    EventsOn('cache:cleanup-completed', () => {
      refreshStats();
    });

    // Refresh stats every 30 seconds
    const interval = setInterval(refreshStats, 30000);

    return () => {
      clearInterval(interval);
      EventsOff('cache:stats-updated');
      EventsOff('cache:cleanup-completed');
    };
  }, []);

  return (
    <CacheContext.Provider value={{ stats, refreshStats, clearCache, optimizeCache, isOptimizing }}>
      {children}
    </CacheContext.Provider>
  );
};

export const useCache = () => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache must be used within CacheProvider');
  }
  return context;
};
```

#### Step 2.2: Cache Status Badge

**File:** `frontend/src/components/CacheStatusBadge.tsx`

```tsx
import React from 'react';
import { useCache } from '../contexts/CacheContext';

export default function CacheStatusBadge() {
  const { stats } = useCache();

  if (!stats) return null;

  const getStatusColor = () => {
    if (stats.dbSizePercentUsed < 70) return 'var(--color-success)';
    if (stats.dbSizePercentUsed < 90) return 'var(--color-warning)';
    return 'var(--color-error)';
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-primary)',
        fontSize: '12px',
        gap: '6px',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
        }}
      />
      <span style={{ color: 'var(--color-text-secondary)' }}>
        Cache: {Math.round(stats.dbSizeMB)} MB / {stats.maxDbSizeMB} MB
      </span>
    </div>
  );
}
```

#### Step 2.3: Settings Cache Tab

**File:** `frontend/src/components/Settings/CacheTab.tsx`

```tsx
import React from 'react';
import { useCache } from '../../contexts/CacheContext';

export default function CacheTab() {
  const { stats, clearCache, optimizeCache, isOptimizing } = useCache();

  if (!stats) {
    return <div>Loading cache stats...</div>;
  }

  const formatAge = (hours: number) => {
    if (hours < 24) return `${Math.round(hours)} hours`;
    return `${Math.round(hours / 24)} days`;
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ color: 'var(--color-text-primary)', marginBottom: '20px' }}>
        Cache Management
      </h2>

      {/* Database Size Gauge */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          color: 'var(--color-text-primary)'
        }}>
          <span>Database Size</span>
          <span>{Math.round(stats.dbSizeMB)} MB / {stats.maxDbSizeMB} MB</span>
        </div>

        <div style={{
          width: '100%',
          height: '24px',
          backgroundColor: 'var(--color-bg-tertiary)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div
            style={{
              width: `${Math.min(stats.dbSizePercentUsed, 100)}%`,
              height: '100%',
              backgroundColor: stats.dbSizePercentUsed < 70
                ? 'var(--color-success)'
                : stats.dbSizePercentUsed < 90
                  ? 'var(--color-warning)'
                  : 'var(--color-error)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        <div style={{
          marginTop: '4px',
          fontSize: '12px',
          color: 'var(--color-text-muted)'
        }}>
          {Math.round(stats.dbSizePercentUsed)}% used
        </div>
      </div>

      {/* Statistics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <StatCard label="Topics" value={stats.topicsCount} />
        <StatCard label="Subscriptions" value={stats.subscriptionsCount} />
        <StatCard label="Messages" value={stats.messagesCount.toLocaleString()} />
        <StatCard label="Oldest Message" value={formatAge(stats.oldestMessageAgeHours)} />
        <StatCard label="API Calls Saved" value={stats.apiCallsSaved} />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={optimizeCache}
          disabled={isOptimizing}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--color-accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isOptimizing ? 'not-allowed' : 'pointer',
            opacity: isOptimizing ? 0.6 : 1,
          }}
        >
          {isOptimizing ? 'Optimizing...' : 'Optimize Cache'}
        </button>

        <button
          onClick={() => {
            if (confirm('Are you sure you want to clear the entire cache?')) {
              clearCache();
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--color-error)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Clear Cache
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: '8px',
      }}
    >
      <div style={{
        fontSize: '12px',
        color: 'var(--color-text-muted)',
        marginBottom: '4px'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: 'var(--color-text-primary)'
      }}>
        {value}
      </div>
    </div>
  );
}
```

---

## API Changes

### New Backend Methods

```go
// Cache management
func (a *App) GetCacheStats() (CacheStats, error)
func (a *App) GetCacheConfig() (CacheConfig, error)
func (a *App) UpdateCacheConfig(config CacheConfig) error
func (a *App) ClearCache() error
func (a *App) OptimizeCache() (CleanupResult, error)
func (a *App) ExportCacheData() (string, error)
func (a *App) ImportCacheData(jsonData string) error

// Enhanced resource methods (cache-aware)
func (a *App) GetCachedTopics(projectID string) ([]admin.TopicInfo, error)
func (a *App) GetCachedSubscriptions(projectID string) ([]admin.SubscriptionInfo, error)
func (a *App) GetMessageHistory(projectID, resourceID string, limit int) ([]subscriber.PubSubMessage, error)
```

### New Frontend Events

```typescript
"cache:stats-updated" -> CacheStats
"cache:cleanup-started" -> { timestamp: string }
"cache:cleanup-completed" -> CleanupResult
"cache:size-warning" -> { percentUsed: number, sizeMB: number }
"cache:optimized" -> { freedMB: number, duration: number }
"cache:error" -> { error: string }
```

---

## Configuration Schema

**Add to `~/.pubsub-gui/config.json`:**

```json
{
  "cache": {
    "maxDbSizeMB": 500,
    "maxMessagesPerTopic": 10000,
    "maxMessagesPerSubscription": 10000,
    "maxMessageAgeDays": 30,
    "enableAutoCleanup": true,
    "cleanupIntervalMinutes": 60,
    "syncIntervalMinutes": 5,
    "enableOfflineMode": true
  }
}
```

---

## Testing Strategy

### Unit Tests

**Backend (GORM Models & Repositories):**

```go
// internal/cache/topics_repo_test.go
func TestTopicsRepository_UpsertTopics(t *testing.T)
func TestTopicsRepository_GetTopics(t *testing.T)
func TestTopicsRepository_DeleteTopic(t *testing.T)

// internal/cache/messages_repo_test.go
func TestMessagesRepository_InsertMessages(t *testing.T)
func TestMessagesRepository_TrimMessages(t *testing.T)
func TestMessagesRepository_DeleteOldMessages(t *testing.T)

// internal/cache/cleanup_test.go
func TestCleanupWorker_RunCleanup(t *testing.T)
func TestCacheDB_GetStats(t *testing.T)
```

### Integration Tests

1. **Cache Write/Read Cycle**
2. **Size Limit Enforcement**
3. **Offline Mode**
4. **Concurrent Access (GORM handles this well)**

---

## Dependencies

### Go Packages (New)

```go
require (
    gorm.io/gorm v1.25.5
    gorm.io/driver/sqlite v1.5.4
)
```

### Frontend Packages (New)

- `recharts` - For analytics charts
- `react-gauge-chart` - For DB size gauge (optional)

---

## Implementation Timeline

### Week 1: Backend Foundation with GORM

- [ ] Create GORM models and migrations
- [ ] Implement repository pattern
- [ ] Add size calculation and monitoring
- [ ] Write unit tests

### Week 2: Integration & Cleanup

- [ ] Integrate cache with App struct
- [ ] Modify SyncResources to use cache
- [ ] Implement cleanup worker
- [ ] Add cache configuration

### Week 3: Frontend UI

- [ ] Create CacheContext
- [ ] Build cache status components
- [ ] Add CacheTab to Settings
- [ ] Implement real-time updates

### Week 4: Polish & Testing

- [ ] Performance testing
- [ ] UI/UX refinements
- [ ] Documentation updates
- [ ] End-to-end testing

---

## Success Metrics

- [ ] API calls reduced by 95%+ after cache warm-up
- [ ] Resource list loads in < 100ms from cache
- [ ] Message history retrieval < 500ms for 10k messages
- [ ] Cleanup completes in < 30 seconds for full DB
- [ ] Zero data corruption incidents
- [ ] Cache sync success rate > 99.9%

---

## Risks & Mitigations

### Risk 1: GORM Performance

**Impact:** Medium

**Mitigation:**

- Use PrepareStmt caching
- Batch operations with transactions
- Profile queries and add indexes

### Risk 2: Database Corruption

**Impact:** High

**Mitigation:**

- WAL mode for crash resistance
- GORM auto-validates schema
- Auto-rebuild cache if corrupted

---

## Conclusion

Using GORM provides:

- **Faster Development**: Auto-migrations, type-safe queries
- **Better Maintainability**: Clear model definitions, easier refactoring
- **Production Ready**: Battle-tested ORM with excellent concurrency support
- **Future Flexibility**: Easy to add features like soft deletes, hooks, etc.

**Estimated Total Effort:** 3-4 weeks (1 developer)

**Risk Level:** Low-Medium (GORM is stable and well-documented)

**Priority:** High (Performance & UX improvement)