# RadiantCare Compensation & Projection Dashboard

A React + TypeScript single-page app for modeling multi-year practice finances and partner compensation. It combines historic actuals with forward-looking scenarios to explore income, costs, staffing, and per-physician outcomes. Built with Vite, Zustand state management, Plotly charts, and @dnd-kit sortable lists.

## Quick start

```bash
# From /Users/Mike/RadiantCare/web
npm install
npm run dev
# open the printed localhost URL
```

Build/preview:
```bash
npm run build
npm run preview
```

## High-level concepts

- **Historic actuals (2016–2025)**: Stored in code and shown in charts. Through 2023, `therapyIncome` includes total income; in 2024+ Medical Director income is modeled separately.
- **Future years (2026–2030 by default)**: Editable per-scenario projections with sliders and per-physician configuration.
- **Scenarios A and B**: Toggle a second scenario to compare settings and outcomes in charts/tables.
- **Baseline data modes for 2025**: Choose "2024 Data", "2025 Data", or "Custom" for the baseline year. Switching modes recalculates projections.
- **Partner pool**: Net income available to distribute to partners after expenses, staffing, buyouts, and adjustments (e.g., delayed W‑2), with Medical Director income allocated by configured percentages.

## App structure

- `src/main.tsx`: App bootstrap.
- `src/App.tsx`: Renders the `Dashboard`.
- `src/components/Dashboard.tsx`: Core store, computations, and top-level layout for the dashboard. Exposes:
  - `useDashboardStore`: Zustand store for historic data, scenarios, and actions (setters, resets, projections, reordering physicians, etc.).
  - `getTotalIncome(yearLike)`: Total income helper (handles historic vs. future structure).
  - `computeAllCompensationsForYear(year, scenario)`: Calculates per-physician partner compensation for a given year and scenario, including buyouts and delayed W‑2 handling for mixed roles.
  - `NET_PARTNER_POOL_2025`: Constant baseline partner pool for 2025.
- `src/components/dashboard/YearPanel.tsx`: Year-specific controls and inputs.
  - Income inputs: Therapy Income (with reset-to-projection shortcut and tooltip notes).
  - Medical Director Hours: Shared and PRCS overrides, reset buttons, explanations.
  - Cost inputs: Non‑Employment, Staff Employment, Misc Employment; each has sliders, numeric boxes, tooltips, and reset-to-projection.
  - Physicians section via `PhysiciansEditor` including locums costs.
  - Partner Compensation summary for the selected year (shows delayed W‑2 when applicable).
- `src/components/dashboard/ProjectionSettingsControls.tsx`: Scenario-level controls for growth rates and annual overrides.
  - Sliders for: income growth, non‑employment costs growth, staff employment costs growth, benefit costs growth, misc growth.
  - Annual overrides: Shared/PRCS Medical Director amounts and Locums costs.
  - Reset buttons restore defaults derived from historic trends.
- `src/components/dashboard/OverallCompensationSummary.tsx`:
  - Multi-year Plotly chart of per-physician compensation across years for scenario(s).
  - Per-Physician tables by year, totals, and Locums lines; supports hover highlight and isolate for easier comparison, synchronized across tables.
- `src/components/dashboard/HistoricAndProjectionChart.tsx`: Plotly chart comparing historic totals vs. projections for income, costs, employment, and net.
- `src/components/dashboard/ParametersSummary.tsx`: Compact tables summarizing core per-year values and physician line-up across years for each scenario, including a baseline column when applicable.
- `src/components/dashboard/PhysiciansEditor.tsx`: Editor for per-year physician roster and parameters.
  - Integrates drag-and-drop ordering with `DragDropPhysicians`.
  - Supports physician types: `partner`, `employee`, `employeeToPartner`, `partnerToRetire`, `newEmployee`, `employeeToTerminate`.
  - Handles salary, vacation weeks, benefits/bonuses flags, buyout costs, Medical Director split percentages, PRCS director assignment, bonus amounts, and trailing shared MD amounts for prior-year retirees.
- `src/components/dashboard/DragDropPhysicians.tsx`: Sortable list built on @dnd-kit.
  - Drag handle activation via `[data-drag-handle]` to avoid accidental drags.
  - Maintains smooth interim ordering while dragging; calls `onReorder(from, to)` on drop.
- `src/components/dashboard/calculations.ts`: Finance math and helpers.
  - `calculateEmployerPayrollTaxes`, benefit growth modeling, default staffing costs.
  - Mixed-role math for employee/partner portions, delayed W‑2 calculations with pay period calendar, and detailed employee cost tooltip generation.
  - `calculateProjectedValue` derives projected numbers from baseline and growth rates for income and cost categories.
- `src/components/dashboard/defaults.ts`: Historic dataset, constants, defaults, and per-year physician defaults for scenarios.
- `src/components/dashboard/types.ts`: All shared types: `YearRow`, `Physician`, `FutureYear`, `Projection`, `ScenarioState`, store signatures.
- `src/components/dashboard/utils.ts`: Formatting, date/portion converters, name abbreviation, and scheduling helpers.
- `src/components/dashboard/hooks.ts`: `useIsMobile` for responsive behavior.
- `src/components/dashboard/tooltips.ts`: Lightweight DOM tooltips for info and interactive sliders (bonus amount, shared MD %, PRCS amount, trailing MD amount), mobile-friendly behavior.

## Data model overview

- `YearRow` (historic): `{ year, therapyIncome, nonEmploymentCosts, employeePayroll? }`.
- `FutureYear` (projections): `{ year, therapyIncome, nonEmploymentCosts, nonMdEmploymentCosts, locumCosts, miscEmploymentCosts, medicalDirectorHours?, prcsMedicalDirectorHours?, prcsDirectorPhysicianId?, physicians: Physician[] }`.
- `Projection`: global per-scenario growth rates and annual overrides.
- `Physician` fields (selected): `type`, `salary`, `weeksVacation`, `employeePortionOfYear`, `partnerPortionOfYear`, `startPortionOfYear`, `terminatePortionOfYear`, `receivesBenefits`, `receivesBonuses`, `bonusAmount`, `hasMedicalDirectorHours`, `medicalDirectorHoursPercentage`, `buyoutCost`, `trailingSharedMdAmount`.

## How it works (flow)

1. Store initializes historic actuals and default future years for Scenario A; Scenario B can be enabled to clone structure with different defaults.
2. In 2025, choose a baseline mode:
   - 2024 Data: uses 2024 actuals to seed 2025.
   - 2025 Data: uses 2025 actuals to seed 2025.
   - Custom: fully editable 2025 values.
3. Projection growth rates are applied from the selected 2025 baseline to future years for income and cost categories. You can override any year’s values directly; reset buttons snap back to the model.
4. Per-year physician rosters are configurable by scenario/year. Mixed types (e.g., employeeToPartner) use date-portion math and include delayed W‑2 handling. Buyouts reduce the partner pool. Shared and PRCS Medical Director amounts are allocated per configured percentages and assignment.
5. Charts and summaries update reactively:
   - Historic and Projected Totals compares income, costs, employment, and net, with 2025 markers aligned to baseline.
   - Multi-Year Compensation renders per-physician and locums across years, with isolate/highlight interactions.
   - Parameters Summary tables provide a compact cross-year readout of the core numbers and roster.

## Key interactions & tips

- Click small ↺ buttons to reset a field to its projection/default.
- Use info "ℹ" icons for definitions and assumptions per control.
- In compensation tables, hover to highlight a physician; click to isolate. With Scenario B enabled, isolation links both scenarios by physician name.
- In `PhysiciansEditor`, use drag handles to reorder. Enter bonuses, benefits, PRCS assignment, and Medical Director percentages using inline controls and interactive tooltips.

## Tech stack

- React 19 + TypeScript, Vite 7
- Zustand (state), Immer (immutability)
- Plotly (charts) via `react-plotly.js`
- @dnd-kit (drag-and-drop)
- ESLint (TypeScript config)

## Scripts

- `npm run dev`: Start dev server
- `npm run build`: Type-check and build
- `npm run preview`: Preview production build
- `npm run lint`: Lint all files

## Assets

Icons and images live under `public/` and are referenced in the UI for visual cues (e.g., bonus/benefit toggles). No runtime backend is required; all modeling is client-side.

## Notes

- Tax/benefit rates are WA-specific assumptions for a small medical practice and can be adjusted in `defaults.ts` and `calculations.ts`.
- Historic data and 2025 actuals are embedded constants; update them in `defaults.ts` as new actuals arrive.
- The app persists scenario state via local storage (Zustand `persist`). Use the in-app reset controls to clear or restore defaults.
