# Year Rollover Quick Reference Guide

## For Administrators: How to Roll to a New Year

---

## 🗓️ When to Roll Over

**Recommended**: January 1st of the new year (or first business day)

**Before Rolling Over**:
- Ensure prior year QBO data is complete
- Review and finalize any open scenarios from prior year
- Back up database (optional but recommended)

---

## 🚀 Step-by-Step Rollover Process

### 1. Access Admin Panel
- Log in as admin user
- Navigate to **Year Settings** panel (in admin section)

### 2. Review Current Configuration
You'll see:
- **Current Baseline Year**: 2025 (example)
- **Projection Window**: 2026-2030 (example)
- **Prior Year Status**: Whether 2024 data is marked complete

### 3. Roll to Next Year
1. Click **"Roll to 2026"** button
2. Review confirmation modal:
   - Updates baseline year to 2026
   - Updates projection window to 2027-2031
   - Resets prior year completion flag
   - Reloads application
3. Click **"Yes, Roll Over"**
4. Wait for page to reload (2 seconds)

### 4. Verify Rollover Success
After reload, check:
- **Current Baseline Year**: Now shows 2026
- **Projection Years**: Now shows 2027-2031
- **Prior Year (2025)**: Status shows "Live QBO Data" (before April 15th)

---

## ⚙️ Post-Rollover Configuration

### Update Social Security Wage Base (If Needed)

If the new projection year (e.g., 2031) doesn't have a wage base defined:

1. **Option A**: Wait for auto-extrapolation (system uses 4% growth)
2. **Option B**: Contact developer to add actual IRS-published value

### Review Default Physician Rosters

Default physician rosters for 2027-2031 are pre-configured based on:
- Current partners
- Expected promotions (employee → partner transitions)
- Expected retirements

**To update**:
1. Load scenarios and adjust physicians as needed
2. Save as new default scenarios
3. Or contact developer to update `scenarioADefaultsByYear()` function

### Mark Prior Year Complete (After Tax Filing)

After April 15th (or when prior year data is final):

1. Go to **Year Settings** panel
2. Under **Prior Year (2025) Data Status**
3. Click **"Mark 2025 Complete"**
4. Historic column will switch from live QBO to snapshot

---

## 📊 What Changes After Rollover

### For Admin:
- Baseline year changes from 2025 → 2026
- Projection years shift forward: 2026-2030 → 2027-2031
- Prior year data (2025) pulls from live QBO until April 15th

### For Users:
- **Warning banner appears**: "RadiantCare is now showing 2026 data"
- Old scenarios show migration options (if implemented)
- Current year scenarios can have settings applied to 2026
- Projection scenarios automatically extend to 2031

### Behind the Scenes:
- `current_fiscal_year` setting updated in database
- `prior_year_cutoff_date` updated to 2026-04-15
- `prior_year_marked_complete` reset to false
- YEAR_CONFIG.baselineYear updates to 2026
- All dynamic year calculations use new baseline

---

## 🔄 Cron Job Updates (Optional)

The QBO sync cron job will continue to work with the old endpoint:
```bash
*/30 * * * 1-5 curl https://api.radiantcare.com/api/qbo/sync-2025
```

**To update to generic endpoint** (optional):
```bash
*/30 * * * 1-5 curl https://api.radiantcare.com/api/qbo/sync?year=2026
```

Or use dynamic helper script:
```bash
*/30 * * * 1-5 /path/to/sync-current-year.sh
```

---

## 🐛 Troubleshooting

### Problem: Rollover button doesn't work
**Solution**: Check that you're logged in as admin user (`is_admin = true` in profiles table)

### Problem: Page doesn't reload after rollover
**Solution**: Manually refresh the page (F5 or Cmd+R)

### Problem: Projection years still show old range
**Solution**:
1. Clear browser cache
2. Hard reload (Ctrl+Shift+R or Cmd+Shift+R)
3. Check `projection_years` setting in app_settings table

### Problem: Old scenarios won't load
**Solution**: This is expected - scenarios from prior years are read-only or require migration

### Problem: QBO sync fails after rollover
**Solution**:
1. Check that QBO token is valid
2. Try manual sync from Year Settings panel
3. Check cron logs in `cron_logs` table

---

## 📞 Need Help?

Contact: [Your Developer Contact Info]

Or check these resources:
- `YEAR_AGNOSTIC_REFACTORING_PLAN.md` - Full technical documentation
- `IMPLEMENTATION_PROGRESS.md` - Implementation status
- `DevNotes/sql-migrations/` - Database migration scripts

---

## 🔐 Admin Checklist (Annual)

**Before Rollover**:
- [ ] Back up database
- [ ] Verify prior year QBO data is complete
- [ ] Save any important scenarios

**During Rollover**:
- [ ] Click "Roll to [Next Year]"
- [ ] Confirm in modal
- [ ] Wait for page reload

**After Rollover**:
- [ ] Verify baseline year updated
- [ ] Verify projection years shifted
- [ ] Test QBO sync (manual trigger)
- [ ] Review default physician rosters
- [ ] Notify users of new year

**By April 15th**:
- [ ] Review prior year data
- [ ] Click "Mark [Prior Year] Complete" when final
- [ ] Verify historic column switches to snapshot

**By End of January**:
- [ ] Update Social Security wage base if needed (contact dev)
- [ ] Update default scenarios if needed
- [ ] Review any user-reported issues

---

**Last Updated**: 2025-10-30
**Version**: 1.0
