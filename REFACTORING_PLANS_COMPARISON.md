# Comparison of Year-Agnostic Refactoring Plans

## Executive Summary

This document compares three refactoring plans for making RadiantCare year-agnostic, analyzing their accuracy, completeness, and feasibility based on the actual codebase structure.

---

## Plan Comparison Matrix

| Aspect | Plan 1 (raw-yxfkdjyicu) | Plan 2 (raw-zcyfwkhihn) | Plan 3 (YEAR_AGNOSTIC_REFACTORING_PLAN.md) |
|--------|------------------------|------------------------|-------------------------------------------|
| **Accuracy** | ⚠️ Medium | ✅ High | ✅ Very High |
| **Completeness** | ⚠️ Medium | ✅ High | ✅ Very High |
| **Technical Detail** | ⚠️ Medium | ✅ High | ✅ Very High |
| **Feasibility** | ✅ High | ⚠️ Medium | ✅ High |
| **Phased Approach** | ❌ No | ⚠️ Partial | ✅ Yes |

---

## Detailed Analysis by Plan

### Plan 1: "Year-Agnostic Application Refactoring" (raw-yxfkdjyicu)

#### ✅ Strengths

1. **Correctly identifies core files**:
   - `Dashboard.tsx` - ✅ Actually has `selectedYear: 2025` (line 84)
   - `defaults.ts` - ✅ Correctly identifies `HISTORIC_DATA` array and hardcoded constants
   - `types.ts` - ✅ Correctly identifies `year_2025_data` field

2. **App_settings table exists**:
   - ✅ Confirmed: `app_settings` table already exists (see `supabase-app-settings-migration.sql`)
   - ✅ Confirmed: `settingsService.ts` exists with get/set functions

3. **Practical approach**:
   - ✅ Suggests renaming files (e.g., `load2025Data.ts` → `loadCurrentYearData.ts`)
   - ✅ Good backward compatibility strategy

#### ❌ Incorrect/Missing Items

1. **Database schema assumptions are WRONG**:
   ```typescript
   // Plan 1 says:
   "Add current_fiscal_year to app_settings table"
   
   // Reality: app_settings uses key-value JSONB:
   // Key: 'current_fiscal_year', Value: JSONB number
   // Migration is simpler than described
   ```

2. **Missing qbo_cache structure understanding**:
   ```typescript
   // Plan 1 doesn't mention:
   // - qbo_cache uses id: 1 (single row) - OVERWRITES data
   // - No year field currently exists
   // - Migration requires changing PRIMARY KEY (risky!)
   ```

3. **Incomplete scenario type coverage**:
   ```typescript
   // Plan 1 mentions YTDScenario and MultiYearScenario
   // Missing: CurrentYearSettingsScenario and ProjectionScenario (modular types)
   // These are ACTUALLY used in the codebase (see types.ts lines 185-227)
   ```

4. **Year calculation logic incorrect**:
   ```typescript
   // Plan 1 says:
   "getProjectionYears(): Array of 5 years starting from current year + 1"
   
   // Reality (from defaults.ts line 396):
   const startYear = HISTORIC_DATA[HISTORIC_DATA.length - 1].year + 1
   // This assumes HISTORIC_DATA.last.year = 2025, so projections start at 2026
   // But this is HARDCODED dependency on array length!
   ```

5. **Missing API endpoint details**:
   - Plan 1 doesn't mention `/api/qbo/sync-2025.ts` has hardcoded `FEDERAL_HOLIDAYS_2025` array
   - Doesn't account for cron job dependencies on endpoint name

#### ⚠️ Suboptimal Approaches

1. **Year transition warnings**:
   ```typescript
   // Plan 1 suggests:
   "Show warning modal when user loads scenario from prior year"
   
   // Problem: Doesn't specify WHEN to check (on app load? on scenario load?)
   // Plan 3 is clearer: "Detect rollover on app start"
   ```

2. **Prior year QBO logic**:
   ```typescript
   // Plan 1 says:
   "isPriorYearComplete(): Check if prior year is marked complete or after April 15th"
   
   // Missing: Admin override mechanism clearly described
   // Plan 3 provides clearer admin UI specs
   ```

---

### Plan 2: "Year-Agnostic Refactor and New-Year Rollover" (raw-zcyfwkhihn)

#### ✅ Strengths

1. **Excellent technical accuracy**:
   ```typescript
   // Plan 2 correctly identifies:
   // - YearService pattern (centralized logic)
   // - Backward compatibility wrapper endpoints
   // - Database migration strategy with backfill
   ```

2. **Database migration details**:
   ```sql
   -- Plan 2 correctly identifies:
   -- qbo_cache: add year column, change PK
   -- scenarios: add baseline_year, projection_horizon
   -- Both old and new fields coexist during migration
   ```

3. **Scenario API compatibility layer**:
   ```typescript
   // Plan 2 correctly suggests:
   "Server reads/writes both old and new shapes"
   // This is CRITICAL for backward compatibility
   ```

4. **Rollover flow specifics**:
   ```typescript
   // Plan 2 provides detailed physician propagation rules:
   // employee→employee, newEmployee→employee, etc.
   // This level of detail is missing from Plan 1
   ```

#### ❌ Incorrect/Missing Items

1. **Incorrect file path reference**:
   ```typescript
   // Plan 2 references:
   "/Users/Mike/.cursor/worktrees/RadiantCare/KKyOO/web/src/components/Dashboard.tsx"
   
   // This is a cursor worktree path, not the actual repo path
   // Should reference: /Users/Mike/RadiantCare/web/src/components/Dashboard.tsx
   ```

2. **Missing module structure understanding**:
   ```typescript
   // Plan 2 suggests:
   "Add web/src/services/yearService.ts"
   
   // Reality: Services are in web/src/services/ (exists)
   // But Plan 2 doesn't check if similar pattern exists
   // Actually: settingsService.ts exists, so pattern is correct
   ```

3. **Share links encoding incomplete**:
   ```typescript
   // Plan 2 says:
   "Share links: encode baselineYear and projectionHorizon"
   
   // Missing: WHERE are share links currently encoded?
   // Need to search codebase for shared-links implementation
   ```

4. **Federal holidays calculation**:
   ```typescript
   // Plan 2 says:
   "Generalize holidays and date windows to computed rules"
   
   // Problem: Federal holidays are NOT easily calculable
   // They follow complex rules (e.g., "3rd Monday of January")
   // Plan 3 correctly suggests "Fetch federal holidays dynamically" OR
   // "Admin-configurable table"
   ```

#### ⚠️ Suboptimal Approaches

1. **Missing phased implementation**:
   - Plan 2 lists all changes but doesn't prioritize
   - Plan 3 provides clear MVP vs Full Automation phases
   - Risk: Too much change at once could break production

2. **Rollover script location unclear**:
   ```typescript
   // Plan 2 says:
   "File: scripts/rollover-year.ts"
   
   // But doesn't specify:
   // - Run manually? Scheduled cron?
   // - Admin-only trigger?
   // - What happens if it fails mid-execution?
   ```

3. **Admin panel integration**:
   ```typescript
   // Plan 2 says:
   "Extend admin/LoggingControlPanel.tsx"
   
   // Reality: LoggingControlPanel.tsx exists and is admin-only
   // But adding year config there mixes concerns (logging vs year config)
   // Plan 1 suggests separate component (better separation)
   ```

---

### Plan 3: "YEAR_AGNOSTIC_REFACTORING_PLAN.md"

#### ✅ Strengths

1. **Comprehensive current state analysis**:
   ```typescript
   // Plan 3 accurately lists:
   // - 38 files with 2025 references ✅ (verified via grep)
   // - 11 files with 2026-2030 references ✅
   // - 2 API endpoints year-coupled ✅
   // - 10+ types affected ✅
   ```

2. **Correct file structure understanding**:
   ```typescript
   // Plan 3 correctly identifies:
   // - sync-2025.ts has FEDERAL_HOLIDAYS_2025 hardcoded (lines 23-35) ✅
   // - defaults.ts HISTORIC_DATA array (lines 6-20) ✅
   // - Dashboard.tsx selectedYear: 2025 (line 84) ✅
   ```

3. **Scenario type accuracy**:
   ```typescript
   // Plan 3 correctly identifies ALL scenario types:
   // - YTDScenario ✅
   // - MultiYearScenario ✅
   // - CurrentYearSettingsScenario ✅ (correctly identified!)
   // - ProjectionScenario ✅ (correctly identified!)
   ```

4. **QBO cache structure correctly analyzed**:
   ```typescript
   // Plan 3 correctly identifies:
   // - Single row cache (id: 1) ✅
   // - Overwrites previous data ✅
   // - Migration requires PK change ✅
   ```

5. **Phased approach with priorities**:
   ```typescript
   // Plan 3 provides:
   // - MVP: 11 days (manageable transitions)
   // - Full automation: 23 days
   // - Complete with polish: 29 days
   // This helps with planning and risk management
   ```

6. **Timeline estimates**:
   ```typescript
   // Plan 3 provides realistic estimates:
   // - Short-term fixes: 8-16 hours
   // - Medium-term refactoring: 40-80 hours
   // - Long-term architecture: 160-240 hours
   ```

#### ❌ Incorrect/Missing Items

1. **Database schema for admin_year_settings**:
   ```sql
   -- Plan 3 suggests:
   CREATE TABLE admin_year_settings (
     id INTEGER PRIMARY KEY DEFAULT 1,
     baseline_year INTEGER NOT NULL DEFAULT 2025,
     ...
   )
   
   -- Problem: Uses app_settings (key-value) OR separate table?
   -- Reality: app_settings already exists with key-value pattern
   -- Should use existing app_settings table instead of creating new table
   ```

2. **Historic data migration strategy unclear**:
   ```typescript
   // Plan 3 suggests:
   "Move to database (Option B) if pain point"
   
   // But doesn't specify:
   // - Migration script for existing HISTORIC_DATA
   // - How to handle static JSON files (2016-2024.json)
   // - Whether to keep both code and DB versions
   ```

3. **Share links migration not mentioned**:
   ```typescript
   // Plan 3 doesn't address:
   // - What happens to existing share links with year-encoded URLs?
   // - Do we need backward-compatible decoding?
   ```

#### ⚠️ Suboptimal Approaches

1. **Year configuration duplication**:
   ```typescript
   // Plan 3 suggests:
   // - YEAR_CONFIG module (code)
   // - admin_year_settings table (database)
   
   // Problem: Two sources of truth
   // Better: Use app_settings table as single source
   // Code reads from DB, falls back to system date
   ```

2. **Federal holidays solution vague**:
   ```typescript
   // Plan 3 says:
   "Fetch federal holidays dynamically"
   
   // But doesn't specify:
   // - Which API/library?
   // - Fallback strategy?
   // - Caching strategy?
   // Plan 2's "admin-configurable table" is more practical
   ```

---

## Critical Findings from Codebase Analysis

### 1. qbo_cache Table Structure

**Current State**:
```typescript
// api/qbo/sync-2025.ts line 443-454
await supabase.from('qbo_cache').upsert({
  id: 1, // Single row
  last_sync_timestamp: lastSyncTimestamp,
  daily: dailyData,
  summary: summaryData,
  // ...
})
```

**All Plans Get This Right** ✅:
- All recognize single-row cache (id: 1)
- All suggest adding `year` column
- Plan 2 and Plan 3 correctly identify PK change required

**Risk**: Changing PRIMARY KEY on live table is risky. Plan 3's migration strategy is safer:
```sql
-- Better approach (Plan 3):
ALTER TABLE qbo_cache ADD COLUMN year INTEGER;
UPDATE qbo_cache SET year = 2025 WHERE year IS NULL;
-- Then create new table, migrate, drop old
```

### 2. Scenario Schema Evolution

**Current State**:
```typescript
// types.ts shows modular types exist:
type CurrentYearSettingsScenario = {
  year_2025_data: Partial<FutureYear> & { year: number, physicians: Physician[] }
  // ...
}
type ProjectionScenario = {
  future_years: FutureYear[] // 2026-2030 only
  // ...
}
```

**Plan 1**: ❌ Doesn't mention modular types
**Plan 2**: ✅ Mentions both old and new shapes
**Plan 3**: ✅ Correctly identifies all 4 scenario types

**Critical Issue**: Field name `year_2025_data` is hardcoded in database schema. Plans 1 and 3 suggest keeping field name for backward compat (correct), but Plan 2 suggests renaming immediately (risky).

### 3. Baseline Mode Type

**Current State**:
```typescript
// types.ts line 124
export type BaselineMode = '2024 Data' | '2025 Data' | 'Custom'
```

**Plan 1**: ✅ Suggests: `'Prior Year Data' | 'Current Year Data' | 'Custom'`
**Plan 2**: ✅ Suggests: `'current-year' | 'prior-year' | 'custom'`
**Plan 3**: ✅ Suggests: `'Prior Year Data' | 'Current Year Data' | 'Custom'`

**All Plans Recognize**: Need to change type, but keep backward compatibility.

**Winner**: Plan 1 & 3's approach (keep '2024 Data'/'2025 Data' as valid values, add new ones) is safer than Plan 2's enum change.

### 4. Federal Holidays

**Current State**:
```typescript
// sync-2025.ts lines 23-35
const FEDERAL_HOLIDAYS_2025 = [
  '2025-01-01', // New Year's Day
  '2025-01-20', // Martin Luther King Jr. Day
  // ... 11 holidays hardcoded
]
```

**Plan 1**: ❌ Doesn't mention federal holidays
**Plan 2**: ⚠️ Says "computed rules" (unrealistic - holidays are complex)
**Plan 3**: ✅ Suggests "admin-configurable table OR fetch dynamically"

**Reality**: Federal holidays follow complex rules:
- MLK Day: 3rd Monday of January
- Presidents Day: 3rd Monday of February
- Memorial Day: Last Monday of May
- Thanksgiving: 4th Thursday of November

**Best Solution**: Admin-configurable table with UI to add/edit holidays per year. Fallback to hardcoded 2025 list if not configured.

### 5. INITIAL_FUTURE_YEARS_A Hardcoded Dependency

**Current State**:
```typescript
// defaults.ts lines 395-409
export function getFutureYearsBase(): Omit<FutureYear, 'physicians'>[] {
  return Array.from({ length: 5 }).map((_, idx) => {
    const startYear = HISTORIC_DATA[HISTORIC_DATA.length - 1].year + 1
    // Assumes HISTORIC_DATA[HISTORIC_DATA.length - 1].year = 2025
    const year = startYear + idx
  })
}
```

**All Plans Recognize**: This is a problem ✅

**Plan 1**: ⚠️ Says "use dynamic projection years" but doesn't specify how
**Plan 2**: ✅ Suggests `getProjectionHorizon()` from yearService
**Plan 3**: ✅ Suggests `getProjectionYearRange()` from YEAR_CONFIG

**Issue**: `HISTORIC_DATA` is a hardcoded array. When 2026 becomes historic, someone must manually add it to the array. Plans don't address this transition clearly.

---

## Recommendations

### Best Overall Plan: **Plan 3** (YEAR_AGNOSTIC_REFACTORING_PLAN.md)

**Why**:
1. ✅ Most comprehensive current state analysis
2. ✅ Correctly identifies all scenario types
3. ✅ Phased approach with clear priorities
4. ✅ Realistic timeline estimates
5. ✅ Risk mitigation strategies

**Improvements Needed**:
1. Use existing `app_settings` table instead of creating `admin_year_settings`
2. Specify federal holidays solution (admin table + UI)
3. Address share links backward compatibility
4. Clarify HISTORIC_DATA migration strategy

### Use Plan 2 for Technical Details

**Why**:
1. ✅ Best database migration specifics
2. ✅ Best backward compatibility strategy
3. ✅ Detailed physician propagation rules

**Improvements Needed**:
1. Add phased implementation approach
2. Fix file path references
3. Clarify federal holidays solution

### Use Plan 1 for Simple Starting Point

**Why**:
1. ✅ Simplest to understand
2. ✅ Good for quick wins

**Improvements Needed**:
1. Add modular scenario type coverage
2. Add qbo_cache migration details
3. Add federal holidays handling

---

## Critical Missing Pieces (All Plans)

### 1. Share Links Compatibility ✅ RESOLVED

**Current State**: TWO types of share links exist:
1. **Database-stored links** (`shared_links` table): Reference scenario IDs, not year-encoded ✅ Safe
2. **URL hash links** (`#s=...`): Encode full store snapshots as compressed JSON

**URL Hash Link Structure** (Dashboard.tsx lines 4150-4194):
```typescript
// Encodes entire store snapshot including:
// - scenarioA.selectedYear: 2025
// - scenarioA.dataMode: '2025 Data'
// - scenarioA.future: FutureYear[] (contains years 2025-2030)
// - ytdData: { year: 2025, ... }
```

**Risk**: ✅ **LOW** - URL hash links decode and load into store, which will handle year migration on load
**Solution Needed**: Store snapshot loader should detect year mismatch and trigger migration warnings (already planned in all 3 plans)

### 2. HISTORIC_DATA Transition Strategy

**Problem**: When 2026 becomes historic, someone must:
1. Add 2026 to HISTORIC_DATA array
2. Update all code that assumes last year = 2025
3. Ensure QBO data is archived

**Missing**: Automated or documented manual process

### 3. Cron Job Updates

**Current State**: Cron likely calls `/api/qbo/sync-2025`
**Risk**: If endpoint renamed, cron breaks
**Solution**: All plans mention backward compat, but need explicit cron update steps

### 4. Testing Strategy

**Plan 3 mentions**: "Test scenarios" but doesn't specify:
- How to test year rollover without waiting until Jan 1
- How to test prior year QBO switch on April 15
- How to test scenario migration

**Solution Needed**: Time-travel testing utilities or manual date override

---

## Implementation Priority (Combined from All Plans)

### Phase 1: Foundation (Week 1-2) - MVP
1. ✅ Create year service/utilities (Plan 2/3)
2. ✅ Add `current_fiscal_year` to `app_settings` (All plans)
3. ✅ Update `Dashboard.tsx` initial state (Plan 1/3)
4. ✅ Update `defaults.ts` to use dynamic years (Plan 3)

### Phase 2: QuickBooks Sync (Week 2-3)
1. ✅ Refactor sync endpoint (Plan 2/3)
2. ✅ Multi-year cache migration (Plan 2/3)
3. ✅ Federal holidays admin table (Plan 3 improved)

### Phase 3: Scenarios (Week 3-4)
1. ✅ Add `baseline_year` to scenarios (Plan 2/3)
2. ✅ Migration warnings (Plan 1/3)
3. ✅ Backward compatibility layer (Plan 2)

### Phase 4: UI Updates (Week 4-5)
1. ✅ Dynamic year panels (Plan 1/3)
2. ✅ Year transition warnings (Plan 1/3)
3. ✅ Admin year config UI (Plan 1/3)

### Phase 5: Rollover Automation (Week 5-6)
1. ✅ Rollover script (Plan 2/3)
2. ✅ User notifications (Plan 3)
3. ✅ Archive prior year (Plan 3)

---

## Conclusion

**Best Approach**: Use **Plan 3 as primary**, supplemented with:
- **Plan 2's** database migration details and backward compatibility strategy
- **Plan 1's** simple file renaming approach

**Critical Missing**: All plans need to address:
1. Share links backward compatibility
2. HISTORIC_DATA transition automation
3. Testing strategies for time-dependent logic
4. Cron job update procedures

**Estimated Total Effort**: 23-29 days (per Plan 3) for full automation, with MVP achievable in 11 days.

