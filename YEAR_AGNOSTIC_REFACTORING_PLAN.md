# Year-Agnostic Refactoring Plan for RadiantCare

## Executive Summary

The RadiantCare codebase has extensive year hardcoding throughout the application, with **2025 as the current baseline year** and **2026-2030 as projection years**. The hardcoding ranges from simple nomenclature to deep architectural dependencies that would require significant refactoring to make dynamic.

This document provides a comprehensive analysis and phased implementation plan to make the application year-agnostic, enabling smooth automatic transitions to new years with minimal manual intervention.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Files with Year References by Category](#files-with-year-references-by-category)
3. [Problematic Hardcoded Patterns](#problematic-hardcoded-patterns)
4. [Key Architectural Constraints](#key-architectural-constraints)
5. [How Scenarios Store Year Data](#how-scenarios-store-year-data)
6. [QuickBooks Sync Process](#quickbooks-sync-process)
7. [Recommended Approach: Phased Refactoring](#recommended-approach-phased-refactoring)
8. [Implementation Priority](#implementation-priority)
9. [Key Architectural Decisions](#key-architectural-decisions)
10. [Testing Strategy](#testing-strategy)
11. [Risk Mitigation](#risk-mitigation)

---

## Current State Analysis

### Overview

- **Files with 2025 references**: 38 TypeScript files
- **Files with 2026-2030 references**: 11 TypeScript files
- **API endpoints year-coupled**: 2 (`sync-2025.ts`, `cached-2025.ts`)
- **Type definitions affected**: 10+ types in `types.ts`
- **Historical data files**: 9 years (2016-2024) + 3 current year files
- **Core calculation files**: 3 (`defaults.ts`, `calculations.ts`, `Dashboard.tsx`)

### Estimated Refactoring Effort

- **Short-term fixes**: 8-16 hours (update for 2026)
- **Medium-term refactoring**: 40-80 hours (parameterize years)
- **Long-term architecture**: 160-240 hours (full dynamic system)

---

## Files with Year References by Category

### CATEGORY A: Core Architecture - Hardcoded Logic (Major Refactoring Required)

#### Critical Infrastructure

**`/api/qbo/sync-2025.ts`** (489 lines)
- **Purpose**: QuickBooks sync endpoint
- **Issues**:
  - Filename itself is year-specific
  - Federal holidays hardcoded for 2025 (lines 23-35)
  - Success message "Successfully synced all 2025 data" (line 489)
  - Date range calculation: `const start = ${year}-01-01` (line 316)
- **Impact**: High - requires new API endpoint for each year

#### Data Layer

**`/web/src/components/dashboard/shared/defaults.ts`** (485 lines)
- **Issues**:
  - `HISTORIC_DATA` array hardcoded with years 2016-2025 (lines 6-20)
  - Social Security wage bases hardcoded 2025-2030 (lines 42-49)
  - Default values tied to specific years: `DEFAULT_CONSULTING_SERVICES_2024`, `DEFAULT_CONSULTING_SERVICES_2025` (lines 26-28)
  - Actual values: `ACTUAL_2024_*`, `ACTUAL_2025_*` constants (lines 76-87)
  - Year-specific physician defaults in functions: `scenario2024Defaults()`, `scenarioADefaultsByYear(year)` with hardcoded logic for 2025-2030 (lines 252-392)
- **Impact**: Very High - central configuration file

**`/web/src/components/dashboard/shared/calculations.ts`** (484 lines)
- **Issues**:
  - Social Security wage base lookup by year (line 28-30)
  - Year 2024/2025 conditional logic for medical director income (lines 330-335)
  - Benefit year calculation from base year 2025 (line 54)
- **Impact**: High - core business logic

#### Store/State Management

**`/web/src/components/Dashboard.tsx`** (2600+ lines)
- **Issues**:
  - Initial state hardcoded: `selectedYear: 2025` (line 84)
  - `dataMode: '2025 Data'` (line 85)
  - YTD data initialized with `year === 2025` checks (lines 92-104)
  - Multiple year checks: `year === 2025`, `year >= 2026`, `year <= 2030` throughout
  - HISTORIC_DATA last year calculation: `HISTORIC_DATA[HISTORIC_DATA.length - 1].year + 1` assumes 2025 is last (line 397)
- **Impact**: Very High - central state management

#### Data Transformation

**`/web/src/components/dashboard/views/detailed/utils/yearlyDataTransformer.ts`**
- **Issues**:
  - Comment "Types for the 2025 JSON data" (line 38)
  - Mapping object `mapping2025` for account name conversions (line 53)
- **Impact**: High - data parsing logic

**`/web/src/components/dashboard/views/detailed/utils/load2025Data.ts`** (327 lines)
- **Issues**:
  - Entire filename and function names: `load2025Data`, `load2025ValuesForReset`
  - Type: `Cached2025Data` (line 7)
  - Imports from `ACTUAL_2025_*` constants (line 131)
  - Comments reference "2025 baseline customizations" throughout
- **Impact**: High - data loading layer

### CATEGORY B: Configuration/Settings (Moderate Refactoring)

#### Type Definitions

**`/web/src/components/dashboard/shared/types.ts`** (403 lines)
- **Issues**:
  - Comments: "For 2024+, this represents..." (line 4)
  - Type definitions tied to "2025 baseline" (lines 147-149)
  - `BaselineMode = '2024 Data' | '2025 Data' | 'Custom'` (line 124)
  - Field names: `year_2025_data` (line 148, 193)
- **Impact**: Medium - type system changes needed

#### Scenario Management

**`/web/src/components/scenarios/ScenarioManager.tsx`**
- **Issues**: References to "2025 data", "year_2025_data" field

**`/web/src/components/scenarios/ScenarioCard.tsx`**
- **Issues**: Checks for `baseline_mode === '2025 Data'` (line 83)

**`/web/src/components/scenarios/ModularScenarioSaveDialog.tsx`**
- **Issues**:
  - `baselineMode: '2024 Data' | '2025 Data' | 'Custom'` type (line 7)
  - Conditional logic based on `baselineMode === '2025 Data'` (lines 19, 44, 89, 185)

### CATEGORY C: Nomenclature Only (Easy to Change)

#### UI Components

**`/web/src/components/dashboard/views/detailed/YTDDetailed.tsx`**
- Line 86: Comment "Get YTD data (2025 current year)"
- Line 374, 376: `year: 2025` in currentPeriod
- Line 800: Alert message "Only 2025 data will be saved"

**`/web/src/components/dashboard/views/detailed/YTDDetailedMobile.tsx`**
- Similar references to 2025 in comments and UI

**`/web/src/components/dashboard/views/multi-year/MultiYearView.tsx`**
- Default year fallback: `?? 2025` (lines 1257, 1487)
- Year range checks: `year >= 2026 && year <= 2030` (line 120)

**`/web/src/components/dashboard/views/multi-year/HistoricAndProjectionChart.tsx`**
- Checks for `year === 2025` in baseline logic
- Comments referencing 2025 baseline

#### Help/Documentation

- `/web/src/components/shared/ComprehensiveHelpGuide.tsx`
- `/web/src/components/shared/QuickHelpModal.tsx`

#### Historical Data Files

All in `/web/src/historical_data/`:
- `2016-2024_yearly.json` - Historical yearly data
- `2016.json` through `2024.json` - Individual year data
- `2025_daily.json`, `2025_equity.json`, `2025_summary.json` - Current year QuickBooks cache
- `siteIncomeParser.ts`, `therapyIncomeParser.ts` - Parsers for year-specific data

---

## Problematic Hardcoded Patterns

### Pattern 1: Year Range Loops

```typescript
// defaults.ts lines 276-316
else if (year === 2026) { ... }
else if (year === 2027) { ... }
else if (year === 2028) { ... }
else if (year === 2029) { ... }
else { // 2030+ ... }
```

**Issue**: Adding/changing years requires editing multiple conditional blocks

### Pattern 2: Social Security Wage Bases

```typescript
// defaults.ts lines 42-49
export const SOCIAL_SECURITY_WAGE_BASES = {
  2025: 176100,
  2026: 183600,
  2027: 190800,
  2028: 198900,
  2029: 207000,
  2030: 215400,
} as const
```

**Issue**: Requires annual updates, doesn't extrapolate

### Pattern 3: Year-Specific Constants

```typescript
// defaults.ts
export const DEFAULT_CONSULTING_SERVICES_2024 = 15693.40
export const DEFAULT_CONSULTING_SERVICES_2025 = 16200
export const ACTUAL_2024_MEDICAL_DIRECTOR_HOURS = 102870
export const ACTUAL_2025_MEDICAL_DIRECTOR_HOURS = 119374
```

**Issue**: Creates new constants each year instead of using a data structure

### Pattern 4: Hardcoded Baseline Year

```typescript
// Dashboard.tsx line 84
selectedYear: 2025, // Default to Baseline tab
dataMode: '2025 Data',
```

**Issue**: Requires code change to move to next year

### Pattern 5: Year-Specific File Names

- `sync-2025.ts` - API endpoint
- `cached-2025.ts` - Cache retrieval
- `load2025Data.ts` - Data loader
- `2025_daily.json`, etc. - Data files

**Issue**: New files needed each year, or rename/migration required

### Pattern 6: Array-Based Future Years

```typescript
// defaults.ts lines 396-409
export function getFutureYearsBase(): Omit<FutureYear, 'physicians'>[] {
  return Array.from({ length: 5 }).map((_, idx) => {
    const startYear = HISTORIC_DATA[HISTORIC_DATA.length - 1].year + 1
    const year = startYear + idx
    // ...
  })
}
```

**Issue**: Assumes 5-year projection window, hardcoded length

---

## Key Architectural Constraints

### Constraint 1: Historic Data as Array

The `HISTORIC_DATA` array in `defaults.ts` is a hardcoded array of objects from 2016-2025. Adding a new year requires:
1. Appending to the array
2. Updating all code that assumes `HISTORIC_DATA[HISTORIC_DATA.length - 1]` is the current year
3. Updating projection logic that calculates `startYear` from this array

### Constraint 2: Baseline Year Concept

The entire application is built around **2025 as the baseline year**:
- YTD views show "2025 actuals vs projected"
- Multi-year projections start from 2025
- Scenarios save "2025 baseline customizations"
- Data modes: `'2024 Data' | '2025 Data' | 'Custom'`

**Changing this requires**:
- Database schema changes (fields named `year_2025_data`)
- Type system updates (`BaselineMode` enum)
- UI component refactoring

### Constraint 3: Projection Window

Projections are hardcoded as **2026-2030 (5 years)**:
- Year panel logic checks `year >= 2026 && year <= 2030`
- Filters: `future.filter(f => f.year >= 2026 && f.year <= 2030)`
- Comments reference "2026-2030" explicitly

### Constraint 4: QuickBooks Sync Endpoint

The sync endpoint is year-specific:
- Filename: `sync-2025.ts`
- Cron job likely points to this specific endpoint
- ~~Federal holidays array hardcoded for 2025~~ (will be removed - sync runs M-F via cron)
- Success message references 2025

**Migration requires**:
- Creating new endpoint (or making generic)
- Updating cron job configuration to include `?year=YYYY` parameter
- ~~Updating federal holidays list~~ (not needed - cron schedule handles weekday-only syncing)

### Constraint 5: Data File Structure

Historical data files are named by year:
- `2016.json` through `2024.json`
- `2025_daily.json`, `2025_summary.json`, `2025_equity.json`

Parser functions expect these specific file names.

---

## How Scenarios Store Year Data

### Legacy Scenario Types (Pre-Modular)

#### YTDScenario

```typescript
{
  view_mode: 'YTD Detailed',
  baseline_date: string, // ISO date
  year_2025_data: FutureYear, // 2025 physician panel settings
  custom_projected_values: Record<string, number>, // Grid overrides for 2025
  ytd_settings: YTDSettings // Chart settings
}
```

#### MultiYearScenario

```typescript
{
  view_mode: 'Multi-Year',
  baseline_mode: '2024 Data' | '2025 Data' | 'Custom',
  baseline_date: string,
  scenario_data: {
    scenarioA: {
      future: FutureYear[], // Contains 2025-2030
      projection: Projection,
      selectedYear: number,
      dataMode: '2024 Data' | '2025 Data' | 'Custom'
    },
    scenarioB?: { ... }
  }
}
```

### New Modular Scenario Types

#### CurrentYearSettingsScenario

```typescript
{
  scenario_type: 'current_year',
  year_2025_data: Partial<FutureYear> & { year: 2025, physicians: Physician[] },
  custom_projected_values: Record<string, number> // Only '2025-*' keys
}
```

**Issue**: Field name `year_2025_data` is hardcoded

#### ProjectionScenario

```typescript
{
  scenario_type: 'projection',
  baseline_mode: '2024 Data' | '2025 Data' | 'Custom',
  baseline_years: FutureYear[] | null, // For 2024/Custom modes
  future_years: FutureYear[], // 2026-2030 only
  future_custom_values: Record<string, number> // Grid overrides for 2026-2030
}
```

### Key Observation

Scenarios are **tightly coupled to specific years**:
- Field names reference years: `year_2025_data`
- Comments specify year ranges: "2026-2030 only"
- Baseline modes are enum strings: `'2025 Data'`

---

## QuickBooks Sync Process

### Sync Endpoint Architecture

**File**: `/api/qbo/sync-2025.ts`

#### Year Dependencies

1. **~~Federal Holidays~~** (lines 23-35) - **WILL BE REMOVED**:
   ```typescript
   // Old approach (to be removed):
   const FEDERAL_HOLIDAYS_2025 = [
     '2025-01-01', // New Year's Day
     '2025-01-20', // Martin Luther King Jr. Day
     // ... 11 holidays hardcoded
   ]
   ```
   **New approach**: Remove entirely. Cron job runs M-F only (`*/30 * * * 1-5`), so no need to check holidays.

2. **Date Range Calculation** (lines 315-317):
   ```typescript
   // Old approach:
   const now = new Date()
   const year = now.getFullYear() // Dynamic, good!
   const start = `${year}-01-01`
   const end = getPriorBusinessDayEnd(now) // Uses federal holidays

   // New approach (simpler):
   const now = new Date()
   const year = now.getFullYear()
   const start = `${year}-01-01`
   const yesterday = new Date(now)
   yesterday.setDate(yesterday.getDate() - 1)
   const end = yesterday.toISOString().split('T')[0]
   ```
   **Win**: Removes holiday dependency, simpler logic

3. **Success Message** (line 489):
   ```typescript
   message: 'Successfully synced all 2025 data'
   ```
   **Issue**: Hardcoded message text

4. **Cache Structure** (lines 443-454):
   ```typescript
   await supabase.from('qbo_cache').upsert({
     id: 1, // Single row cache
     last_sync_timestamp: lastSyncTimestamp,
     daily: dailyData,
     summary: summaryData,
     equity: equityData,
     retirement_accounts: retirementAccounts,
     retirement_gl_data: retirementGLData,
   })
   ```
   **Issue**: Single row cache implies single year

### Data Retrieval

**File**: `/api/qbo/cached-2025.ts`

- Filename is year-specific
- Frontend calls `/api/qbo/cached-2025`
- Returns single cached record (id: 1)

### Frontend Integration

**File**: `/web/src/components/dashboard/views/detailed/utils/load2025Data.ts`

```typescript
export async function load2025Data(environment?: 'sandbox' | 'production'): Promise<Load2025Result> {
  const res = await authenticatedFetch('/api/qbo/cached-2025')
  // Parses 2025-specific data
}
```

### Sync Flow Summary

1. **Cron Job** → Calls `/api/qbo/sync-2025` (GET with auth header)
2. **Sync Endpoint** → Fetches QBO data for current year (dynamic) using 2025 federal holidays (static)
3. **Cache Table** → Stores in single row (id: 1) - **overwrites previous data**
4. **Frontend** → Calls `/api/qbo/cached-2025` to retrieve cached data
5. **Parser** → `load2025Data()` transforms into application format

### Migration Challenges

- **Endpoint URLs**: Need versioned or year-parameterized endpoints (backward compat wrappers solve this)
- ~~**Federal Holidays**: Need annual update or dynamic calculation~~ (REMOVED - cron handles weekday scheduling)
- **Cache Strategy**: Single-row cache can't handle multi-year history (solved with year-keyed table)
- **Frontend Callers**: All reference 2025-specific functions/endpoints (backward compat wrappers solve this)

---

## Recommended Approach: Phased Refactoring

### Phase 1: Foundation (Week 1-2)

**Goal**: Create year configuration infrastructure

#### 1.1 Create Year Configuration Module

**File**: `web/src/config/yearConfig.ts`

```typescript
// Centralized year configuration
export const YEAR_CONFIG = {
  // Dynamically calculated
  getCurrentYear: () => new Date().getFullYear(),

  // Admin configurable (stored in database)
  baselineYear: 2025,
  projectionYears: 5, // How many years to project forward

  // Historical data range
  historicalStartYear: 2016,

  // QBO sync configuration
  priorYearCutoffDate: (year: number) => `${year}-04-15`,
  usePriorYearQBOUntilCutoff: true
}

// Dynamic year calculations
export const getProjectionYearRange = () => {
  const baseline = YEAR_CONFIG.baselineYear
  return Array.from({ length: YEAR_CONFIG.projectionYears }, (_, i) => baseline + i + 1)
}

export const isCurrentYear = (year: number) => year === YEAR_CONFIG.baselineYear
export const isPriorYear = (year: number) => year === YEAR_CONFIG.baselineYear - 1
export const isProjectionYear = (year: number) => {
  const range = getProjectionYearRange()
  return year >= range[0] && year <= range[range.length - 1]
}
```

#### 1.2 Add Year Settings to Existing app_settings Table

**Database**: Use existing `app_settings` table (key-value JSONB pattern)

**Note**: The `app_settings` table already exists (see `supabase-app-settings-migration.sql`) and uses a key-value pattern with JSONB storage. We'll add new keys for year configuration.

```sql
-- Add year configuration to existing app_settings table
INSERT INTO app_settings (key, value, description) VALUES
  ('current_fiscal_year', '2025'::jsonb, 'Current baseline year for financial planning'),
  ('projection_years', '5'::jsonb, 'Number of years to project forward'),
  ('prior_year_marked_complete', 'false'::jsonb, 'Whether prior year data has been marked final by admin'),
  ('prior_year_cutoff_date', '"2025-04-15"'::jsonb, 'Date after which prior year uses snapshot instead of live QBO')
ON CONFLICT (key) DO NOTHING;
```

**Access Pattern** (use existing `settingsService.ts`):
```typescript
// web/src/services/settingsService.ts already exists with:
export async function getSetting(key: string): Promise<any>
export async function setSetting(key: string, value: any): Promise<void>

// Usage:
const baselineYear = await getSetting('current_fiscal_year') // returns 2025
await setSetting('current_fiscal_year', 2026) // updates to 2026
```

#### 1.3 Create Admin UI Component

**File**: `web/src/components/admin/YearSettingsPanel.tsx`

**Note**: Create as separate component rather than extending `admin/LoggingControlPanel.tsx` (better separation of concerns)

Features:
- View current baseline year
- Button to "Roll to Next Year" (with confirmation modal)
- Set projection window (3-10 years dropdown)
- Toggle "Prior year data complete" (switches historic column from QBO to snapshot)
- Shows current year's April 15th cutoff status
- Shows last QBO sync timestamp
- Manual sync trigger button (calls `/api/qbo/sync?year=YYYY`)

**Access Control**: Admin-only (check user role before rendering)

---

### Phase 2: QuickBooks Sync Refactoring (Week 2-3)

**Goal**: Year-agnostic sync with intelligent prior year handling

#### 2.1 Refactor Sync Endpoint

**Changes to**: `api/qbo/sync-2025.ts` → `api/qbo/sync.ts`

**Simplified Approach**: Remove federal holidays logic entirely - sync runs on weekdays (M-F) via cron, no need to check holidays.

```typescript
// Accept year parameter
export async function GET(request: Request) {
  const url = new URL(request.url)
  const targetYear = parseInt(url.searchParams.get('year') || getCurrentYear().toString())

  // Remove federal holidays check - cron runs M-F only
  // No need to calculate "prior business day" - just use yesterday

  const now = new Date()
  const start = `${targetYear}-01-01`
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const end = yesterday.toISOString().split('T')[0]

  // Fetch QBO data for target year
  const dailyData = await fetchDailyIncome(targetYear, start, end)
  const summaryData = await fetchSummaryData(targetYear)
  const equityData = await fetchEquityData(targetYear)
  const retirementAccounts = await fetchRetirementAccounts(targetYear)
  const retirementGLData = await fetchRetirementGLData(targetYear)

  // Store in year-specific cache
  await upsertYearCache(targetYear, {
    dailyData,
    summaryData,
    equityData,
    retirementAccounts,
    retirementGLData,
    lastSyncTimestamp: now.toISOString()
  })

  return Response.json({
    success: true,
    message: `Successfully synced all ${targetYear} data`,
    year: targetYear,
    timestamp: now.toISOString()
  })
}
```

**Backward Compatibility**: Keep `sync-2025.ts` as wrapper
```typescript
// api/qbo/sync-2025.ts (keep for cron job compatibility)
import { GET as syncGET } from './sync'

export async function GET(request: Request) {
  // Redirect to new endpoint with year=2025
  const url = new URL(request.url)
  url.searchParams.set('year', '2025')
  return syncGET(new Request(url, request))
}
```

**Cron Job Update**: Point to new generic endpoint
```bash
# Old cron: */30 * * * 1-5 curl https://api.radiantcare.com/api/qbo/sync-2025
# New cron: */30 * * * 1-5 curl https://api.radiantcare.com/api/qbo/sync?year=2025

# Note: Cron runs Mon-Fri (1-5) only, so no need for holiday checks
```

#### 2.2 Multi-Year Cache Strategy

**Database**: Update `qbo_cache` table

**Safe Migration Strategy** (avoids dropping PK on live table):

```sql
-- Step 1: Create new table with correct schema
CREATE TABLE qbo_cache_new (
  year INTEGER PRIMARY KEY,
  last_sync_timestamp TIMESTAMP,
  daily JSONB,
  summary JSONB,
  equity JSONB,
  retirement_accounts JSONB,
  retirement_gl_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Migrate existing data (assumes current cache is 2025)
INSERT INTO qbo_cache_new (year, last_sync_timestamp, daily, summary, equity, retirement_accounts, retirement_gl_data)
SELECT 2025, last_sync_timestamp, daily, summary, equity, retirement_accounts, retirement_gl_data
FROM qbo_cache
WHERE id = 1;

-- Step 3: Drop old table and rename new one
DROP TABLE qbo_cache;
ALTER TABLE qbo_cache_new RENAME TO qbo_cache;

-- Step 4: Create index for faster lookups
CREATE INDEX idx_qbo_cache_year ON qbo_cache(year);
```

**Alternative (if downtime acceptable)**:
```sql
-- Simpler approach if can afford brief downtime
ALTER TABLE qbo_cache ADD COLUMN year INTEGER;
UPDATE qbo_cache SET year = 2025 WHERE id = 1;
ALTER TABLE qbo_cache DROP CONSTRAINT qbo_cache_pkey;
ALTER TABLE qbo_cache DROP COLUMN id;
ALTER TABLE qbo_cache ADD PRIMARY KEY (year);
```

#### 2.3 Prior Year Historic Column Logic

**New behavior**:
- **Before April 15th**: Historic column pulls from QBO `/{year-1}/` data
- **After April 15th OR admin marks complete**: Historic column uses cached snapshot
- **Admin control**: "Mark [Year] Complete" button to override date check

**Implementation in**: `web/src/components/dashboard/views/detailed/components/YearlyDataGrid.tsx`

```typescript
const useHistoricYearData = () => {
  const priorYear = YEAR_CONFIG.baselineYear - 1
  const cutoffDate = new Date(YEAR_CONFIG.priorYearCutoffDate(YEAR_CONFIG.baselineYear))
  const today = new Date()

  const [adminSettings] = useAdminSettings()

  const usePriorYearQBO =
    today < cutoffDate &&
    !adminSettings.prior_year_marked_complete &&
    YEAR_CONFIG.usePriorYearQBOUntilCutoff

  return {
    year: priorYear,
    source: usePriorYearQBO ? 'qbo-live' : 'snapshot',
    data: usePriorYearQBO ? useQBOData(priorYear) : useHistoricSnapshot(priorYear)
  }
}
```

---

### Phase 3: Scenario Management Updates (Week 3-4)

**Goal**: Handle year transitions gracefully with user warnings

#### 3.1 Update Scenario Schema

**Database migration**:

```sql
-- Add year flexibility fields
ALTER TABLE scenarios ADD COLUMN baseline_year INTEGER DEFAULT 2025;
ALTER TABLE scenarios ADD COLUMN projection_year_range INTEGER[] DEFAULT ARRAY[2026,2027,2028,2029,2030];

-- Rename year-specific fields
ALTER TABLE scenarios RENAME COLUMN year_2025_data TO baseline_year_data;
```

#### 3.2 Scenario Type Updates

**File**: `web/src/components/dashboard/shared/types.ts`

```typescript
// Old: type BaselineMode = '2024 Data' | '2025 Data' | 'Custom'
// New:
type BaselineMode = 'Prior Year Data' | 'Current Year Data' | 'Custom'

interface Scenario {
  baseline_year: number // Instead of hardcoded 2025
  baseline_mode: BaselineMode
  baseline_year_data: FutureYear // Renamed from year_2025_data
  projection_years: number[] // Dynamic array instead of 2026-2030
}
```

#### 3.3 Year Transition Warning System

**User workflows**:

##### A. Current Year Scenarios (e.g., saved in 2025, now 2026)

**Warning Modal**: "This scenario was created for 2025. Would you like to:"
- ✅ **Apply to 2026** (migrate settings to new year)
- ⚠️ **View as-is** (read-only, shows 2025 data)
- 📋 **Duplicate for 2026** (copy and update)

**Implementation**: Check `scenario.baseline_year !== YEAR_CONFIG.baselineYear` on load

##### B. Projection Scenarios (e.g., projected 2026-2030, now in 2026)

**Warning Modal**: "This projection started in 2025. The projection window has shifted:"
- ✅ **Extend to 2031** (add one more year, propagate physicians)
- ⚠️ **View as-is** (shows 2025-2030, mark as historical)
- 🔄 **Recalculate from 2026** (rebase to current year)

**Implementation**: Check if `scenario.projection_years[0] <= YEAR_CONFIG.baselineYear`

---

### Phase 4: Core Calculation Refactoring (Week 4-5)

**Goal**: Remove hardcoded year conditionals

#### 4.1 Refactor defaults.ts

**Before**:
```typescript
export const HISTORIC_DATA = [
  { year: 2016, ... },
  // ...
  { year: 2025, ... }
]
```

**After**:
```typescript
// Load from database or config
export const getHistoricData = async (): Promise<HistoricYear[]> => {
  const data = await db.from('historic_years').select('*')
    .gte('year', YEAR_CONFIG.historicalStartYear)
    .lte('year', YEAR_CONFIG.baselineYear)
    .order('year')
  return data
}
```

#### 4.2 Social Security Wage Base Calculator

**Before**: Hardcoded object `{ 2025: 176100, 2026: 183600, ... }`

**After**:
```typescript
// Admin-configurable table OR extrapolation formula
export const getSocialSecurityWageBase = (year: number): number => {
  const knownBases = await db.from('ss_wage_bases').select('*')
  const known = knownBases.find(b => b.year === year)
  if (known) return known.amount

  // Extrapolate using historical growth rate (typically 3-4%)
  const latestYear = Math.max(...knownBases.map(b => b.year))
  const latestBase = knownBases.find(b => b.year === latestYear)!.amount
  const yearDiff = year - latestYear
  const growthRate = 0.04 // Configurable
  return Math.round(latestBase * Math.pow(1 + growthRate, yearDiff))
}
```

#### 4.3 Replace Year Conditionals

**Before**:
```typescript
if (year === 2026) { ... }
else if (year === 2027) { ... }
```

**After**:
```typescript
const yearOffset = year - YEAR_CONFIG.baselineYear
const defaults = getDefaultsForYearOffset(yearOffset)
```

---

### Phase 5: UI Component Updates (Week 5-6)

**Goal**: Dynamic year displays and controls

#### 5.1 Year Panel Generation

**File**: `web/src/components/dashboard/views/multi-year/MultiYearView.tsx`

**Replace**:
```typescript
// Old: Hardcoded tabs for 2025, 2026, 2027, 2028, 2029, 2030
const years = [2025, 2026, 2027, 2028, 2029, 2030]
```

**With**:
```typescript
const years = [
  YEAR_CONFIG.baselineYear,
  ...getProjectionYearRange()
]
```

#### 5.2 Chart Updates

**Files**: All chart builders

- Replace `year === 2025` checks with `isCurrentYear(year)`
- Replace year range filters with dynamic calculations
- Update tooltips to use "Baseline Year" instead of "2025"

#### 5.3 Help Documentation

**File**: `web/src/components/shared/ComprehensiveHelpGuide.tsx`

Replace hardcoded year references in text:
- "2025" → `{YEAR_CONFIG.baselineYear}`
- "2026-2030" → `{getProjectionYearRange()[0]}-{getProjectionYearRange().slice(-1)[0]}`

---

### Phase 6: Year Rollover Automation (Week 6-7)

**Goal**: Smooth annual transitions

#### 6.1 Year Rollover Script

**File**: `scripts/rollover-year.ts`

```typescript
// Run manually or on schedule (January 1st)
async function rolloverToNewYear() {
  const newYear = YEAR_CONFIG.baselineYear + 1

  // 1. Archive current baseline year to historic_years table
  await archiveBaselineYear()

  // 2. Update admin settings baseline year
  await db.from('admin_year_settings')
    .update({ baseline_year: newYear })
    .eq('id', 1)

  // 3. Shift QBO cache: current year becomes prior year
  // (Keep live QBO for new year until April 15th)

  // 4. Show warning banner to all users
  await db.from('system_notifications').insert({
    message: `New year activated! Please review your scenarios for ${newYear}.`,
    severity: 'info',
    expires_at: new Date(newYear, 0, 31) // Show through January
  })

  // 5. Email admin summary
  await sendAdminEmail({
    subject: `RadiantCare Year Rollover Complete: ${newYear}`,
    body: 'Review default scenarios and notify users.'
  })
}
```

#### 6.2 User Warning Banner

**File**: `web/src/components/shared/YearTransitionBanner.tsx`

Shows when:
- User logs in after year rollover
- User loads old scenario in new year

Message: "⚠️ RadiantCare is now showing {newYear} data. Your saved scenarios from {oldYear} may need updates. [Review Scenarios]"

---

## Implementation Priority

### Must-Have for Smooth Transitions (MVP)

1. ✅ **Year Configuration Module** (Phase 1.1) - 1 day
2. ✅ **Admin Year Settings Table & UI** (Phase 1.2-1.3) - 2 days
3. ✅ **Scenario Year Field Migration** (Phase 3.1) - 1 day
4. ✅ **Year Transition Warnings** (Phase 3.3) - 2 days
5. ✅ **Refactor defaults.ts** (Phase 4.1) - 3 days
6. ✅ **Update Year Conditionals** (Phase 4.3) - 2 days

**Total: ~11 days** - Gets you to a state where year transitions are manageable

### High Priority (Full Automation)

7. ✅ **QBO Sync Refactoring** (Phase 2) - 5 days
8. ✅ **Multi-Year Cache** (Phase 2.2) - 2 days
9. ✅ **Prior Year April 15th Logic** (Phase 2.3) - 2 days
10. ✅ **Year Rollover Script** (Phase 6.1) - 3 days

**Total: +12 days** - Enables automatic year transitions

### Nice-to-Have (Polish)

11. ⚡ **Dynamic Historic Data** (Phase 4.1) - 3 days
12. ⚡ **SS Wage Base Calculator** (Phase 4.2) - 2 days
13. ⚡ **Help Docs Dynamic Text** (Phase 5.3) - 1 day

**Total: +6 days**

---

## Critical Items from Critique Analysis

### 1. Share Links Backward Compatibility ✅ LOW RISK

**Current State**: Two types of share links exist:
1. **Database-stored links** (`shared_links` table): Reference scenario IDs, not year-encoded ✅ Safe - no changes needed
2. **URL hash links** (`#s=...`): Encode full store snapshots as compressed JSON

**URL Hash Link Structure** (Dashboard.tsx lines 4150-4194):
```typescript
// Encodes entire store snapshot including:
// - scenarioA.selectedYear: 2025
// - scenarioA.dataMode: '2025 Data'
// - scenarioA.future: FutureYear[] (contains years 2025-2030)
```

**Risk**: ✅ **LOW** - URL hash links decode and load into store, which will handle year migration via the warning modals already planned in Phase 3.3

**No Additional Work Needed**: Year transition warnings will catch these cases automatically.

### 2. HISTORIC_DATA Transition Automation

**Problem**: When 2026 becomes historic (in 2027), someone must:
1. Add 2026 to HISTORIC_DATA array in `defaults.ts`
2. Update all code that assumes last year
3. Ensure QBO data is properly archived

**Solution**: Add to Year Rollover Script (Phase 6.1)

```typescript
// scripts/rollover-year.ts
async function rolloverToNewYear() {
  const newYear = YEAR_CONFIG.baselineYear + 1
  const priorYear = YEAR_CONFIG.baselineYear

  // 1. Archive prior year QBO cache as historical snapshot
  const priorYearCache = await db.from('qbo_cache')
    .select('*')
    .eq('year', priorYear)
    .single()

  // 2. Add to historic_years table (if using DB approach)
  // OR update HISTORIC_DATA array in defaults.ts (if using code approach)

  // Option A: Update code (requires code deployment)
  // - Add new entry to HISTORIC_DATA array
  // - Update constants (ACTUAL_2025_* → ACTUAL_2026_*)
  // - Deploy code

  // Option B: Use database (recommended for full automation)
  await db.from('historic_years').insert({
    year: priorYear,
    data: priorYearCache // Snapshot of entire year
  })

  // 3. Update baseline year
  await setSetting('current_fiscal_year', newYear)

  // 4. Notify admin to review
  console.log(`✅ Rolled over from ${priorYear} to ${newYear}`)
  console.log(`⚠️  Admin: Please review default scenarios and physician rosters`)
}
```

**Manual Checklist** (for annual rollover):
- [ ] Run rollover script
- [ ] Verify prior year data is archived
- [ ] Update Social Security wage base for new year (in `defaults.ts` or admin UI)
- [ ] Review default physician rosters
- [ ] Test scenario loading with year transition warnings
- [ ] Update help documentation year references (if not using dynamic text)

### 3. Cron Job Update Procedure

**Current State**: Cron job likely configured as:
```bash
*/30 * * * 1-5 curl -H "Authorization: Bearer $TOKEN" https://api.radiantcare.com/api/qbo/sync-2025
```

**Migration Steps**:
1. **Phase 2.1**: Create new generic endpoint `/api/qbo/sync?year=YYYY`
2. **Backward Compat**: Keep `sync-2025.ts` as wrapper (redirects to generic endpoint)
3. **Cron Update** (can be done anytime, no rush):
   ```bash
   # New cron (preferred):
   */30 * * * 1-5 curl -H "Authorization: Bearer $TOKEN" https://api.radiantcare.com/api/qbo/sync?year=2025

   # OR keep old endpoint (will continue to work via wrapper)
   */30 * * * 1-5 curl -H "Authorization: Bearer $TOKEN" https://api.radiantcare.com/api/qbo/sync-2025
   ```
4. **Year Rollover**: Update cron year parameter:
   ```bash
   # January 2026:
   */30 * * * 1-5 curl -H "Authorization: Bearer $TOKEN" https://api.radiantcare.com/api/qbo/sync?year=2026
   ```

**Alternative**: Make cron fetch year from app_settings:
```bash
# Dynamic cron (requires API endpoint or helper script):
*/30 * * * 1-5 /path/to/sync-current-year.sh

# sync-current-year.sh:
#!/bin/bash
YEAR=$(curl -s https://api.radiantcare.com/api/app-settings/current_fiscal_year)
curl -H "Authorization: Bearer $TOKEN" https://api.radiantcare.com/api/qbo/sync?year=$YEAR
```

### 4. Testing Strategy for Time-Dependent Logic

**Challenge**: Can't wait until Jan 1 or April 15 to test rollover logic

**Solution**: Time-Travel Testing Utilities

**File**: `web/src/config/yearConfig.ts` (add to Phase 1.1)
```typescript
// Add override mechanism for testing
export const YEAR_CONFIG = {
  getCurrentYear: () => {
    // Check for test override
    const override = localStorage.getItem('TEST_CURRENT_YEAR')
    if (override) return parseInt(override)
    return new Date().getFullYear()
  },

  baselineYear: 2025, // Will be loaded from app_settings

  // Test helper
  setTestYear: (year: number) => {
    localStorage.setItem('TEST_CURRENT_YEAR', year.toString())
  },

  clearTestYear: () => {
    localStorage.removeItem('TEST_CURRENT_YEAR')
  }
}
```

**Test Scenarios**:

1. **Test Year Rollover (2025 → 2026)**:
   ```typescript
   // In browser console:
   YEAR_CONFIG.setTestYear(2026)
   await setSetting('current_fiscal_year', 2026)
   // Reload app
   // Verify: warning modals appear for old scenarios
   // Verify: projection windows update to 2027-2031
   YEAR_CONFIG.clearTestYear()
   ```

2. **Test Prior Year QBO Cutoff (April 15th)**:
   ```typescript
   // Mock current date in tests
   const mockDate = new Date('2026-04-14') // Before cutoff
   expect(usePriorYearQBO).toBe(true)

   const mockDate2 = new Date('2026-04-16') // After cutoff
   expect(usePriorYearQBO).toBe(false)
   ```

3. **Test Scenario Migration**:
   ```typescript
   // Load 2025 scenario in 2026
   const oldScenario = { baseline_year: 2025, ... }
   YEAR_CONFIG.setTestYear(2026)
   // Load scenario
   // Expect: warning modal with migration options
   ```

**Manual Testing Checklist**:
- [ ] Load 2025 current-year scenario in 2026 → verify warning modal
- [ ] Load 2025 projection scenario in 2026 → verify extension offer
- [ ] Toggle "Mark prior year complete" → verify historic column switches
- [ ] Test before/after April 15th cutoff → verify data source
- [ ] Roll to next year via admin UI → verify all updates
- [ ] Sync with `?year=2024` parameter → verify prior year cache updates

---

## Key Architectural Decisions

### 1. Baseline Year vs Current Calendar Year

- **Baseline Year**: Admin-controlled, represents the "current year" for planning
- **Calendar Year**: Auto-detected, may differ from baseline year
- **Decision**: Keep them separate. Admin clicks "Roll to 2026" when ready.

### 2. Prior Year QBO Data

- **Before April 15th**: Pull live QBO data for prior year (tax filing deadline)
- **After April 15th**: Use snapshot (data is final)
- **Admin Override**: "Mark {Year} Complete" button

### 3. Scenario Migration Strategy

- **Current Year Scenarios**: Warn user, offer to apply settings to new year
- **Projection Scenarios**: Automatically extend by one year, propagate physicians
- **No Auto-Migration**: Always ask user before modifying saved scenarios

### 4. Historical Data Storage

- **Option A**: Keep as code (faster, no DB calls)
- **Option B**: Move to database (flexible, supports dynamic additions)
- **Recommendation**: Start with Option A (add new year to array annually), move to Option B if pain point

### 5. Year Nomenclature Changes

**Backward Compatibility Required**: Existing scenarios have `baseline_mode: '2025 Data'` stored

**Migration Strategy**:
```typescript
// types.ts - Support both old and new values
type BaselineMode =
  | '2024 Data' | '2025 Data' | '2026 Data' // Legacy (still valid)
  | 'Prior Year Data' | 'Current Year Data' // New preferred values
  | 'Custom'

// Conversion helper
function normalizeBaselineMode(mode: BaselineMode, baselineYear: number): BaselineMode {
  // Convert old year-specific modes to generic
  if (mode === '2024 Data' || mode === '2025 Data' || mode === '2026 Data') {
    const yearMatch = mode.match(/(\d{4})/)
    if (yearMatch) {
      const modeYear = parseInt(yearMatch[1])
      if (modeYear === baselineYear) return 'Current Year Data'
      if (modeYear === baselineYear - 1) return 'Prior Year Data'
    }
  }
  return mode // Already normalized or Custom
}
```

**UI Display**:
- New scenarios: Show "Current Year Data", "Prior Year Data", "Custom"
- Old scenarios: Convert on load, preserve in DB until user saves

---

## Testing Strategy

### Test Scenarios

#### Manual Testing
1. **Load 2025 scenario in 2026**: Verify warning modal appears with migration options
2. **Load projection from 2025 in 2026**: Verify extension to 2031 with physician propagation
3. **QBO sync before April 15th**: Verify prior year pulls from QBO
4. **QBO sync after April 15th**: Verify prior year uses snapshot
5. **Admin marks prior year complete**: Verify immediate switch to snapshot
6. **Year rollover script**: Verify clean transition with no data loss

#### Automated Testing
```typescript
// Example test suite structure
describe('Year Configuration', () => {
  it('should calculate projection year range dynamically', () => {
    YEAR_CONFIG.baselineYear = 2025
    YEAR_CONFIG.projectionYears = 5
    expect(getProjectionYearRange()).toEqual([2026, 2027, 2028, 2029, 2030])
  })

  it('should detect when scenario is from prior year', () => {
    const scenario = { baseline_year: 2025 }
    YEAR_CONFIG.baselineYear = 2026
    expect(isScenarioOutdated(scenario)).toBe(true)
  })
})

describe('Scenario Migration', () => {
  it('should preserve physician data when migrating to new year', () => {
    const oldScenario = createMockScenario(2025)
    const migrated = migrateScenarioToYear(oldScenario, 2026)
    expect(migrated.baseline_year_data.physicians).toEqual(oldScenario.baseline_year_data.physicians)
  })
})

describe('QBO Sync', () => {
  it('should accept year parameter', async () => {
    const response = await fetch('/api/qbo/sync?year=2024')
    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data.year).toBe(2024)
  })

  it('should use current year if parameter missing', async () => {
    YEAR_CONFIG.baselineYear = 2026
    const response = await fetch('/api/qbo/sync')
    const data = await response.json()
    expect(data.year).toBe(2026)
  })
})
```

#### Integration Testing
- [ ] Full user flow: Admin rolls to 2026 → User sees banner → Loads old scenario → Migrates
- [ ] QBO sync writes to year-keyed cache → Frontend loads correct year
- [ ] Projection scenarios extend properly with physician propagation rules
- [ ] Share links (both types) work with year-agnostic system

---

## Risk Mitigation

### Breaking Changes

- ⚠️ **Database schema changes** - Requires migration for existing scenarios
- ⚠️ **Type changes** - May break frontend if not coordinated
- ⚠️ **QBO endpoint changes** - Requires updating cron jobs

### Rollback Plan

1. Tag codebase before Phase 1: `git tag pre-year-refactor`
2. Database migrations must be reversible (write `down` migrations)
3. Feature flag: `ENABLE_DYNAMIC_YEARS` in env to toggle new behavior

---

## Summary

### What This Achieves

✅ **Centralized year configuration** with admin controls
✅ **Year-agnostic QuickBooks sync** with multi-year cache
✅ **Intelligent prior year handling** (QBO until April 15th, then snapshot)
✅ **Scenario migration warnings** for year transitions
✅ **Dynamic projection windows** (configurable 3-10 years)
✅ **Automatic year rollover** with user notifications

### What Users Experience

- **Admin**: Clicks "Roll to 2026" on January 1st, reviews defaults
- **Users**: See warning banner, click to review scenarios
- **Current Year Scenarios**: Modal offers to apply settings to 2026
- **Projection Scenarios**: Automatically extend to 2031 with physician propagation
- **Historic Column**: Shows live QBO data until April 15th, then snapshot

### Timeline

- **MVP (manageable transitions)**: 11 days
- **Full automation**: 23 days
- **Complete with polish**: 29 days

---

## Next Steps

1. Review and approve this plan
2. Create feature branch: `feature/year-agnostic-refactoring`
3. Begin Phase 1: Year Configuration Module
4. Test each phase thoroughly before proceeding
5. Deploy with feature flag for gradual rollout

---

---

## Critique Analysis Summary

This plan incorporates feedback from the comparison analysis of three competing refactoring plans:

### Key Improvements from Critique:
1. ✅ **Use existing `app_settings` table** instead of creating new `admin_year_settings` table
2. ✅ **Simplified federal holidays approach** - removed entirely, cron runs M-F only
3. ✅ **Safe qbo_cache migration** - create new table, migrate, drop old (no PK drop on live table)
4. ✅ **Share links backward compatibility** - analysis shows low risk, covered by existing warning system
5. ✅ **HISTORIC_DATA transition automation** - added to rollover script with manual checklist
6. ✅ **Cron job update procedure** - documented with backward compat wrapper approach
7. ✅ **Testing strategy for time-dependent logic** - added time-travel utilities and test scenarios
8. ✅ **Backward compat for BaselineMode** - keep old values valid, convert on load

### Strengths Retained from Original Plan:
- Comprehensive current state analysis (38 files, accurate line numbers)
- Phased implementation with clear MVP vs full automation
- Realistic timeline estimates (11 days MVP, 23 days full automation)
- Risk mitigation strategies
- All scenario types correctly identified (including modular types)

### What Makes This Plan Best:
- Most accurate codebase analysis (verified file paths, line numbers, types)
- Addresses all critique points about missing pieces
- Practical solutions over theoretical complexity
- Clear prioritization and phasing

---

**Document Version**: 2.0
**Last Updated**: 2025-10-30 (Revised with critique feedback)
**Author**: Claude Code Analysis
**Status**: Ready for Implementation
