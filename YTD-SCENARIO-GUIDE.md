# YTD Scenario Structure Guide

## Overview

YTD scenarios capture a user's customized **2025 baseline configuration**, including physician settings, grid overrides, and chart display preferences. This allows users to:
- Tweak physician vacation time, salaries, bonuses, benefits
- Override specific 2025 grid cells (projected values)
- Save and share these customized baselines
- Compare different 2025 configurations side-by-side

---

## What Gets Saved in a YTD Scenario?

### 1. **Chart Display Settings** (`ytd_settings`)
Visual preferences for the YTD Detailed view:
```json
{
  "isNormalized": false,
  "smoothing": 10,
  "chartType": "line",
  "incomeMode": "total",
  "showTarget": true,
  "colorScheme": "radiantCare",
  // ... other chart config
}
```

### 2. **2025 Physician Settings** (`year_2025_data`)
Complete `FutureYear` object for 2025, including:
```typescript
{
  year: 2025,
  therapyIncome: number,
  nonEmploymentCosts: number,
  nonMdEmploymentCosts: number,
  locumCosts: number,
  miscEmploymentCosts: number,
  physicians: [
    {
      id: string,
      name: string,
      type: 'partner' | 'employee' | ...,
      salary: number,
      weeksVacation: number,
      receivesBenefits: boolean,
      receivesBonuses: boolean,
      bonusAmount: number,
      hasMedicalDirectorHours: boolean,
      medicalDirectorHoursPercentage: number,
      // ... all physician customizations
    }
  ]
}
```

### 3. **Grid Overrides** (`custom_projected_values`)
User's manual overrides for specific grid cells:
```typescript
{
  "2025-therapyIncome": 5000000,
  "2025-nonEmploymentCosts": 1200000,
  "2025-therapyLacey": 3000000,
  // ... any cell the user manually edited
}
```

### 4. **Metadata**
- `baseline_date` - When this baseline was captured (YYYY-MM-DD)
- `qbo_sync_timestamp` - When QuickBooks data was last synced
- `name`, `description`, `is_public` - Scenario identification

---

## What Doesn't Get Saved?

### ❌ Actual QuickBooks Financial Data
- Historical income/expense data
- P&L statement values
- Balance sheet data

**Why?** This data comes from QuickBooks and updates globally. Scenarios don't need to duplicate it—they just reference the sync timestamp.

### ❌ Future Years Beyond 2025
YTD scenarios only focus on the current year (2025). For multi-year projections, use Multi-Year scenarios.

---

## Use Cases

### 1. **Vacation Planning**
```
Scenario: "Summer Vacation - 3 Partners Out"
- Dr. Smith: 4 weeks vacation → increased locums
- Dr. Jones: 3 weeks vacation
- Dr. Wilson: 2 weeks vacation
- Locums costs: $150,000
```

### 2. **Compensation What-If**
```
Scenario: "Salary Increases Proposal"
- All employee physicians: +$50k salary
- Benefits costs: +10%
- Compare financial impact
```

### 3. **New Hire Planning**
```
Scenario: "Q3 New Physician"
- Add new employee physician
- Start date: July 1 (0.5 portion of year)
- Salary: $500k
- Receives benefits: Yes
- Signing bonus: $50k
```

### 4. **Site-Specific Planning**
```
Scenario: "Centralia Expansion"
- Override Centralia income: +20%
- Additional non-employment costs
- See impact on 2025 bottom line
```

---

## Loading a YTD Scenario

When you load a YTD scenario:

1. **Physician panel updates** with all saved physician configurations
2. **Grid cells update** to show your custom overrides (orange highlight)
3. **Chart settings restore** to your preferred display
4. **Other cells remain live** - they continue to use QBO data and projections

This gives you the best of both worlds:
- **Customizations are preserved** (your what-if scenarios)
- **Data stays fresh** (QBO data updates without resaving)

---

## Database Schema

### `scenarios` Table Columns (YTD-specific):

```sql
-- YTD Scenarios
view_mode TEXT = 'YTD Detailed'
ytd_settings JSONB              -- Chart display preferences
year_2025_data JSONB             -- FutureYear object with physicians
custom_projected_values JSONB   -- Grid cell overrides
baseline_date DATE               -- When baseline was captured
qbo_sync_timestamp TIMESTAMP     -- Last QBO sync

-- Not used for YTD (set to NULL)
scenario_data JSONB = NULL       -- Only for Multi-Year
baseline_mode TEXT = NULL        -- Only for Multi-Year
```

---

## Migration Steps

If you've already created YTD scenarios before this update:

1. **Run the migration:**
   ```sql
   -- In Supabase SQL Editor
   \i supabase-ytd-data-migration.sql
   ```

2. **Existing YTD scenarios will have:**
   - `year_2025_data = NULL` (no physician data yet)
   - `custom_projected_values = {}` (no overrides yet)

3. **To populate them:**
   - Load the old scenario
   - Make any adjustment (or just save as-is)
   - Save it again
   - It will now capture full 2025 customizations

---

## Comparison: YTD vs Multi-Year Scenarios

| Feature | YTD Scenario | Multi-Year Scenario |
|---------|-------------|---------------------|
| **Focus** | 2025 baseline only | Full multi-year projections |
| **Physicians** | 2025 only | All years (2025-2035) |
| **Grid Overrides** | 2025 cells only | All years |
| **Chart Settings** | YTD chart config | Not stored |
| **Projection Settings** | Not stored | Growth rates, global settings |
| **Scenario A/B** | Not stored | Complete state for comparison |
| **Use Case** | "What if I change 2025?" | "What's our 10-year outlook?" |
| **Size** | Lightweight (~5-10 KB) | Complete (~50-100 KB) |

---

## API Usage

### Saving a YTD Scenario:
```typescript
await store.saveScenarioToDatabase(
  name: "My Custom 2025",
  description: "Adjusted vacation + new hire",
  isPublic: false,
  viewMode: 'YTD Detailed',
  ytdSettings: { ... },
  onSuccess: () => console.log('Saved!')
)
```

### Loading a YTD Scenario:
```typescript
const data = await store.loadScenarioFromDatabase(id)
if (data.view_mode === 'YTD Detailed') {
  // Physicians and overrides are auto-restored
  // Chart settings available in data.ytd_settings
  onYtdSettingsChange(data.ytd_settings)
}
```

---

## FAQ

**Q: Do I need to re-sync QBO when loading a scenario?**
A: No! QBO data is global and always current. The scenario just restores your customizations on top of it.

**Q: What happens if I change a physician in a saved scenario after QBO data updates?**
A: Your physician changes are preserved. Financial calculations will use the new QBO data but with your customized physician settings.

**Q: Can I share a YTD scenario with someone?**
A: Yes! Mark it as `is_public = true`. When they load it, they'll see:
- Your exact physician configuration
- Your exact grid overrides
- Your chart display preferences
- Their own current QBO data

**Q: What if I want to compare two different 2025 baselines?**
A: Load one into the view, note the results, then load another. The YTD view is designed for single-baseline exploration. For side-by-side comparison, use Multi-Year scenarios with A/B comparison mode.

---

## Technical Notes

### Data Structure in Database:
```json
{
  "id": "uuid",
  "view_mode": "YTD Detailed",
  "ytd_settings": { ... },
  "year_2025_data": {
    "year": 2025,
    "physicians": [ ... ],
    "therapyIncome": 0,
    "locumCosts": 150000,
    ...
  },
  "custom_projected_values": {
    "2025-therapyIncome": 5000000,
    "2025-therapyLacey": 3000000
  },
  "baseline_date": "2025-10-08",
  "qbo_sync_timestamp": "2025-10-08T14:30:00Z"
}
```

### Size Estimates:
- Minimal YTD scenario: ~2 KB (no physicians, no overrides)
- Typical YTD scenario: ~5-10 KB (5-10 physicians, few overrides)
- Large YTD scenario: ~15-20 KB (many physicians, many overrides)

Much smaller than Multi-Year scenarios because it only stores 2025 customizations!
