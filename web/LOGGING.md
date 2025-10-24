# Logging System Documentation

## Overview

RadiantCare uses a centralized logging system that provides structured, configurable logging throughout the application. The logger is implemented in `/src/lib/logger.ts` and replaces all previous `console.log/warn/error` statements with a consistent, namespace-based approach.

## Features

- ✅ **Configurable log levels**: DEBUG, INFO, WARN, ERROR, NONE
- ✅ **Namespace-based filtering**: Enable/disable logging per component/feature
- ✅ **Environment-aware**: Auto-adjusts verbosity for development vs production
- ✅ **Zero performance overhead**: Disabled logs are completely skipped
- ✅ **Structured logging**: Consistent timestamp and context formatting
- ✅ **Browser console access**: Configure logger from browser dev tools

## Log Levels

| Level | Priority | Usage |
|-------|----------|-------|
| DEBUG | 0 | Detailed operational logging, calculations, state changes |
| INFO  | 1 | High-level events (sync complete, scenario loaded) |
| WARN  | 2 | Non-critical issues, fallbacks, deprecations |
| ERROR | 3 | Errors and exceptions |
| NONE  | 999 | Disable all logging |

## Namespaces

The logger uses namespaces to categorize log messages by functional area:

| Namespace | Description | Key Files |
|-----------|-------------|-----------|
| `AUTH` | Authentication, login, session management | AuthProvider.tsx |
| `QBO_SYNC` | QuickBooks sync operations | SyncButton.tsx |
| `QBO_CACHE` | Cache loading and management | load2025Data.ts |
| `SESSION` | Session load/restore | Dashboard.tsx |
| `SHARE_LINK` | Shareable link creation/loading | Dashboard.tsx |
| `COMPENSATION` | Compensation calculations | compensationEngine.ts, YearPanel.tsx |
| `GRID` | Yearly grid calculations/sync | YearlyDataGrid.tsx, load2025Data.ts |
| `SCENARIO` | Scenario save/load/management | ScenarioManager.tsx, Dashboard.tsx |
| `STORE` | Dashboard store state changes | Dashboard.tsx |
| `DATA_TRANSFORM` | Data parsing/transformation | yearlyDataTransformer.ts, parsers |
| `SNAPSHOT` | Snapshot save/restore | Dashboard.tsx |
| `PHYSICIAN` | Physician CRUD operations | PhysiciansEditor.tsx |
| `MD_HOURS` | Medical director hours redistribution | Dashboard.tsx |
| `API` | API calls/responses | (future use) |
| `CHART` | Chart rendering/updates | MultiYearView.tsx, HistoricAndProjectionChart.tsx |
| `UI` | UI interactions | DragDropPhysicians.tsx, tooltips.ts |

## Usage

### Basic Logging

```typescript
import { logger } from '../lib/logger'

// Debug level - detailed info
logger.debug('COMPENSATION', 'Pool calculated', {
  income: 500000,
  costs: 300000,
  pool: 200000
})

// Info level - important events
logger.info('QBO_SYNC', 'Sync completed successfully', {
  timestamp: Date.now()
})

// Warning level - recoverable issues
logger.warn('QBO_CACHE', 'Cache miss, using fallback data')

// Error level - exceptions
logger.error('AUTH', 'Failed to load profile', error)
```

### Configuration

#### From Code

```typescript
// Set global log level
logger.setLevel('DEBUG')  // Show all logs
logger.setLevel('INFO')   // Show INFO, WARN, ERROR
logger.setLevel('WARN')   // Show only WARN and ERROR
logger.setLevel('ERROR')  // Show only errors
logger.setLevel('NONE')   // Disable all logs

// Set per-namespace level
logger.setNamespaceLevel('COMPENSATION', 'DEBUG')
logger.setNamespaceLevel('CHART', 'ERROR')

// Enable specific namespaces only
logger.enableOnly(['QBO_SYNC', 'COMPENSATION', 'AUTH'])

// Enable all namespaces
logger.enableAll()

// Disable all logging
logger.disableAll()
```

#### From Browser Console

The logger is available globally as `window.logger`:

```javascript
// Check current configuration
logger.getConfiguration()

// Enable debug logging for compensation
logger.setLevel('DEBUG')
logger.enableOnly(['COMPENSATION', 'GRID'])

// Enable everything in debug mode
logger.setLevel('DEBUG')
logger.enableAll()

// Disable specific namespace
logger.enableOnly(['AUTH', 'QBO_SYNC'])  // Only show these two

// Production-safe: Only errors
logger.setLevel('ERROR')
```

#### Using localStorage

Configuration persists across sessions:

```javascript
// Set log level (persists on page reload)
localStorage.setItem('LOG_LEVEL', 'DEBUG')

// Set enabled namespaces (comma-separated)
localStorage.setItem('LOG_NAMESPACES', 'COMPENSATION,GRID,QBO_SYNC')

// Enable all namespaces
localStorage.setItem('LOG_NAMESPACES', 'ALL')

// Reload page to apply changes
location.reload()
```

## Default Configuration

### Development
- **Level**: INFO
- **Namespaces**: ALL enabled
- **Format**: Verbose with full context

### Production
- **Level**: WARN
- **Namespaces**: AUTH, QBO_SYNC, COMPENSATION, SCENARIO
- **Format**: Compact

## Log Format

```
[2025-10-24T17:00:00.000Z] [DEBUG] [COMPENSATION] Pool calculated { income: 500000, costs: 300000, pool: 200000 }
│                           │       │               │                │
│                           │       │               │                └─ Data (optional)
│                           │       │               └─ Message
│                           │       └─ Namespace
│                           └─ Level
└─ ISO 8601 timestamp
```

## Common Debugging Scenarios

### Debugging Compensation Calculations

```javascript
// Enable compensation and grid logging
logger.setLevel('DEBUG')
logger.enableOnly(['COMPENSATION', 'GRID', 'MD_HOURS'])
```

### Debugging QuickBooks Sync

```javascript
// Enable QB-related logging
logger.setLevel('DEBUG')
logger.enableOnly(['QBO_SYNC', 'QBO_CACHE', 'API'])
```

### Debugging Scenario Load/Save

```javascript
// Enable scenario and snapshot logging
logger.setLevel('DEBUG')
logger.enableOnly(['SCENARIO', 'SNAPSHOT', 'STORE'])
```

### Debugging Grid Calculations

```javascript
// Enable grid and data transformation logging
logger.setLevel('DEBUG')
logger.enableOnly(['GRID', 'DATA_TRANSFORM'])
```

### Production Monitoring

```javascript
// Only show errors in production
logger.setLevel('ERROR')
logger.enableAll()
```

## Migration Notes

All previous `console.log/warn/error` statements have been replaced with structured logger calls:

- `console.log(...)` → `logger.debug(namespace, message, data?)`
- `console.warn(...)` → `logger.warn(namespace, message, data?)`
- `console.error(...)` → `logger.error(namespace, message, error?)`

## Best Practices

1. **Use appropriate log levels**
   - DEBUG: Calculation details, state transitions, loop iterations
   - INFO: Feature completions, major state changes
   - WARN: Fallbacks, deprecations, recoverable issues
   - ERROR: Exceptions, critical failures

2. **Use descriptive messages**
   ```typescript
   // ❌ Bad
   logger.debug('GRID', 'value', someValue)

   // ✅ Good
   logger.debug('GRID', 'Cell value updated', {
     account: 'therapyIncome',
     value: someValue
   })
   ```

3. **Include context in data objects**
   ```typescript
   logger.debug('COMPENSATION', 'Calculation completed', {
     year: 2025,
     pool: calculatedPool,
     partners: partnerCount
   })
   ```

4. **Use correct namespace for the operation**
   - Don't log compensation details under 'UI'
   - Don't log UI clicks under 'COMPENSATION'

5. **Don't log sensitive data**
   - Avoid logging passwords, tokens, PII
   - Use sanitized data or omit sensitive fields

## Performance

The logger has zero overhead when logs are disabled:

```typescript
// This check happens first - no string formatting if disabled
if (this.shouldLog(namespace, level)) {
  // Only executed if logging is enabled
  this.formatMessage(namespace, level, message, data)
}
```

## Troubleshooting

### Logs not appearing?

1. Check log level: `logger.getConfiguration()`
2. Ensure namespace is enabled: `logger.enableAll()`
3. Clear localStorage: `localStorage.clear()` then reload

### Too many logs?

1. Increase log level: `logger.setLevel('WARN')`
2. Filter namespaces: `logger.enableOnly(['ERROR_NAMESPACE'])`

### Can't find where a log is coming from?

1. Search for the message text in the codebase
2. Filter by namespace to narrow down the file
3. Add a breakpoint in `logger.ts` `formatMessage()` method

## Future Enhancements

Potential improvements for the logging system:

- Remote logging service integration
- Log aggregation and analysis
- Performance metrics tracking
- Automatic error reporting
- Log level UI control panel
- Per-user log preferences
