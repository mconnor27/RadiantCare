# Scenario Metadata & Tagging System

## Overview

Scenarios are now automatically tagged and organized based on their type and baseline data, making it easy to understand what each scenario represents and when it was created.

## Scenario Types

### 📅 Historical Analysis (Purple)
- **Baseline**: 2024 Data
- **Use Case**: "What if we had done X strategy in 2024"
- **Contains**: Multi-year projections based on 2024 data
- **Does NOT use**: Any 2025 YTD data

### 📊 YTD Analysis (Blue)
- **Baseline**: 2025 Data (synced from QuickBooks)
- **View**: YTD Detailed
- **Use Case**: "Here's our current year compensation reality"
- **Contains**: Current year grid, custom values, may include future projections

### 📈 Forward Projection (Green)
- **Baseline**: 2025 Data (synced from QuickBooks)
- **View**: Multi-Year
- **Use Case**: "Based on current trajectory, here's 2026-2030"
- **Contains**: Future year projections based on current 2025 reality

## Metadata Captured

When you save a scenario, the system automatically captures:

1. **scenario_type** - Determined by:
   - `2024 Data` baseline → Historical Analysis
   - `2025 Data` + YTD Detailed view → YTD Analysis
   - `2025 Data` + Multi-Year view → Forward Projection

2. **baseline_mode** - The data mode: `2024 Data`, `2025 Data`, or `Custom`

3. **baseline_date** - ISO date (YYYY-MM-DD):
   - For 2024 baseline: `2024-12-31`
   - For 2025 baseline: Current date when saved

4. **qbo_sync_timestamp** - When QuickBooks was last synced (for 2025 scenarios only)

## Scenario Card Display

Each scenario card now shows:

```
┌─────────────────────────────────────────────────┐
│ Q3 Conservative Projection          🔒 Private  │
│ 📊 YTD Analysis • 2025 Data (Oct 7, 2025)      │
│ ⚠️ Baseline is 14 days old • Consider updating  │
│ Last edited: 2 hours ago • by user@example.com │
│                                                 │
│ Description of the scenario...                  │
│                                                 │
│ [Load] [Clone] [Edit] [Delete]                 │
└─────────────────────────────────────────────────┘
```

### Staleness Warnings

For scenarios using 2025 Data, the system:
- Tracks how old the baseline is
- Shows warning if > 7 days old
- Suggests updating to latest data

## Database Migration

Run this SQL in your Supabase SQL Editor after deployment:

```sql
-- See supabase-scenario-metadata-migration.sql
```

The migration adds these columns to the `scenarios` table:
- `scenario_type TEXT`
- `baseline_mode TEXT`
- `baseline_date TEXT`
- `qbo_sync_timestamp TIMESTAMPTZ`

## Benefits

✅ **Self-documenting** - Users immediately see what kind of scenario it is  
✅ **Versioning** - Track when baseline data was captured  
✅ **Freshness** - Know if 2025 data is stale  
✅ **Organization** - Filter and sort by scenario type  
✅ **Shareability** - Recipients understand the scenario context  

## Future Enhancements (Coming Next)

- Filtering by scenario type
- "Update to Latest 2025 Data" button for stale scenarios
- Baseline versioning (keep old versions when updating)
