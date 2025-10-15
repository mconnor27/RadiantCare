# Quick Reference - Modular Scenario System

## 🎯 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   MODULAR SCENARIO SYSTEM                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ⚙️  CURRENT YEAR SETTINGS          📊 PROJECTION           │
│  (2025 baseline customizations)    (Multi-year projections) │
│                                                               │
│  • Physician data for 2025         • Projection settings     │
│  • Grid overrides for 2025         • Years 2026-2035        │
│  • YTD settings (optional)         • Grid overrides (future) │
│  • QBO sync timestamp              • Baseline mode choice    │
│                                                               │
│  Can be loaded INDEPENDENTLY   │   Can be loaded ON TOP      │
│  Updates with fresh QBO data   │   Compositional loading     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Scenario Types at a Glance

| Type | Badge | When to Use | What It Saves |
|------|-------|-------------|---------------|
| ⚙️ **Current Year Settings** | Blue | Setting up 2025 baseline | 2025 physicians, grid overrides, YTD settings |
| 📊 **Projection** | Purple | Creating projections | Projection settings, 2026-2035, growth rates |
| 📊 **YTD View (Legacy)** | Gray | Old saved YTD scenarios | Complete 2025 snapshot |
| 📈 **Multi-Year (Legacy)** | Gray | Old saved multi-year scenarios | Complete multi-year snapshot |

---

## 💾 Save Options

### From YTD View
```
Always saves: Current Year Settings only
```

### From Multi-Year View (2025 Data baseline)
```
Options:
  ○ Current Year Settings only
  ○ Projection only  
  ○ Both (creates 2 scenarios)
```

### From Multi-Year View (2024/Custom baseline)
```
Options:
  ○ Projection only (includes baseline data)
```

---

## 📂 Loading Behavior

### Load Current Year Settings
```typescript
Replaces:
  ✓ 2025 physician data
  ✓ 2025 grid overrides
  ✓ YTD settings (if available)

Keeps:
  • Projection settings
  • Future years (2026-2035)
```

### Load Projection (2025 baseline)
```typescript
Replaces:
  ✓ Projection settings
  ✓ Years 2026-2035
  ✓ Future grid overrides

Keeps:
  • 2025 data (compositional!)
```

### Load Projection (2024/Custom baseline)
```typescript
Replaces:
  ✓ Baseline mode
  ✓ Baseline years
  ✓ Projection settings
  ✓ Years 2026-2035
```

---

## 🚦 Dirty Detection

### Current Year Settings Dirty When:
- 2025 physician data changed
- 2025 grid values overridden
- Different from loaded snapshot

### Projection Dirty When:
- Projection settings modified
- Future year data changed (2026-2035)
- Future grid values overridden

### Display:
```
Current Year Settings: My Baseline • Modified
Projection: Conservative Growth • Modified
```

---

## 🔄 Common Workflows

### Workflow 1: Single Baseline, Multiple Projections
```
1. Create 2025 baseline → Save as "Current Year A"
2. Create projection A → Save as "Optimistic"
3. Modify projection → Save as "Conservative"
4. Modify projection → Save as "Aggressive"

Result: 3 projections, 1 baseline
Can switch projections without changing baseline!
```

### Workflow 2: Compare Different Baselines
```
1. Create baseline A → Save as "Current QBO"
2. Create projection → Save as "Projection A"
3. Modify 2025 baseline → Save as "Adjusted QBO"
4. Load "Adjusted QBO" + "Projection A"

Result: Same projection on different baselines
```

### Workflow 3: Scenario A vs B
```
Scenario A:
  - Load "Current Year A"
  - Load "Projection Conservative"

Scenario B:
  - Enable Scenario B
  - Load "Projection Aggressive" (shares Current Year A!)
  
Result: Compare two projections with same baseline
```

---

## 🎮 UI Controls

### Save Button Location
- **YTD View:** Top control bar (💾 with document icon)
- **Multi-Year View:** Top control bar (💾 with document icon)

### Load Button Location
- **Both Views:** 📂 icon opens Scenario Manager

### Type Filter Location
- **Scenario Manager:** Dropdown at top of list
- Options: All Types | Current Year Settings | Projections | Legacy

### Dirty Indicators
- **Multi-Year View:** Shows in info panel below charts
- Format: `[Name] • Modified` (orange dot)

---

## 🗄️ Database Schema (New Columns)

```sql
ALTER TABLE scenarios ADD COLUMN:
  - scenario_type TEXT        -- 'current_year' | 'projection'
  - baseline_years JSONB      -- For 2024/Custom projections
  - projection_settings JSONB -- Projection config
  - future_years JSONB        -- Years 2026-2035
  - future_custom_values JSONB -- Grid overrides (future)
```

---

## 🔍 Type Guards (TypeScript)

```typescript
import { 
  isCurrentYearSettingsScenario, 
  isProjectionScenario,
  isYTDScenario,
  isMultiYearScenario
} from './types'

if (isCurrentYearSettingsScenario(scenario)) {
  // Handle Current Year Settings
}
if (isProjectionScenario(scenario)) {
  // Handle Projection
}
```

---

## 🎯 Store Methods (Quick Reference)

### Save
```typescript
await store.saveCurrentYearSettings(name, desc, isPublic, ytdSettings?)
await store.saveProjection(name, desc, isPublic, target?)
```

### Load
```typescript
await store.loadCurrentYearSettings(id)
await store.loadProjection(id, target?)
```

### Dirty Check
```typescript
const isDirty = store.isCurrentYearSettingsDirty()
const isDirty = store.isProjectionDirty()
```

### Reset
```typescript
store.resetCurrentYearSettings()
store.resetProjection()
```

### Update Snapshot (after save)
```typescript
store.updateCurrentYearSettingsSnapshot()
store.updateProjectionSnapshot()
```

---

## 🧪 Quick Test Commands

### Test Save
```typescript
// From browser console:
const store = useDashboardStore.getState()
await store.saveCurrentYearSettings('Test', 'Testing', false)
```

### Test Load
```typescript
const store = useDashboardStore.getState()
await store.loadCurrentYearSettings('[scenario-id]')
```

### Check Dirty State
```typescript
const store = useDashboardStore.getState()
console.log('Current Year Dirty:', store.isCurrentYearSettingsDirty())
console.log('Projection Dirty:', store.isProjectionDirty())
```

---

## 📋 Backend Checklist (Quick)

```bash
# 1. Run migration
psql -f supabase-modular-scenarios-migration.sql

# 2. Verify columns exist
\d+ scenarios

# 3. Test API
curl -X POST /api/scenarios -d '{"scenario_type":"current_year",...}'

# 4. Create defaults (via UI or SQL)
# 5. Test end-to-end
```

---

## 🐛 Troubleshooting

### "Scenario not loading"
- Check console for errors
- Verify scenario ID exists in database
- Check scenario_type matches expected type

### "Dirty indicator not clearing"
- Verify snapshot updated after save
- Check console logs for snapshot data
- Ensure load method called after save

### "Save button not showing options"
- Check baseline mode (2025 Data required for "Both")
- Verify in correct view mode
- Check if using legacy scenario

### "Type filter not working"
- Verify scenario_type column populated
- Check if scenarios are legacy (no scenario_type)
- Reload scenario list

---

## 📚 Documentation Index

| Need | See File |
|------|----------|
| Overview | `FRONTEND-COMPLETE-SUMMARY.md` |
| Technical Details | `MODULAR-SCENARIO-FRONTEND-COMPLETE.md` |
| Testing | `MODULAR-SCENARIO-TESTING-GUIDE.md` |
| Backend Tasks | `BACKEND-REQUIREMENTS-CHECKLIST.md` |
| Architecture | `MODULAR-SCENARIO-SUMMARY.md` |
| This Reference | `QUICK-REFERENCE-MODULAR-SCENARIOS.md` |

---

## ⚡ Pro Tips

1. **Always save Current Year Settings first** before creating projections
2. **Use descriptive names** - "2025 Base - High Revenue" vs "Scenario 1"
3. **Leverage composition** - One baseline, many projections
4. **Mark defaults as favorites** for auto-loading
5. **Filter by type** when scenario list grows large
6. **Watch dirty indicators** to know what changed
7. **Use Scenario B** for quick comparisons
8. **Test with legacy scenarios** to ensure compatibility

---

## 🎓 Key Concepts

### Modularity
Current Year Settings and Projections are separate entities that can be mixed and matched.

### Composition
Projections load "on top of" Current Year Settings without overwriting them.

### Independence
Each component has its own dirty tracking, reset, and save logic.

### Flexibility
Projections can use 2025, 2024, or Custom baselines as needed.

### Backward Compatibility
Legacy scenarios continue to work alongside new modular scenarios.

---

## 🚀 Getting Started (30 seconds)

```bash
1. Ensure backend migration ran
2. Open app
3. In YTD or Multi-Year view, click 💾
4. Save as "Test Current Year"
5. In Multi-Year view, modify projection
6. Click 💾 again
7. Save as "Test Projection"
8. Open Scenario Manager (📂)
9. See both scenarios with type badges
10. Load them to verify
```

---

## ✅ Success Indicators

You know it's working when:
- [x] Can save both scenario types
- [x] Type badges show correctly
- [x] Filter works in Scenario Manager
- [x] Loading projection doesn't overwrite 2025 data
- [x] Dirty indicators accurate
- [x] Can switch scenarios smoothly
- [x] No console errors

---

**Print this page and keep it handy! 📄**


