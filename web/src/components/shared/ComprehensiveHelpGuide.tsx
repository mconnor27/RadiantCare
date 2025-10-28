import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faArrowLeft } from '@fortawesome/free-solid-svg-icons'

interface ComprehensiveHelpGuideProps {
  isOpen: boolean
  onClose: () => void
}

type Chapter = {
  id: string
  title: string
  sections: Section[]
}

type Section = {
  id: string
  title: string
  content: React.JSX.Element
}

export default function ComprehensiveHelpGuide({ isOpen, onClose }: ComprehensiveHelpGuideProps) {
  const [selectedChapterId, setSelectedChapterId] = useState('overview')
  const [selectedSectionId, setSelectedSectionId] = useState('intro')

  if (!isOpen) return null

  const chapters: Chapter[] = [
    {
      id: 'overview',
      title: 'Overview',
      sections: [
        {
          id: 'intro',
          title: 'Introduction',
          content: (
            <>
              <p>
                The <strong>RadiantCare Compensation Dashboard</strong> is a comprehensive financial planning and analysis tool designed specifically for physician compensation modeling. It integrates real-time data from QuickBooks Online with sophisticated projection models to help you understand current performance and plan for the future.
              </p>
              <h4>Key Capabilities</h4>
              <ul>
                <li><strong>Real-Time Data Integration:</strong> Automatic synchronization with QuickBooks Online for up-to-date financial information</li>
                <li><strong>Dual View System:</strong> Switch between detailed current-year tracking and multi-year strategic planning</li>
                <li><strong>Scenario Management:</strong> Save, load, and compare different financial planning scenarios</li>
                <li><strong>Collaboration:</strong> Share scenarios publicly or keep them private, with shareable links for team review</li>
                <li><strong>Comprehensive Modeling:</strong> Model physician hires, retirements, promotions, and compensation changes</li>
              </ul>
            </>
          )
        },
        {
          id: 'architecture',
          title: 'System Architecture',
          content: (
            <>
              <p>
                The dashboard is built on a modular architecture that separates concerns between current year tracking and long-term projections:
              </p>
              <h4>Data Flow</h4>
              <ol>
                <li><strong>QuickBooks Online Integration:</strong> Daily financial data is fetched from QBO via secure API</li>
                <li><strong>Data Processing:</strong> Raw data is parsed, normalized, and enriched with site-specific breakdowns</li>
                <li><strong>State Management:</strong> Application state is managed via Zustand with persistent storage</li>
                <li><strong>Compensation Engine:</strong> Complex compensation calculations run on-demand based on current parameters</li>
                <li><strong>Visualization:</strong> Interactive plotly charts with custom styling</li>
              </ol>
              <h4>Data Persistence</h4>
              <ul>
                <li><strong>Browser Storage:</strong> Current state is saved locally in the browser for session continuity</li>
                <li><strong>Database Storage:</strong> Scenarios are saved to Supabase PostgreSQL database for sharing and long-term storage</li>
                <li><strong>Caching:</strong> QBO data is cached to reduce API calls and improve performance</li>
              </ul>
            </>
          )
        }
      ]
    },
    {
      id: 'ytd-view',
      title: 'YTD Detailed View',
      sections: [
        {
          id: 'ytd-overview',
          title: 'YTD View Overview',
          content: (
            <>
              <p>
                The <strong>YTD Detailed View</strong> provides comprehensive tracking and analysis of the current fiscal year with a focus on year-to-date performance, projections, and physician compensation details.
              </p>
              <h4>Primary Components</h4>
              <ul>
                <li><strong>Interactive Income Chart:</strong> Historical comparison with current year tracking</li>
                <li><strong>Chart Controls:</strong> Extensive customization options for data visualization</li>
                <li><strong>Yearly Data Grid:</strong> Detailed P&L breakdown with editable projections</li>
                <li><strong>Physicians Editor:</strong> Manage current year physician roster and compensation</li>
                <li><strong>Partner Compensation Panel:</strong> Real-time compensation calculations for partners</li>
              </ul>
              <h4>When to Use This View</h4>
              <p>
                Use the YTD Detailed View when you need to:
              </p>
              <ul>
                <li>Monitor current year performance against historical trends</li>
                <li>Adjust projected values for the remainder of the year</li>
                <li>Track actual vs projected physician compensation</li>
                <li>Analyze site-specific income breakdowns (Lacey, Centralia, Aberdeen)</li>
                <li>Make mid-year adjustments to physician details or financial parameters</li>
              </ul>
            </>
          )
        },
        {
          id: 'ytd-sync',
          title: 'QuickBooks Sync',
          content: (
            <>
              <p>
                <strong>Syncing with QuickBooks Online.</strong>
              </p>
              <h4>Sync Behavior</h4>
              <ul>
                <li><strong>Automatic Caching:</strong> Data is cached for to prevent excessive API calls</li>
                <li><strong>Error Handling:</strong> If sync fails, an error message is displayed with retry options</li>
              </ul>
              <h4>What Gets Synced</h4>
              <ul>
                <li><strong>Daily Income Data:</strong> Therapy income broken down by site (Lacey, Centralia, Aberdeen)</li>
                <li><strong>Partner Payments:</strong> Current year partner distributions</li>
              </ul>
              <h4>Sync Timestamp</h4>
              <p>
                The last sync timestamp is displayed next to the sync button, showing when data was last refreshed from QBO.
              </p>
            </>
          )
        },
        {
          id: 'ytd-chart',
          title: 'Interactive Income Chart',
          content: (
            <>
              <p>
                The main chart displays therapy income trends over time, comparing the current year with historical data (2016+).
              </p>
              <h4>Chart Features</h4>
              <ul>
                <li><strong>Historical Comparison:</strong> Overlay current year performance against previous years</li>
                <li><strong>Normalization:</strong> Toggle normalization to compare relative pace</li>
                <li><strong>Multiple Modes:</strong> Switch between line charts, bar charts, and proportion views</li>
                <li><strong>Site Breakdown:</strong> Toggle between total income view and per-site income analysis</li>
                <li><strong>Smoothing:</strong> Apply moving average smoothing to reduce noise in daily data</li>
                <li><strong>Interactive Legend:</strong> Click legend items to show/hide specific years</li>
              </ul>
              <h4>Chart Controls</h4>
              <p>
                The chart controls panel (below the chart) provides extensive customization options:
              </p>
              <ul>
                <li><strong>Chart Mode:</strong> Line, Bar, or Proportion</li>
                <li><strong>Normalization:</strong> Enable to normalize relative to each year's total income</li>
                <li><strong>Smoothing:</strong> Slider to adjust moving average window</li>
                <li><strong>Year Selection:</strong> Toggle individual years on/off</li>
                <li><strong>Income Mode:</strong> Switch between total income and per-site breakdown</li>
                <li><strong>Site Visibility:</strong> Show/hide individual sites (Lacey, Centralia, Aberdeen)</li>
                <li><strong>Color Scheme:</strong> Choose from multiple color palettes (GGPlot2, Gray, Blue-Green, RadiantCare)</li>
              </ul>
              <h4>Proportion Mode</h4>
              <p>
                Proportion mode shows the <em>relative</em> income distribution over time, with each month's income stacked to 100%. This is useful for identifying seasonal patterns and site mix changes.
              </p>
            </>
          )
        },
        {
          id: 'ytd-grid',
          title: 'Yearly Data Grid (P&L)',
          content: (
            <>
              <p>
                The <strong>Yearly Data Grid</strong> is a comprehensive profit and loss statement showing both actual (year-to-date) and projected (remainder of year) financial data.
              </p>
              <h4>Grid Structure</h4>
              <p>
                The grid is divided into two main columns:
              </p>
              <ul>
                <li><strong>Actual:</strong> Year-to-date values from QuickBooks Online (read-only)</li>
                <li><strong>Projected:</strong> Estimated values for the full year (editable)</li>
              </ul>
              <h4>Row Categories</h4>
              <ul>
                <li><strong>Income:</strong> Therapy income (total and by site) and medical director income</li>
                <li><strong>Costs:</strong> Non-employment costs, staff payroll, locums, medical director hours</li>
                <li><strong>Physicians:</strong> Per-physician compensation breakdown with salary, bonus, benefits, medical director hours</li>
                <li><strong>Summary:</strong> Total compensation, net income, and per-partner distribution</li>
              </ul>
              <h4>Editable Fields</h4>
              <p>
                Some projected values can be manually adjusted by clicking on the cell (indicated by dotted underline on hover):
              </p>
              <ul>
                <li>Projected therapy income (total or by site)</li>
                <li>Projected non-employment costs</li>
                <li>Projected locum costs</li>
                <li>Projected medical director hours (shared and PRCS)</li>
              </ul>
              <p>
                When you edit a projected value, the cell border changes color to indicate a manual override.
              </p>
              <h4>Physician Rows</h4>
              <p>
                Each active physician gets their own row showing:
              </p>
              <ul>
                <li><strong>Base Salary:</strong> For employees (W-2 compensation)</li>
                <li><strong>Benefits:</strong> Medical/dental/vision costs</li>
                <li><strong>Bonuses:</strong> Signing or relocation bonuses</li>
                <li><strong>Medical Director Hours:</strong> Portion of shared medical director income allocated to this physician</li>
                <li><strong>K-1 Distribution:</strong> For partners (equity distribution based on net income)</li>
                <li><strong>Total Compensation:</strong> Sum of all compensation components</li>
              </ul>
            </>
          )
        },
        {
          id: 'ytd-physicians',
          title: 'Physicians Editor',
          content: (
            <>
              <p>
                The <strong>Physicians Editor</strong> allows you to manage the current year physician roster, including adding, editing, and removing physicians.
              </p>
              <h4>Physician Types</h4>
              <ul>
                <li><strong>Partner:</strong> Equity partners who receive K-1 distributions based on net income</li>
                <li><strong>Employee:</strong> W-2 employees with fixed salaries</li>
                <li><strong>Employee to Partner:</strong> Physicians transitioning from employee to partner during the year</li>
                <li><strong>Partner to Retire:</strong> Partners retiring during the year (partial year active, receives buyout)</li>
                <li><strong>New Employee:</strong> New hires starting partway through the year</li>
                <li><strong>Employee to Terminate:</strong> Employees leaving partway through the year</li>
              </ul>
              <h4>Partner Fields</h4>
              <ul>
                <li><strong>Name:</strong> Physician's name</li>
                <li><strong>Weeks Off:</strong> Vacation/time off weeks (affects K-1 distribution)</li>
                <li><strong>Medical Director Hours:</strong> Toggle whether this partner receives PRCS medical director hours</li>
                <li><strong>MD Hours Percentage:</strong> Percentage of shared MD hours allocated to this partner (must sum to 100% across all partners)</li>
                <li><strong>Additional Days Worked:</strong> Internal locums coverage days ($2,000 per day)</li>
              </ul>
              <h4>Employee Fields</h4>
              <ul>
                <li><strong>Name:</strong> Physician's name</li>
                <li><strong>Type:</strong> Employee, New Employee, or Employee to Terminate</li>
                <li><strong>Salary:</strong> Annual W-2 salary</li>
                <li><strong>Weeks Off:</strong> Vacation/time off weeks</li>
                <li><strong>Receives Benefits:</strong> Whether they receive medical/dental/vision benefits</li>
                <li><strong>Receives Bonuses:</strong> Whether they receive signing/relocation bonuses</li>
                <li><strong>Bonus Amount:</strong> One-time bonus amount</li>
                <li><strong>Start/Terminate Date:</strong> For new hires or terminations (controls pro-rating)</li>
              </ul>
              <h4>Transitional Types</h4>
              <p>
                <strong>Employee to Partner</strong> physicians have both employee and partner fields. The system automatically pro-rates their compensation based on the transition date:
              </p>
              <ul>
                <li><strong>Employee Portion of Year:</strong> Fraction of year as employee (0 = Jan 1, 1 = Dec 31)</li>
                <li><strong>Employee Salary & Benefits:</strong> Pro-rated based on employee portion</li>
                <li><strong>Partner K-1:</strong> Pro-rated based on partner portion (1 - employee portion)</li>
              </ul>
              <p>
                <strong>Partner to Retire</strong> physicians work part of the year and then retire:
              </p>
              <ul>
                <li><strong>Partner Portion of Year:</strong> Fraction of year working (0 = retired all year, 1 = worked full year)</li>
                <li><strong>K-1 Distribution:</strong> Pro-rated based on partner portion</li>
                <li><strong>Buyout Cost:</strong> One-time payment upon retirement</li>
                <li><strong>Trailing Shared Medical Director Hours:</strong> Fixed dollar amount of medical director hours income after retirement (prior year retirees only)</li>
              </ul>
              <h4>Medical Director Hours Redistribution</h4>
              <p>
                When you adjust one partner's hours percentage, the system automatically redistributes the change proportionally across other active partners to maintain a 100% total. Prior year retirees (partner portion = 0) receive a fixed dollar amount and do not participate in percentage-based redistribution.
              </p>
              <h4>Drag and Drop Reordering</h4>
              <p>
                You can drag and drop physician cards to reorder them. This order is preserved when you save scenarios and affects the display order in the grid and compensation summary.
              </p>
            </>
          )
        },
        {
          id: 'ytd-compensation',
          title: 'Partner Compensation Panel',
          content: (
            <>
              <p>
                The <strong>Partner Compensation Panel</strong> (right side of the screen) shows real-time compensation calculations for all partners based on current projections.
              </p>
              <h4>Compensation Calculation</h4>
              <p>
                Partner compensation is calculated using a multi-step process:
              </p>
              <ol>
                <li><strong>Calculate Net Income:</strong> Total income minus all costs and employee salaries</li>
                <li><strong>Subtract Partner Costs:</strong> Deduct partner benefits and buyout costs</li>
                <li><strong>Calculate Distributable Income:</strong> Net income minus medical director hours and consulting services</li>
                <li><strong>Calculate Weeks Adjustment:</strong> Adjust each partner's share based on vacation weeks</li>
                <li><strong>Distribute to Partners:</strong> Allocate distributable income proportionally based on adjusted weeks</li>
                <li><strong>Add MD Hours:</strong> Add back each partner's allocated portion of medical director hours</li>
                <li><strong>Add Consulting Services:</strong> Add consulting services to the designated PRCS director</li>
                <li><strong>Add Internal Locums:</strong> Add $2,000 per additional day worked</li>
              </ol>
              <h4>Real-Time Updates</h4>
              <p>
                The compensation panel updates instantly when you change:
              </p>
              <ul>
                <li>Projected therapy income</li>
                <li>Projected costs</li>
                <li>Physician details (salary, weeks off, medical director hours percentage)</li>
                <li>Medical director hours amounts</li>
                <li>PRCS director selection</li>
              </ul>
            </>
          )
        }
      ]
    },
    {
      id: 'multi-year',
      title: 'Multi-Year View',
      sections: [
        {
          id: 'multi-year-overview',
          title: 'Multi-Year Overview',
          content: (
            <>
              <p>
                The <strong>Multi-Year View</strong> provides long-term financial projections (5) years total), with the ability to compare two scenarios side-by-side.
              </p>
              <h4>Key Features</h4>
              <ul>
                <li><strong>Baseline Selection:</strong> Choose between 2024 Data, 2025 Data, or Custom baseline</li>
                <li><strong>Scenario A vs B:</strong> Load and compare two different projection scenarios</li>
                <li><strong>Year Tabs:</strong> Switch between Baseline and Projected Years</li>
                <li><strong>Projection Settings:</strong> Configure growth rates and global parameters</li>
                <li><strong>Physician Planning:</strong> Model hires, retirements, promotions across years</li>
                <li><strong>Visual Comparison:</strong> Chart showing income, costs, and compensation trends</li>
              </ul>
              <h4>Baseline Modes</h4>
              <ul>
                <li><strong>2024 Data:</strong> Use actual 2024 financial data as the starting point (historical)</li>
                <li><strong>2025 Data:</strong> Use 2025 QBO data as the baseline (default for current year planning)</li>
                <li><strong>Custom:</strong> Manually configure baseline values (for advanced modeling)</li>
              </ul>
              <p>
                <em>Note:</em> When you switch baseline modes, a warning modal appears because it will reset all projection years to use the new baseline. This is a destructive operation.
              </p>
            </>
          )
        },
        {
          id: 'multi-year-projection-settings',
          title: 'Projection Settings',
          content: (
            <>
              <p>
                The <strong>Projection Settings Panel</strong> (left side) controls the global growth rates and parameters applied to all future years.
              </p>
              <h4>Income Settings</h4>
              <ul>
                <li><strong>Therapy Income Growth:</strong> Annual percentage growth for therapy income (typically 3-6%)</li>
              </ul>
              <h4>Cost Settings</h4>
              <ul>
                <li><strong>Non-Employment Costs Growth:</strong> Annual growth rate for facility costs, supplies, etc. (typically 4-7%)</li>
                <li><strong>Staff Employment Costs Growth:</strong> Annual growth for non-physician staff payroll (typically 2-4%)</li>
                <li><strong>Misc Employment Costs Growth:</strong> Growth rate for miscellaneous employment expenses (typically 2-4%)</li>
                <li><strong>Benefit Costs Growth:</strong> Annual increase in medical/dental/vision premiums (typically 5-9%)</li>
              </ul>
              <h4>Medical Director Settings</h4>
              <ul>
                <li><strong>Shared MD Hours:</strong> Annual budget for shared medical director hours</li>
                <li><strong>PRCS MD Hours:</strong> Annual budget for PRCS medical director hours</li>
                <li><strong>Consulting Services Agreement:</strong> Annual amount for consulting services (biller)</li>
              </ul>
              <h4>Other Settings</h4>
              <ul>
                <li><strong>Locums Costs:</strong> Annual budget for locums coverage</li>
              </ul>
              <h4>Global Application</h4>
              <p>
                When you change a projection setting, it applies to <em>all</em> future years unless you've manually overridden a specific year. Overridden years are marked with a purple indicator and are not affected by global changes.
              </p>
              <h4>Per-Year Overrides</h4>
              <p>
                You can override projection settings for individual years. To reset to the global projection setting, click the reset icon that appears at the top of the year panel.
              </p>
            </>
          )
        },
        {
          id: 'multi-year-year-panels',
          title: 'Year Panels',
          content: (
            <>
              <p>
                Each year (Baseline, projected) has its own <strong>Year Panel</strong> showing financial parameters and physician roster for that specific year.
              </p>
              <h4>Baseline Tab (2025 or 2024)</h4>
              <p>
                The baseline tab shows the starting point for projections:
              </p>
              <ul>
                <li><strong>2025 Data Mode:</strong> Shows current year QBO data (same as YTD view)</li>
                <li><strong>2024 Data Mode:</strong> Shows historical 2024 financial data</li>
                <li><strong>Custom Mode:</strong> Shows manually configured baseline values</li>
              </ul>
              <p>
                The baseline tab is typically read-only in Multi-Year view. To edit the 2025 baseline, switch to YTD Detailed view.
              </p>
              <h4>Future Year Tabs</h4>
              <p>
                Each future year tab shows:
              </p>
              <ul>
                <li><strong>Financial Summary:</strong> Projected therapy income, costs, and net income</li>
                <li><strong>Physicians Editor:</strong> Manage physician roster for this specific year</li>
                <li><strong>Compensation Summary:</strong> Projected partner compensation for this year</li>
                <li><strong>Override Indicators:</strong> Purple borders on fields that have been manually overridden</li>
              </ul>
              <h4>Physician Propagation</h4>
              <p>
                When you add or modify a physician in a future year, the system automatically propagates those changes to subsequent years:
              </p>
              <ul>
                <li><strong>New Physician:</strong> Added to all future years automatically</li>
                <li><strong>Employee to Partner:</strong> Becomes a full partner in subsequent years</li>
                <li><strong>Partner to Retire:</strong> Removed from subsequent years (but may receive trailing medical director hours)</li>
                <li><strong>Salary Changes:</strong> Propagate forward (minimum, not exact - allows increases)</li>
                <li><strong>Weeks Off Changes:</strong> Propagate forward (minimum, not exact)</li>
              </ul>
              <h4>Parameters Summary</h4>
              <p>
                At the top of each year panel, a compact summary shows key parameters for quick reference:
              </p>
              <ul>
                <li>Projected therapy income</li>
                <li>Medical director hours amounts</li>
                <li>Number of partners vs employees</li>
                <li>Average partner compensation</li>
              </ul>
            </>
          )
        },
        {
          id: 'multi-year-chart',
          title: 'Historic and Projection Chart',
          content: (
            <>
              <p>
                The <strong>Historic and Projection Chart</strong> (top of the screen) provides a visual timeline of financial trends from 2016 through the projected years.
              </p>
              <h4>Chart Sections</h4>
              <ul>
                <li><strong>Historic Data (2016+):</strong> Actual historical financial performance (gray background)</li>
                <li><strong>Baseline Year (2025 or 2024):</strong> Starting point for projections (highlighted)</li>
                <li><strong>Projections:</strong> Forecasted values based on projection settings (white background)</li>
              </ul>
              <h4>Data Series</h4>
              <p>
                The chart displays multiple data series with toggle controls:
              </p>
              <ul>
                <li><strong>Therapy Income:</strong> Annual therapy income from all sites</li>
                <li><strong>Total Income:</strong> Therapy income plus medical director income</li>
                <li><strong>Total Costs:</strong> All employment and non-employment costs</li>
                <li><strong>Net Income:</strong> Total income minus total costs</li>
                <li><strong>Avg Partner Compensation:</strong> Average K-1 distribution per partner</li>
              </ul>
              <h4>Scenario Comparison</h4>
              <p>
                When Scenario B is enabled, the chart shows both scenarios with different line styles:
              </p>
              <ul>
                <li><strong>Scenario A:</strong> Solid lines</li>
                <li><strong>Scenario B:</strong> Dashed lines</li>
              </ul>
              <p>
                This allows you to visually compare the impact of different assumptions on long-term financial outcomes.
              </p>
              <h4>Interactive Features</h4>
              <ul>
                <li><strong>Hover Tooltips:</strong> Hover over data points to see exact values</li>
                <li><strong>Legend Toggles:</strong> Click legend items to show/hide specific data series</li>
                <li><strong>Year Highlighting:</strong> The currently selected year tab is highlighted on the chart</li>
              </ul>
            </>
          )
        },
        {
          id: 'multi-year-scenario-comparison',
          title: 'Scenario A vs B Comparison',
          content: (
            <>
              <p>
                Multi-Year view supports side-by-side comparison of two projection scenarios (Scenario A and Scenario B).
              </p>
              <h4>Enabling Scenario B</h4>
              <p>
                To enable scenario comparison:
              </p>
              <ol>
                <li>Click the "Enable Scenario B" button (top-right of the screen)</li>
                <li>The system prompts you to load a projection scenario for Scenario B</li>
                <li>Select a saved projection scenario from the load modal</li>
                <li>Scenario B appears in a side-by-side panel with Scenario A</li>
              </ol>
              <h4>Comparison View</h4>
              <p>
                When Scenario B is enabled, the interface splits into two columns:
              </p>
              <ul>
                <li><strong>Left Column (Scenario A):</strong> Your primary working scenario</li>
                <li><strong>Right Column (Scenario B):</strong> Alternative scenario for comparison</li>
              </ul>
              <p>
                Both scenarios show:
              </p>
              <ul>
                <li>Year tabs (synchronized - clicking a year changes both scenarios)</li>
                <li>Physicians editor (independent rosters)</li>
                <li>Compensation summary (independent calculations)</li>
                <li>Parameters summary (independent settings)</li>
              </ul>
              <h4>Chart Comparison</h4>
              <p>
                The Historic and Projection Chart overlays both scenarios with different line styles, making it easy to spot differences in:
              </p>
              <ul>
                <li>Income growth trajectories</li>
                <li>Cost trends</li>
                <li>Net income projections</li>
                <li>Partner compensation trends</li>
              </ul>
              <h4>Use Cases</h4>
              <ul>
                <li><strong>Conservative vs Aggressive:</strong> Compare different income growth assumptions</li>
                <li><strong>Staffing Options:</strong> Compare scenarios with different physician hiring plans</li>
                <li><strong>Cost Scenarios:</strong> Compare different cost growth assumptions</li>
                <li><strong>Retirement Planning:</strong> Compare impact of different retirement timelines</li>
              </ul>
            </>
          )
        },
        {
          id: 'multi-year-workforce',
          title: 'Workforce Analysis',
          content: (
            <>
              <p>
                The <strong>Workforce Analysis Panel</strong> (collapsible section below the chart) provides a comprehensive view of physician workforce changes over time.
              </p>
              <h4>Workforce Metrics</h4>
              <ul>
                <li><strong>Weeks Worked:</strong> Total weeks worked by all physicians by year</li>
                <li><strong>Weeks Vacation:</strong> Total weeks vacation by all physicians by year</li>
              </ul>
            </>
          )
        }
      ]
    },
    {
      id: 'scenarios',
      title: 'Scenario Management',
      sections: [
        {
          id: 'scenario-types',
          title: 'Scenario Types',
          content: (
            <>
              <p>
                The dashboard supports two types of scenarios, each designed for different planning needs:
              </p>
              <h4>Current Year Settings</h4>
              <p>
                <strong>Purpose:</strong> Save customizations to the current year only.
              </p>
              <p>
                <strong>What's Saved:</strong>
              </p>
              <ul>
                <li>Physician roster (names, types, salaries, benefits, medical director hours)</li>
                <li>Financial parameters (therapy income, costs, medical director hours)</li>
                <li>Grid overrides (manual adjustments to projected values)</li>
              </ul>
              <p>
                <strong>What's NOT Saved:</strong>
              </p>
              <ul>
                <li>Chart settings (normalization, smoothing, color scheme, etc.)</li>
                <li>Future year projections</li>
                <li>Projection settings (growth rates)</li>
              </ul>
              <p>
                <strong>Use Cases:</strong>
              </p>
              <ul>
                <li>Save different staffing configurations to compare</li>
                <li>Create "what-if" scenarios for mid-year adjustments</li>
                <li>Share current year assumptions with colleagues</li>
              </ul>
              <h4>Projection Scenarios</h4>
              <p>
                <strong>Purpose:</strong> Save complete 5-year projections with all assumptions.
              </p>
              <p>
                <strong>What's Saved:</strong>
              </p>
              <ul>
                <li>Baseline mode selection (2024 Data, 2025 Data, or Custom) (reference only)</li>
                <li>Projection settings (all growth rates and global parameters)</li>
                <li>Future year data (physicians, overrides, parameters)</li>
                <li>Custom baseline values (for Custom mode only)</li>
              </ul>
              <p>
                <strong>What's NOT Saved:</strong>
              </p>
              <ul>
                <li>Current year baseline customizations (use Current Year Settings for this)</li>
                <li>Chart settings or UI preferences</li>
              </ul>
              <p>
                <strong>Use Cases:</strong>
              </p>
              <ul>
                <li>Compare different long-term growth assumptions</li>
                <li>Model different physician hiring/retirement plans</li>
                <li>Create conservative vs aggressive projections</li>
                <li>Share strategic planning scenarios</li>
              </ul>
              <h4>Modular Design</h4>
              <p>
                The separation of Current Year Settings and Projection scenarios allows you to mix and match:
              </p>
              <ul>
                <li>Load a Current Year Settings scenario to update your current year baseline</li>
                <li>Load a Projection scenario to apply 5-year growth assumptions</li>
                <li>Both can be loaded independently without overwriting each other</li>
              </ul>
            </>
          )
        },
        {
          id: 'saving-scenarios',
          title: 'Saving Scenarios',
          content: (
            <>
              <p>
                To save the current state as a scenario, click the <strong>Save</strong> button (disk icon) in the toolbar.
              </p>
              <h4>Save Dialog</h4>
              <p>
                The save dialog prompts you for:
              </p>
              <ul>
                <li><strong>Scenario Type:</strong> Choose between "Current Year Settings" or "Projection"</li>
                <li><strong>Name:</strong> A descriptive name for the scenario (required)</li>
                <li><strong>Description:</strong> Optional detailed description of assumptions or purpose</li>
                <li><strong>Public:</strong> Toggle whether to make this scenario visible to other users</li>
              </ul>
              <h4>Overwriting Scenarios</h4>
              <p>
                If you're editing a loaded scenario, the save dialog shows an "Overwrite" button to update the existing scenario. This preserves the scenario ID, creation date, and favorite status.
              </p>
              <p>
                If you want to create a new scenario based on the loaded one, use the "Save as New" button instead.
              </p>
              <h4>Validation</h4>
              <p>
                The system validates that:
              </p>
              <ul>
                <li>Scenario name is not empty</li>
                <li>You have permission to overwrite (only scenario owner can overwrite)</li>
                <li>Scenario type matches the current view (Current Year Settings for YTD, Projection for Multi-Year)</li>
              </ul>
              <h4>Success Feedback</h4>
              <p>
                After successful save, a green checkmark appears briefly, and the scenario name is displayed in the toolbar with a clean state (no dirty indicator).
              </p>
            </>
          )
        },
        {
          id: 'loading-scenarios',
          title: 'Loading Scenarios',
          content: (
            <>
              <p>
                To load a saved scenario, click the <strong>Load</strong> button (folder icon) in the toolbar.
              </p>
              <h4>Load Modal</h4>
              <p>
                The load modal shows two tabs:
              </p>
              <ul>
                <li><strong>My Scenarios:</strong> Scenarios you've created</li>
                <li><strong>Public Scenarios:</strong> Scenarios shared by other users</li>
              </ul>
              <h4>Scenario Cards</h4>
              <p>
                Each scenario is displayed as a card showing:
              </p>
              <ul>
                <li><strong>Name:</strong> Scenario name</li>
                <li><strong>Description:</strong> Optional description (if provided)</li>
                <li><strong>Type Badge:</strong> "Current Year" or "Projection" with color coding</li>
                <li><strong>Creator:</strong> Email address of the user who created it</li>
                <li><strong>Created/Updated:</strong> Timestamps for creation and last modification</li>
                <li><strong>Favorite Icon:</strong> Star icon to mark as favorite (click to toggle)</li>
                <li><strong>Public/Private Badge:</strong> Indicates visibility status</li>
              </ul>
              <h4>Filtering</h4>
              <p>
                Use the "Type" dropdown to filter scenarios:
              </p>
              <ul>
                <li><strong>All:</strong> Show all scenario types</li>
                <li><strong>Current Year:</strong> Show only Current Year Settings scenarios</li>
                <li><strong>Projection:</strong> Show only Projection scenarios</li>
              </ul>
              <h4>Loading Actions</h4>
              <ul>
                <li><strong>Load to A:</strong> Load this scenario into Scenario A (or current scenario in YTD view)</li>
                <li><strong>Load to B:</strong> (Multi-Year only) Load into Scenario B for side-by-side comparison</li>
                <li><strong>Edit:</strong> (Your scenarios only) Modify scenario name, description, or public status</li>
                <li><strong>Clone:</strong> Create a copy of this scenario in your account</li>
                <li><strong>Delete:</strong> (Your scenarios only) Permanently delete the scenario</li>
              </ul>
              <h4>Favorites</h4>
              <p>
                Favorited scenarios appear at the top of the list with a filled star icon. You can have separate favorites for:
              </p>
              <ul>
                <li><strong>Scenario A:</strong> Your default primary scenario</li>
                <li><strong>Scenario B:</strong> Your default comparison scenario</li>
                <li><strong>Current Year:</strong> Your default baseline configuration</li>
              </ul>
              <h4>Auto-Load</h4>
              <p>
                When you first open the dashboard, your favorited Current Year Settings scenario (if any) is automatically loaded to provide a consistent starting point.
              </p>
            </>
          )
        },
        {
          id: 'sharing-scenarios',
          title: 'Sharing and Collaboration',
          content: (
            <>
              <p>
                The dashboard supports two methods of sharing: public scenarios and shareable links.
              </p>
              <h4>Public Scenarios</h4>
              <p>
                <strong>How to Make Public:</strong>
              </p>
              <ol>
                <li>When saving a scenario, toggle the "Public" checkbox</li>
                <li>Or, edit an existing scenario and toggle the public status</li>
              </ol>
              <p>
                <strong>Public Scenario Behavior:</strong>
              </p>
              <ul>
                <li>Appears in the "Public Scenarios" tab for all users</li>
                <li>Other users can load it (read-only for them)</li>
                <li>Other users can clone it to create their own copy</li>
                <li>You retain ownership and can edit/delete it</li>
              </ul>
              <h4>Shareable Links</h4>
              <p>
                <strong>Creating a Link:</strong>
              </p>
              <ol>
                <li>Configure the dashboard exactly as you want others to see it</li>
                <li>Save any unsaved scenarios (all scenarios must be saved and public)</li>
                <li>Click the "Share" button (link icon) in the toolbar</li>
                <li>The system generates a URL encoding your configuration</li>
                <li>Copy the URL and share it via email, Slack, etc.</li>
              </ol>
              <p>
                <strong>What's Included in the Link:</strong>
              </p>
              <ul>
                <li>Current view mode (YTD Detailed or Multi-Year)</li>
                <li>Loaded scenario IDs (Current Year Settings and/or Projection)</li>
                <li>Scenario B status (enabled/disabled)</li>
                <li>Selected year tab (for Multi-Year view)</li>
                <li>Chart settings (normalization, smoothing, color scheme, etc. for YTD view)</li>
              </ul>
              <p>
                <strong>Requirements:</strong>
              </p>
              <ul>
                <li>All loaded scenarios must be saved (no unsaved changes)</li>
                <li>All loaded scenarios must be marked as public</li>
                <li>You must be logged in to create a link</li>
              </ul>
              <p>
                <strong>Recipient Experience:</strong>
              </p>
              <ul>
                <li>Recipient clicks the shared link</li>
                <li>If not logged in, they're prompted to log in or sign up</li>
                <li>After login, the dashboard loads with your exact configuration</li>
                <li>A warning modal appears explaining this is a shared link</li>
                <li>Recipients can explore and modify values, but changes are local only (not saved to the shared scenarios)</li>
                <li>Recipients can clone scenarios to their own account for further work</li>
              </ul>
            </>
          )
        },
        {
          id: 'dirty-state',
          title: 'Dirty State Tracking',
          content: (
            <>
              <p>
                The dashboard tracks whether you have unsaved changes to help prevent accidental data loss.
              </p>
              <h4>Dirty Indicators</h4>
              <p>
                When you modify a loaded scenario, a yellow dot appears next to the scenario name in the toolbar. This indicates "dirty" state - you have unsaved changes.
              </p>
              <h4>What Triggers Dirty State</h4>
              <p>
                <strong>Current Year Settings:</strong>
              </p>
              <ul>
                <li>Changing any financial parameter (income, costs, MD hours)</li>
                <li>Adding, editing, or removing physicians</li>
                <li>Reordering physicians</li>
                <li>Manually overriding projected values in the grid</li>
              </ul>
              <p>
                <strong>Projection Scenarios:</strong>
              </p>
              <ul>
                <li>Changing projection settings (growth rates, global parameters)</li>
                <li>Adding, editing, or removing physicians in future years (2026-2030)</li>
                <li>Manually overriding projected values in future years</li>
                <li>Changing baseline mode</li>
              </ul>
              <h4>What Does NOT Trigger Dirty State</h4>
              <ul>
                <li>Changing chart settings (normalization, smoothing, colors) - these are session-only</li>
                <li>Switching between year tabs</li>
                <li>QuickBooks sync updates (actual YTD data changes)</li>
                <li>Automatic recalculations (compensation, net income, etc.)</li>
              </ul>
              <h4>Clearing Dirty State</h4>
              <p>
                Dirty state is cleared when you:
              </p>
              <ul>
                <li>Save the scenario (overwrite or save as new)</li>
                <li>Load a different scenario (replaces current state)</li>
                <li>Click the "Discard Changes" button (X icon) to revert to last loaded state</li>
              </ul>
              <h4>Dirty State Warning</h4>
              <p>
                If you try to load a new scenario while in dirty state, you'll see a warning confirming you want to discard unsaved changes.
              </p>
            </>
          )
        }
      ]
    },
    {
      id: 'physician-modeling',
      title: 'Physician Modeling',
      sections: [
        {
          id: 'physician-types-detail',
          title: 'Physician Types in Detail',
          content: (
            <>
              <p>
                The system supports six physician types, each with unique compensation logic and field requirements.
              </p>
              <h4>Partner</h4>
              <p>
                <strong>Description:</strong> Equity partners who own the practice and receive K-1 distributions based on net income.
              </p>
              <p>
                <strong>Compensation Calculation:</strong>
              </p>
              <ol>
                <li>Calculate distributable net income (total income - costs - employee salaries - partner costs)</li>
                <li>Subtract medical director hours (distributed separately)</li>
                <li>Adjust each partner's share based on vacation weeks (partners with more time off receive slightly less)</li>
                <li>Distribute remaining income proportionally</li>
                <li>Add back allocated medical director hours (based on percentage)</li>
                <li>Add internal locums ($2,000 per additional day worked)</li>
              </ol>
              <p>
                <strong>Key Fields:</strong>
              </p>
              <ul>
                <li>Name</li>
                <li>Weeks Off (affects distribution calculation)</li>
                <li>Has Medical Director Hours (yes/no toggle)</li>
                <li>Medical Director Hours Percentage (0-100%, must sum to 100% across all partners)</li>
                <li>Additional Days Worked (internal locums coverage)</li>
              </ul>
              <h4>Employee</h4>
              <p>
                <strong>Description:</strong> W-2 employees with fixed annual salaries, not eligible for K-1 distributions.
              </p>
              <p>
                <strong>Compensation Calculation:</strong>
              </p>
              <ul>
                <li>Base salary (annual amount, divided into 26 biweekly paychecks)</li>
                <li>Benefits (if eligible): medical/dental/vision costs</li>
                <li>Bonuses (if eligible): signing or relocation bonuses</li>
              </ul>
              <p>
                <strong>Key Fields:</strong>
              </p>
              <ul>
                <li>Name</li>
                <li>Annual Salary ($)</li>
                <li>Weeks Off</li>
                <li>Receives Benefits (yes/no)</li>
                <li>Receives Bonuses (yes/no)</li>
                <li>Bonus Amount ($, one-time)</li>
              </ul>
              <h4>Employee to Partner</h4>
              <p>
                <strong>Description:</strong> Physicians transitioning from employee to partner status during the year.
              </p>
              <p>
                <strong>Compensation Calculation:</strong>
              </p>
              <ul>
                <li>Employee portion: Pro-rated salary + benefits based on employee portion of year</li>
                <li>Partner portion: Pro-rated K-1 distribution based on partner portion of year (1 - employee portion)</li>
                <li>The system uses "Partner → Employee" type internally (employeePortionOfYear = 0 in transition year for delayed W2 payments)</li>
              </ul>
              <p>
                <strong>Key Fields:</strong>
              </p>
              <ul>
                <li>Name</li>
                <li>Employee Salary ($)</li>
                <li>Employee Weeks Vacation (during employee portion)</li>
                <li>Partner Weeks Vacation (during partner portion)</li>
                <li>Employee Portion of Year (0-1, where 0 = Jan 1, 1 = Dec 31)</li>
                <li>Receives Benefits (during employee portion)</li>
                <li>Has Medical Director Hours (during partner portion)</li>
                <li>Medical Director Hours Percentage (during partner portion)</li>
              </ul>
              <p>
                <strong>Future Year Behavior:</strong> Automatically becomes a full "Partner" in subsequent years.
              </p>
              <h4>Partner to Retire</h4>
              <p>
                <strong>Description:</strong> Partners retiring during or after the year. Can work part of the year and then retire.
              </p>
              <p>
                <strong>Compensation Calculation:</strong>
              </p>
              <ul>
                <li>If working part of year: Pro-rated K-1 distribution based on partner portion of year</li>
                <li>If fully retired (partner portion = 0): Fixed "trailing shared MD amount" only</li>
                <li>Buyout Cost: One-time payment upon retirement (added to total compensation)</li>
              </ul>
              <p>
                <strong>Key Fields:</strong>
              </p>
              <ul>
                <li>Name</li>
                <li>Partner Portion of Year (0-1, where 0 = retired all year, 1 = worked full year)</li>
                <li>Weeks Off (during working portion)</li>
                <li>Buyout Cost ($, one-time payment)</li>
                <li>Trailing Shared MD Amount ($, for prior year retirees only - fixed dollar amount of MD hours)</li>
                <li>Medical Director Hours Percentage (if working part of year)</li>
              </ul>
              <p>
                <strong>Future Year Behavior:</strong> Removed from subsequent years automatically.
              </p>
              <p>
                <strong>Prior Year Retirees:</strong> Partners who retired in a previous year but still receive trailing MD income are represented with partnerPortionOfYear = 0 and trailingSharedMdAmount set.
              </p>
              <h4>New Employee</h4>
              <p>
                <strong>Description:</strong> New hires starting partway through the year.
              </p>
              <p>
                <strong>Compensation Calculation:</strong>
              </p>
              <ul>
                <li>Pro-rated salary based on start date</li>
                <li>Pro-rated benefits (if eligible)</li>
                <li>Full bonus amount (if eligible - typically paid on start date)</li>
              </ul>
              <p>
                <strong>Key Fields:</strong>
              </p>
              <ul>
                <li>Name</li>
                <li>Annual Salary ($)</li>
                <li>Start Portion of Year (0-1, where 0 = Jan 1, 1 = Dec 31)</li>
                <li>Weeks Off</li>
                <li>Receives Benefits (yes/no)</li>
                <li>Receives Bonuses (yes/no)</li>
                <li>Bonus Amount ($, typically full amount)</li>
              </ul>
              <p>
                <strong>Future Year Behavior:</strong> Becomes a full "Employee" in subsequent years.
              </p>
              <h4>Employee to Terminate</h4>
              <p>
                <strong>Description:</strong> Employees leaving partway through the year.
              </p>
              <p>
                <strong>Compensation Calculation:</strong>
              </p>
              <ul>
                <li>Pro-rated salary based on termination date</li>
                <li>Pro-rated benefits (if eligible)</li>
              </ul>
              <p>
                <strong>Key Fields:</strong>
              </p>
              <ul>
                <li>Name</li>
                <li>Annual Salary ($)</li>
                <li>Terminate Portion of Year (0-1, where 0 = Jan 1, 1 = Dec 31)</li>
                <li>Weeks Off</li>
                <li>Receives Benefits (yes/no)</li>
              </ul>
              <p>
                <strong>Future Year Behavior:</strong> Removed from subsequent years automatically.
              </p>
            </>
          )
        },
        {
          id: 'md-hours-allocation',
          title: 'Medical Director Hours Allocation',
          content: (
            <>
              <p>
                Medical Director (MD) Hours income is allocated separately from K-1 distributions and follows special rules.
              </p>
              <h4>Two MD Hours Pools</h4>
              <ul>
                <li><strong>Shared MD Hours:</strong> Distributed among partners based on percentage allocation (typically $90k-$120k annually)</li>
                <li><strong>PRCS MD Hours:</strong> Paid to the designated PRCS director only (typically $40k-$60k annually)</li>
              </ul>
              <h4>Shared MD Hours Distribution</h4>
              <p>
                <strong>Percentage-Based System:</strong>
              </p>
              <ul>
                <li>Each partner with "Has Medical Director Hours" enabled receives a percentage allocation</li>
                <li>Percentages must sum to 100% across all active partners</li>
                <li>The system automatically redistributes when you change one partner's percentage</li>
                <li>Redistribution is proportional based on each partner's portion of year worked</li>
              </ul>
              <p>
                <strong>Example:</strong>
              </p>
              <ul>
                <li>Total Shared MD Hours: $110,000</li>
                <li>Partner A: 40% = $44,000</li>
                <li>Partner B: 35% = $38,500</li>
                <li>Partner C: 25% = $27,500</li>
              </ul>
              <p>
                If you change Partner A to 50%, the system automatically adjusts Partners B and C proportionally to maintain 100% total.
              </p>
              <h4>Prior Year Retirees</h4>
              <p>
                Partners who retired in a previous year may receive "trailing shared MD" income:
              </p>
              <ul>
                <li>Set via "Trailing Shared MD Amount" field (fixed dollar amount, not percentage)</li>
                <li>Does not participate in percentage-based redistribution</li>
                <li>Reduces the percentage pool available to active partners</li>
              </ul>
              <p>
                <strong>Example:</strong>
              </p>
              <ul>
                <li>Total Shared MD Hours: $110,000</li>
                <li>Prior year retiree (fixed): $10,000</li>
                <li>Remaining for active partners: $100,000 (available for percentage distribution)</li>
              </ul>
              <h4>PRCS Director Selection</h4>
              <p>
                The PRCS (Physician Review and Consulting Services) director receives the full PRCS MD Hours amount:
              </p>
              <ul>
                <li>Select the designated director from a dropdown of eligible partners</li>
                <li>Only active partners (and employeeToPartner during partner portion) are eligible</li>
                <li>The full PRCS amount is added to that partner's compensation</li>
                <li>Selection propagates to future years automatically</li>
              </ul>
              <h4>Multi-Year Propagation</h4>
              <p>
                When you change MD hours allocation in a future year:
              </p>
              <ul>
                <li>Percentages propagate to subsequent years</li>
                <li>PRCS director selection propagates to subsequent years</li>
                <li>Override flags are set for years 2026+</li>
              </ul>
            </>
          )
        },
        {
          id: 'physician-propagation',
          title: 'Physician Propagation Rules',
          content: (
            <>
              <p>
                When you add or modify a physician in a future year (2026-2030), the system automatically propagates changes to subsequent years based on logical rules.
              </p>
              <h4>Adding a New Physician</h4>
              <p>
                When you add a physician to year N:
              </p>
              <ul>
                <li>The physician appears in all years ≥ N</li>
                <li>Each future year gets a new physician object with a year-specific ID</li>
                <li>Physician type evolves according to transition rules (see below)</li>
              </ul>
              <h4>Type Transition Rules</h4>
              <ul>
                <li><strong>Employee:</strong> Remains "Employee" in all future years</li>
                <li><strong>Partner:</strong> Remains "Partner" in all future years</li>
                <li><strong>Employee to Partner:</strong> Becomes "Partner" in year N+1 and beyond</li>
                <li><strong>Partner to Retire:</strong> Removed from year N+1 and beyond</li>
                <li><strong>New Employee:</strong> Becomes "Employee" in year N+1 and beyond</li>
                <li><strong>Employee to Terminate:</strong> Removed from year N+1 and beyond</li>
              </ul>
              <h4>Field Propagation Rules</h4>
              <p>
                <strong>Name:</strong> Propagates exactly to all future years. Used to identify the same physician across years.
              </p>
              <p>
                <strong>Salary:</strong> Propagates as a <em>minimum</em>. Future years use max(current_year_salary, source_salary). This allows salary increases over time while preventing decreases.
              </p>
              <p>
                <strong>Weeks Off:</strong> Propagates as a <em>minimum</em>. Future years use max(current_year_weeks, source_weeks). Allows increasing time off but not decreasing.
              </p>
              <p>
                <strong>Benefits and Bonuses:</strong> Do not propagate. Each year is independent.
              </p>
              <p>
                <strong>Medical Director Hours:</strong> Propagates for partners. The "Has Medical Director Hours" flag and percentage both propagate forward.
              </p>
              <p>
                <strong>Transitional Fields:</strong> Do not propagate (employeePortionOfYear, partnerPortionOfYear, etc.) - these are year-specific.
              </p>
              <h4>Removing a Physician</h4>
              <p>
                When you remove a physician from year N:
              </p>
              <ul>
                <li>The physician is removed from all years ≥ N</li>
                <li>Years prior to N are unaffected</li>
                <li>The system matches by both ID and name to ensure correct removal across years</li>
              </ul>
              <h4>Reordering Physicians</h4>
              <p>
                Physician order does NOT propagate. Each year maintains independent ordering. This allows you to sort physicians differently by year (e.g., alphabetical in 2025, by seniority in 2026).
              </p>
            </>
          )
        },
        {
          id: 'compensation-engine',
          title: 'Compensation Calculation Engine',
          content: (
            <>
              <p>
                The compensation engine is the core calculation logic that determines partner K-1 distributions and total compensation for all physicians.
              </p>
              <h4>Calculation Steps (High Level)</h4>
              <ol>
                <li><strong>Calculate Total Employee Costs:</strong> Sum of all employee salaries, benefits, payroll taxes, and bonuses (includes pro-rated amounts for partial-year employees)</li>
                <li><strong>Calculate Buyout Costs:</strong> One-time buyout payments for retiring partners</li>
                <li><strong>Calculate Delayed W2 Costs:</strong> Prior-year W2 payments for employeeToPartner transitions (paid in the year after transition)</li>
                <li><strong>Calculate Medical Director Allocations:</strong> Shared MD hours allocated by percentage to active partners + PRCS MD hours assigned to PRCS director + trailing MD amounts for prior-year retirees</li>
                <li><strong>Calculate Additional Days Worked:</strong> Internal locums coverage ($2,000 per day) for partners who work extra shifts</li>
                <li><strong>Calculate Total Income:</strong> Therapy income + shared MD hours + PRCS MD hours + consulting services</li>
                <li><strong>Calculate Total Costs:</strong> Non-employment costs + staff employment costs + locums + misc employment costs + total employee costs + buyouts + delayed W2</li>
                <li><strong>Calculate Base Pool:</strong> Total income - total costs</li>
                <li><strong>Calculate Distributable Pool:</strong> Base pool - total MD allocations - total additional days allocations (these are distributed separately)</li>
                <li><strong>Calculate Partner FTE Weights:</strong> For each partner: (52 - weeksOff) × partnerPortionOfYear, then normalize by total weight</li>
                <li><strong>Distribute Pool by FTE Weight:</strong> Each partner gets their FTE weight percentage of the distributable pool</li>
                <li><strong>Add Direct Allocations:</strong> Add to each partner: MD hours allocation + additional days worked + buyout (if retiring) + trailing MD (if prior-year retiree)</li>
                <li><strong>Final Partner K-1:</strong> Pool share + all direct allocations = total partner compensation</li>
              </ol>
              <p>
                <strong>Important Note:</strong> Partner benefits (medical/dental/vision insurance) are NOT individually tracked or subtracted from K-1 distributions. These costs are included in the practice's general overhead (non-employment costs or misc costs) and reduce the overall pool available for distribution.
              </p>
              <h4>Weeks Adjustment Logic</h4>
              <p>
                Partners with more vacation receive slightly less K-1 distribution:
              </p>
              <ul>
                <li>Calculate "working weeks" for each partner: (52 - weeksOff) * partnerPortionOfYear</li>
                <li>Sum total working weeks across all partners</li>
                <li>Each partner's share = (their working weeks) / (total working weeks)</li>
                <li>Multiply distributable income by each partner's share</li>
              </ul>
              <p>
                <strong>Example:</strong>
              </p>
              <ul>
                <li>Partner A: 8 weeks off = 44 working weeks = 44/130 = 33.85%</li>
                <li>Partner B: 10 weeks off = 42 working weeks = 42/130 = 32.31%</li>
                <li>Partner C: 8 weeks off = 44 working weeks = 44/130 = 33.85%</li>
                <li>Total: 130 working weeks</li>
              </ul>
              <h4>Pro-Rating for Transitional Physicians</h4>
              <p>
                For physicians with partial year status:
              </p>
              <ul>
                <li><strong>Employee to Partner:</strong> Employee portion receives pro-rated salary, partner portion receives pro-rated K-1</li>
                <li><strong>Partner to Retire:</strong> Partner portion receives pro-rated K-1, retirement portion receives trailing MD (if any)</li>
                <li><strong>New Employee:</strong> Salary pro-rated from start date</li>
                <li><strong>Employee to Terminate:</strong> Salary pro-rated to termination date</li>
              </ul>
              <h4>Benefits Calculation</h4>
              <p>
                Benefit costs are calculated based on type and eligibility:
              </p>
              <ul>
                <li><strong>Partners:</strong> Always receive benefits ($36,000 base + growth rate applied)</li>
                <li><strong>Employees:</strong> Receive benefits if "receivesBenefits" is enabled</li>
                <li><strong>Partial Year:</strong> Benefits are pro-rated based on portion of year</li>
              </ul>
              <h4>Real-Time Recalculation</h4>
              <p>
                Compensation is recalculated automatically whenever you change:
              </p>
              <ul>
                <li>Income or cost projections</li>
                <li>Physician details (salary, weeks off, type)</li>
                <li>Medical director hours amounts or allocations</li>
                <li>PRCS director selection</li>
                <li>Benefit cost parameters</li>
              </ul>
            </>
          )
        }
      ]
    },
    {
      id: 'data-sources',
      title: 'Data Sources & Integration',
      sections: [
        {
          id: 'qbo-integration',
          title: 'QuickBooks Online Integration',
          content: (
            <>
              <p>
                The dashboard integrates with QuickBooks Online (QBO) to fetch real-time financial data for the current fiscal year.
              </p>
              <h4>Data Fetched from QBO</h4>
              <ul>
                <li><strong>Daily Therapy Income:</strong> Total therapy revenue by date with site-specific breakdowns</li>
                <li><strong>Site Allocations:</strong> Income attributed to Lacey, Centralia, and Aberdeen locations</li>
                <li><strong>Year-to-Date Summaries:</strong> Aggregated income totals for comparison</li>
                <li><strong>Equity Partner Payments:</strong> K-1 distributions made to date</li>
              </ul>
              <h4>API Endpoints</h4>
              <p>
                The system uses a backend API (RadiantCare API) that interfaces with QBO:
              </p>
              <ul>
                <li><strong>/api/qbo/daily-therapy-income:</strong> Fetches daily income data with site breakdowns</li>
                <li><strong>/api/qbo/summary:</strong> Fetches aggregated summary metrics</li>
                <li><strong>/api/qbo/equity-payments:</strong> Fetches partner distribution records</li>
              </ul>
              <h4>Authentication</h4>
              <p>
                QBO integration requires OAuth 2.0 authentication:
              </p>
              <ul>
                <li>Backend API handles OAuth flow and token refresh</li>
                <li>Dashboard users do not need direct QBO access</li>
                <li>System uses service account credentials configured on backend</li>
              </ul>
              <h4>Caching Strategy</h4>
              <p>
                To reduce API calls and improve performance:
              </p>
              <ul>
                <li>QBO data is cached for 15 minutes</li>
                <li>Automatic refresh occurs after cache expires</li>
                <li>Manual refresh available via Sync button (bypasses cache)</li>
                <li>Cache is stored in browser session storage</li>
              </ul>
              <h4>Data Processing</h4>
              <p>
                Raw QBO data is processed client-side:
              </p>
              <ol>
                <li>Parse daily income records into time series format</li>
                <li>Allocate income to sites based on QBO account classifications</li>
                <li>Calculate cumulative income for chart display</li>
                <li>Normalize by working days (if normalization enabled)</li>
                <li>Apply smoothing (moving average) if configured</li>
              </ol>
            </>
          )
        },
        {
          id: 'historical-data',
          title: 'Historical Data (2016-2024)',
          content: (
            <>
              <p>
                Historical financial data from 2016-2024 is embedded in the application for comparison purposes.
              </p>
              <h4>Data Source</h4>
              <p>
                Historical data is stored in static JSON files within the application:
              </p>
              <ul>
                <li><strong>therapyIncomeParser.ts:</strong> Contains daily therapy income data for 2016-2024</li>
                <li><strong>defaults.ts:</strong> Contains annual summary data (total income, costs, physician rosters)</li>
              </ul>
              <h4>Data Structure</h4>
              <p>
                Historical data includes:
              </p>
              <ul>
                <li><strong>Daily Income:</strong> Date, cumulative income, site breakdowns (where available)</li>
                <li><strong>Annual Summaries:</strong> Total income, costs, employment costs, net income</li>
                <li><strong>Physician Rosters:</strong> Historical physician configurations by year</li>
              </ul>
              <h4>Data Quality Notes</h4>
              <ul>
                <li><strong>Site Data:</strong> Site-specific breakdowns are only available for recent years (2020+)</li>
                <li><strong>Working Days:</strong> Historical working days per year are calculated based on actual calendar data</li>
                <li><strong>Normalization:</strong> When normalization is enabled, income is divided by working days to enable fair comparison</li>
              </ul>
              <h4>Updating Historical Data</h4>
              <p>
                Historical data is static and does not update automatically. To update:
              </p>
              <ol>
                <li>Export data from QBO for the desired historical year</li>
                <li>Transform to the required JSON format</li>
                <li>Update the static data files in the codebase</li>
                <li>Rebuild and deploy the application</li>
              </ol>
            </>
          )
        },
        {
          id: 'database-storage',
          title: 'Database Storage (Supabase)',
          content: (
            <>
              <p>
                Saved scenarios, user accounts, and favorites are stored in a PostgreSQL database hosted on Supabase.
              </p>
              <h4>Database Tables</h4>
              <ul>
                <li><strong>users:</strong> User authentication and profile information (managed by Supabase Auth)</li>
                <li><strong>scenarios:</strong> Saved scenario data (Current Year Settings and Projection scenarios)</li>
                <li><strong>user_favorites:</strong> Junction table for favorite scenario relationships</li>
              </ul>
              <h4>Scenarios Table Schema</h4>
              <ul>
                <li><strong>id:</strong> UUID primary key</li>
                <li><strong>user_id:</strong> Foreign key to users table (owner)</li>
                <li><strong>name:</strong> Scenario name (text)</li>
                <li><strong>description:</strong> Optional description (text)</li>
                <li><strong>is_public:</strong> Public visibility flag (boolean)</li>
                <li><strong>scenario_type:</strong> "current_year" or "projection" (text)</li>
                <li><strong>view_mode:</strong> "YTD Detailed" or "Multi-Year" (text)</li>
                <li><strong>baseline_mode:</strong> "2024 Data", "2025 Data", or "Custom" (text, nullable)</li>
                <li><strong>baseline_date:</strong> Date when scenario was created (date)</li>
                <li><strong>qbo_sync_timestamp:</strong> Last QBO sync timestamp (timestamp, nullable)</li>
                <li><strong>year_2025_data:</strong> 2025 baseline data (JSONB, nullable)</li>
                <li><strong>custom_projected_values:</strong> Grid overrides (JSONB, nullable)</li>
                <li><strong>ytd_settings:</strong> Chart settings (JSONB, nullable)</li>
                <li><strong>projection_settings:</strong> Growth rates (JSONB, nullable)</li>
                <li><strong>future_years:</strong> 2026-2030 data (JSONB, nullable)</li>
                <li><strong>future_custom_values:</strong> Future year grid overrides (JSONB, nullable)</li>
                <li><strong>baseline_years:</strong> Custom baseline years (JSONB, nullable)</li>
                <li><strong>created_at:</strong> Creation timestamp (timestamp)</li>
                <li><strong>updated_at:</strong> Last update timestamp (timestamp)</li>
              </ul>
              <h4>Row Level Security (RLS)</h4>
              <p>
                Supabase RLS policies enforce data access controls:
              </p>
              <ul>
                <li><strong>Read:</strong> Users can read their own scenarios OR public scenarios</li>
                <li><strong>Insert:</strong> Users can create scenarios in their own account</li>
                <li><strong>Update:</strong> Users can update only their own scenarios</li>
                <li><strong>Delete:</strong> Users can delete only their own scenarios</li>
              </ul>
              <h4>Favorites Table Schema</h4>
              <ul>
                <li><strong>id:</strong> UUID primary key</li>
                <li><strong>user_id:</strong> Foreign key to users table</li>
                <li><strong>scenario_id:</strong> Foreign key to scenarios table</li>
                <li><strong>favorite_type:</strong> "A", "B", or "current" (which slot is favorited)</li>
              </ul>
              <p>
                Unique constraint ensures one favorite per user per type (can't have two "A" favorites).
              </p>
            </>
          )
        },
        {
          id: 'local-storage',
          title: 'Browser Local Storage',
          content: (
            <>
              <p>
                The dashboard uses browser local storage to persist state across sessions, providing continuity when you close and reopen the application.
              </p>
              <h4>What's Stored Locally</h4>
              <ul>
                <li><strong>Current State:</strong> All dashboard state (physicians, projections, settings) via Zustand persist middleware</li>
                <li><strong>Loaded Scenario Snapshots:</strong> Copies of loaded scenarios for dirty detection</li>
                <li><strong>QBO Cache:</strong> Cached QBO data with timestamp for cache management</li>
                <li><strong>Last View Mode:</strong> Which view (YTD Detailed or Multi-Year) was active</li>
              </ul>
              <h4>Storage Key</h4>
              <p>
                All dashboard state is stored under the key:
              </p>
              <ul>
                <li><strong>radiantcare-dashboard-storage:</strong> Main state object (JSON)</li>
              </ul>
              <h4>Persistence Behavior</h4>
              <ul>
                <li><strong>Automatic Save:</strong> State is saved to local storage automatically whenever it changes</li>
                <li><strong>Automatic Load:</strong> State is restored from local storage on page load</li>
                <li><strong>Session Continuity:</strong> Your work is preserved even if you close the browser tab</li>
              </ul>
              <h4>Clearing Local Storage</h4>
              <p>
                You can clear local storage to reset to defaults:
              </p>
              <ol>
                <li>Open browser developer tools (F12)</li>
                <li>Go to Application → Local Storage</li>
                <li>Delete "radiantcare-dashboard-storage" key</li>
                <li>Refresh the page</li>
              </ol>
              <p>
                Note: This will reset your current state but will NOT delete saved scenarios (those are in the database).
              </p>
              <h4>Data Size Limits</h4>
              <p>
                Browser local storage typically has a 5-10 MB limit per domain. The dashboard state is well within this limit (typically &lt; 500 KB).
              </p>
            </>
          )
        }
      ]
    },
    {
      id: 'technical',
      title: 'Technical Architecture',
      sections: [
        {
          id: 'tech-stack',
          title: 'Technology Stack',
          content: (
            <>
              <p>
                The dashboard is built using modern web technologies optimized for performance and developer experience.
              </p>
              <h4>Frontend Framework</h4>
              <ul>
                <li><strong>React 18:</strong> Component-based UI framework with hooks and concurrent features</li>
                <li><strong>TypeScript:</strong> Type-safe JavaScript for better code quality and IDE support</li>
                <li><strong>Vite:</strong> Fast build tool and development server</li>
              </ul>
              <h4>State Management</h4>
              <ul>
                <li><strong>Zustand:</strong> Lightweight state management with immer middleware for immutable updates</li>
                <li><strong>Zustand Persist:</strong> Automatic local storage persistence</li>
              </ul>
              <h4>Data Visualization</h4>
              <ul>
                <li><strong>Recharts:</strong> React charting library built on D3 primitives</li>
                <li><strong>Custom Chart Components:</strong> Specialized implementations for income tracking and projections</li>
              </ul>
              <h4>Backend & Database</h4>
              <ul>
                <li><strong>Supabase:</strong> PostgreSQL database with real-time subscriptions and authentication</li>
                <li><strong>Supabase Auth:</strong> Email/password authentication with JWT tokens</li>
                <li><strong>Row Level Security:</strong> PostgreSQL RLS for fine-grained access control</li>
              </ul>
              <h4>UI Components</h4>
              <ul>
                <li><strong>Font Awesome:</strong> Icon library for UI elements</li>
                <li><strong>Custom CSS:</strong> Styled inline and via CSS modules</li>
                <li><strong>Responsive Design:</strong> Mobile-friendly layouts with breakpoints</li>
              </ul>
              <h4>Build & Deployment</h4>
              <ul>
                <li><strong>npm:</strong> Package management</li>
                <li><strong>Vite Build:</strong> Production bundling with code splitting</li>
                <li><strong>Environment Variables:</strong> Configuration for different environments (dev, production)</li>
              </ul>
            </>
          )
        },
        {
          id: 'component-architecture',
          title: 'Component Architecture',
          content: (
            <>
              <p>
                The application follows a modular component architecture with clear separation of concerns.
              </p>
              <h4>Top-Level Components</h4>
              <ul>
                <li><strong>App.tsx:</strong> Root component wrapping AuthProvider and Dashboard</li>
                <li><strong>AuthProvider:</strong> Handles authentication state and user session</li>
                <li><strong>Dashboard:</strong> Main dashboard container with global state (Zustand store)</li>
              </ul>
              <h4>View Components</h4>
              <ul>
                <li><strong>YTDDetailed:</strong> Current year detailed view with chart, grid, and physicians</li>
                <li><strong>YTDDetailedMobile:</strong> Mobile-optimized version of YTD view</li>
                <li><strong>MultiYearView:</strong> Multi-year projection view with scenario comparison</li>
              </ul>
              <h4>Shared Components</h4>
              <ul>
                <li><strong>PhysiciansEditor:</strong> Reusable physician roster management (used in both views)</li>
                <li><strong>YearPanel:</strong> Year-specific configuration panel (used in Multi-Year view)</li>
                <li><strong>OverallCompensationSummary:</strong> Partner compensation display (used in both views)</li>
                <li><strong>WorkforceAnalysis:</strong> Physician workforce metrics over time</li>
                <li><strong>ProjectionSettingsControls:</strong> Growth rate configuration (Multi-Year view)</li>
                <li><strong>CollapsibleSection:</strong> Expandable/collapsible UI sections</li>
              </ul>
              <h4>YTD-Specific Components</h4>
              <ul>
                <li><strong>DetailedChart:</strong> Interactive income chart with historical comparison</li>
                <li><strong>ChartControls:</strong> Chart customization controls (normalization, smoothing, etc.)</li>
                <li><strong>YearlyDataGrid:</strong> P&L grid with editable projections</li>
                <li><strong>PartnerCompensation:</strong> Real-time partner compensation panel</li>
                <li><strong>SyncButton:</strong> QuickBooks sync trigger</li>
                <li><strong>ProjectedValueSlider:</strong> Slider for manual projection overrides</li>
                <li><strong>ColorSchemeSelector:</strong> Chart color palette selector</li>
                <li><strong>NavigationControls:</strong> Chart navigation (timeframe, year selection)</li>
              </ul>
              <h4>Multi-Year Specific Components</h4>
              <ul>
                <li><strong>HistoricAndProjectionChart:</strong> Combined historical and projection timeline</li>
                <li><strong>ParametersSummary:</strong> Compact year parameters display</li>
              </ul>
              <h4>Scenario Management Components</h4>
              <ul>
                <li><strong>ScenarioManager:</strong> Main scenario load/save/edit modal</li>
                <li><strong>ScenarioList:</strong> List of saved scenarios with filter and actions</li>
                <li><strong>ScenarioCard:</strong> Individual scenario card with metadata</li>
                <li><strong>ScenarioForm:</strong> Create/edit scenario form</li>
                <li><strong>ModularScenarioSaveDialog:</strong> Save dialog for modular scenarios</li>
                <li><strong>ScenarioLoadModal:</strong> Load dialog with tabs and filtering</li>
                <li><strong>BaselineWarningModal:</strong> Warning when changing baseline mode</li>
              </ul>
              <h4>Shared Utilities</h4>
              <ul>
                <li><strong>ShareLinkButton:</strong> Generate and display shareable links</li>
                <li><strong>ShareLinkModal:</strong> Modal for copying share links</li>
                <li><strong>SharedLinkWarningModal:</strong> Warning when loading from shared link</li>
                <li><strong>MobileWarningModal:</strong> Warning for mobile users</li>
              </ul>
            </>
          )
        },
        {
          id: 'state-management',
          title: 'State Management Details',
          content: (
            <>
              <p>
                The dashboard uses Zustand for global state management with a centralized store in Dashboard.tsx.
              </p>
              <h4>Store Structure</h4>
              <p>
                The main store (useDashboardStore) contains:
              </p>
              <ul>
                <li><strong>historic:</strong> Historical data (2016-2024)</li>
                <li><strong>scenarioA:</strong> Primary scenario (Multi-Year mode) or null</li>
                <li><strong>scenarioB:</strong> Comparison scenario (Multi-Year mode) or null</li>
                <li><strong>scenarioBEnabled:</strong> Whether Scenario B is active</li>
                <li><strong>ytdData:</strong> Current year (2025) baseline data</li>
                <li><strong>ytdCustomProjectedValues:</strong> Manual grid overrides for 2025</li>
                <li><strong>currentScenarioId/Name/UserId:</strong> Loaded scenario metadata</li>
                <li><strong>currentYearSettingId/Name/UserId:</strong> Loaded Current Year Settings metadata</li>
                <li><strong>currentProjectionId/Name/UserId:</strong> Loaded Projection metadata</li>
                <li><strong>loadedScenarioSnapshot:</strong> Snapshot for dirty detection (Scenario A)</li>
                <li><strong>loadedScenarioBSnapshot:</strong> Snapshot for dirty detection (Scenario B)</li>
                <li><strong>loadedCurrentYearSettingsSnapshot:</strong> Snapshot for dirty detection (Current Year Settings)</li>
                <li><strong>loadedProjectionSnapshot:</strong> Snapshot for dirty detection (Projection)</li>
                <li><strong>expectedProjectionSnapshotA/B:</strong> Expected state after loading (for validation)</li>
              </ul>
              <h4>Store Actions</h4>
              <p>
                The store provides actions for modifying state:
              </p>
              <ul>
                <li><strong>setScenarioEnabled:</strong> Enable/disable Scenario B</li>
                <li><strong>setPrcsDirector:</strong> Set PRCS director for a scenario and year</li>
                <li><strong>setFutureValue:</strong> Set a financial parameter for a future year</li>
                <li><strong>setYtdValue:</strong> Set a financial parameter for current year</li>
                <li><strong>upsertPhysician:</strong> Add or update a physician in a scenario and year</li>
                <li><strong>removePhysician:</strong> Remove a physician from a scenario and year</li>
                <li><strong>reorderPhysicians:</strong> Reorder physicians in a scenario and year</li>
                <li><strong>upsertYtdPhysician:</strong> Add or update a physician in current year</li>
                <li><strong>removeYtdPhysician:</strong> Remove a physician from current year</li>
                <li><strong>reorderYtdPhysicians:</strong> Reorder current year physicians</li>
                <li><strong>setYtdPrcsDirector:</strong> Set PRCS director for current year</li>
                <li><strong>setPrcsMdHoursMode:</strong> Set PRCS MD hours calculation mode</li>
                <li><strong>setProjectionField:</strong> Set a projection setting (growth rate, etc.)</li>
                <li><strong>recomputeProjectionsFromBaseline:</strong> Recalculate future years from baseline</li>
              </ul>
              <h4>Immer Middleware</h4>
              <p>
                The store uses immer middleware for immutable updates:
              </p>
              <ul>
                <li>Actions can directly mutate the draft state</li>
                <li>Immer produces an immutable updated state</li>
                <li>This simplifies complex nested updates (e.g., physician arrays)</li>
              </ul>
              <h4>Persist Middleware</h4>
              <p>
                The store uses persist middleware for local storage:
              </p>
              <ul>
                <li>State is automatically saved to local storage on every update</li>
                <li>State is restored from local storage on page load</li>
                <li>Custom serialization handles complex objects (physicians, projections)</li>
              </ul>
            </>
          )
        },
        {
          id: 'logging-system',
          title: 'Logging System',
          content: (
            <>
              <p>
                The application includes a comprehensive logging system for debugging and auditing.
              </p>
              <h4>Logger API</h4>
              <p>
                The logger is accessed via the global logger instance:
              </p>
              <ul>
                <li><strong>logger.debug(category, message, data):</strong> Debug-level logs (hidden by default)</li>
                <li><strong>logger.info(category, message, data):</strong> Info-level logs</li>
                <li><strong>logger.warn(category, message, data):</strong> Warning-level logs</li>
                <li><strong>logger.error(category, message, data):</strong> Error-level logs</li>
              </ul>
              <h4>Log Categories</h4>
              <p>
                Logs are organized by category for filtering:
              </p>
              <ul>
                <li><strong>STORE:</strong> State management operations</li>
                <li><strong>SCENARIO:</strong> Scenario loading, saving, dirty detection</li>
                <li><strong>PHYSICIAN:</strong> Physician add/edit/remove operations</li>
                <li><strong>MD_HOURS:</strong> Medical director hours allocation and redistribution</li>
                <li><strong>COMPENSATION:</strong> Compensation calculations</li>
                <li><strong>QBO:</strong> QuickBooks sync and data fetching</li>
                <li><strong>CHART:</strong> Chart rendering and data processing</li>
                <li><strong>GRID:</strong> P&L grid interactions</li>
              </ul>
              <h4>Admin Logging Controls</h4>
              <p>
                Users with the "admin" role have access to advanced logging controls:
              </p>
              <ul>
                <li><strong>Enable/Disable Logging:</strong> Toggle logging on/off globally</li>
                <li><strong>Set Log Level:</strong> Choose minimum level (debug, info, warn, error)</li>
                <li><strong>Category Filters:</strong> Enable/disable specific categories</li>
                <li><strong>View Logs:</strong> Display recent logs in a modal</li>
                <li><strong>Download Logs:</strong> Export logs as JSON for analysis</li>
              </ul>
              <h4>Admin Panel Access</h4>
              <p>
                To access logging controls:
              </p>
              <ol>
                <li>Click the shield icon (admin) in the header</li>
                <li>Toggle logging on/off</li>
                <li>Configure log level and categories</li>
                <li>View or download logs as needed</li>
              </ol>
              <p>
                Note: Only users with the "admin" role (set in Supabase user metadata) can access the logging controls.
              </p>
            </>
          )
        }
      ]
    },
    {
      id: 'tips',
      title: 'Tips & Best Practices',
      sections: [
        {
          id: 'workflow-tips',
          title: 'Recommended Workflows',
          content: (
            <>
              <h4>Daily/Weekly Review Workflow</h4>
              <ol>
                <li><strong>Open YTD Detailed View</strong></li>
                <li><strong>Sync QBO Data:</strong> Click sync button to refresh current year data</li>
                <li><strong>Review Chart:</strong> Compare current year performance to historical trends</li>
                <li><strong>Check Compensation:</strong> Review projected partner compensation in the right panel</li>
                <li><strong>Adjust Projections:</strong> Update projected values in the grid if needed</li>
                <li><strong>Save Changes:</strong> If you made adjustments, save as a Current Year Settings scenario</li>
              </ol>
              <h4>Strategic Planning Workflow</h4>
              <ol>
                <li><strong>Switch to Multi-Year View</strong></li>
                <li><strong>Load Baseline:</strong> Ensure 2025 baseline is accurate (or load a saved Current Year Settings scenario)</li>
                <li><strong>Configure Projections:</strong> Set income growth, cost growth, and MD hours amounts in projection settings</li>
                <li><strong>Plan Workforce:</strong> Add/edit physicians in future years (2026-2030) to model hires, retirements, promotions</li>
                <li><strong>Review Chart:</strong> Examine the historic and projection chart to spot trends</li>
                <li><strong>Check Workforce Analysis:</strong> Ensure adequate staffing across all years</li>
                <li><strong>Save Projection:</strong> Save as a Projection scenario</li>
              </ol>
              <h4>Scenario Comparison Workflow</h4>
              <ol>
                <li><strong>Open Multi-Year View</strong></li>
                <li><strong>Load Scenario A:</strong> Load your primary projection scenario</li>
                <li><strong>Enable Scenario B:</strong> Click "Enable Scenario B" and load an alternative projection</li>
                <li><strong>Review Chart:</strong> Compare the two scenarios visually on the chart</li>
                <li><strong>Compare Year-by-Year:</strong> Click through year tabs to see detailed differences</li>
                <li><strong>Analyze Outcomes:</strong> Compare average partner compensation, net income trends, etc.</li>
                <li><strong>Choose Best Scenario:</strong> Decide which scenario to pursue based on comparison</li>
              </ol>
            </>
          )
        },
        {
          id: 'performance-tips',
          title: 'Performance Optimization',
          content: (
            <>
              <h4>Chart Rendering Performance</h4>
              <ul>
                <li><strong>Reduce Smoothing:</strong> Lower smoothing values render faster (fewer data points)</li>
                <li><strong>Hide Unused Years:</strong> Uncheck historical years you're not comparing to reduce chart complexity</li>
                <li><strong>Use Bar Mode Sparingly:</strong> Bar charts render more slowly than line charts with many data points</li>
              </ul>
              <h4>Data Sync Performance</h4>
              <ul>
                <li><strong>Respect Cache:</strong> Wait 15 minutes between syncs unless you need real-time data</li>
                <li><strong>Avoid Repeated Syncs:</strong> Multiple syncs in quick succession don't provide additional accuracy</li>
              </ul>
              <h4>Scenario Load Performance</h4>
              <ul>
                <li><strong>Limit Scenario Count:</strong> Delete old scenarios you no longer need to improve load modal performance</li>
                <li><strong>Use Favorites:</strong> Favorite your most-used scenarios for quick access (avoids scrolling)</li>
              </ul>
              <h4>Browser Performance</h4>
              <ul>
                <li><strong>Close Unused Tabs:</strong> The dashboard is memory-intensive; close other tabs for best performance</li>
                <li><strong>Use Modern Browsers:</strong> Chrome, Firefox, Safari, or Edge (latest versions)</li>
                <li><strong>Clear Cache Periodically:</strong> Clear browser cache if you notice slowdowns</li>
              </ul>
            </>
          )
        },
        {
          id: 'common-mistakes',
          title: 'Common Mistakes to Avoid',
          content: (
            <>
              <h4>Scenario Management Mistakes</h4>
              <ul>
                <li><strong>Not Saving Before Loading:</strong> Always save changes before loading a new scenario, or you'll lose your work</li>
                <li><strong>Wrong Scenario Type:</strong> Use Current Year Settings for baseline, Projection for 5-year plans - don't confuse the two</li>
                <li><strong>Forgetting to Make Public:</strong> If you want to share a scenario, remember to toggle "Public" before saving</li>
                <li><strong>Not Using Favorites:</strong> Set favorites to automatically load your preferred scenarios</li>
              </ul>
              <h4>Physician Modeling Mistakes</h4>
              <ul>
                <li><strong>MD Hours Not Summing to 100%:</strong> Ensure all active partners' MD hours percentages sum to 100%</li>
                <li><strong>Forgetting Transitional Types:</strong> Use "Employee to Partner" or "Partner to Retire" for mid-year transitions, not manual pro-rating</li>
                <li><strong>Removing Instead of Retiring:</strong> Use "Partner to Retire" type instead of deleting a retiring partner (preserves buyout and trailing MD)</li>
                <li><strong>Not Propagating Salary Increases:</strong> Remember that salary changes propagate as minimums - future years can have higher salaries</li>
              </ul>
              <h4>Projection Mistakes</h4>
              <ul>
                <li><strong>Unrealistic Growth Rates:</strong> Use conservative, evidence-based growth assumptions (4-7% income, 5-8% costs)</li>
                <li><strong>Forgetting Inflation:</strong> Cost growth should typically exceed income growth (inflation impact)</li>
                <li><strong>Not Accounting for Retirements:</strong> Plan replacement hires before partners retire to maintain capacity</li>
                <li><strong>Ignoring Benefit Cost Growth:</strong> Benefit costs grow faster than general inflation (7-9% typical)</li>
              </ul>
              <h4>Chart Interpretation Mistakes</h4>
              <ul>
                <li><strong>Not Using Normalization:</strong> Always enable normalization when comparing years with different working days</li>
                <li><strong>Over-smoothing:</strong> Too much smoothing hides important day-to-day variation</li>
                <li><strong>Comparing Non-Comparable Years:</strong> Be aware of one-time events (acquisitions, new services, etc.) that make years non-comparable</li>
              </ul>
            </>
          )
        },
        {
          id: 'troubleshooting',
          title: 'Troubleshooting',
          content: (
            <>
              <h4>Sync Issues</h4>
              <p>
                <strong>Problem:</strong> Sync button shows an error or data doesn't update.
              </p>
              <p>
                <strong>Solutions:</strong>
              </p>
              <ul>
                <li>Check your internet connection</li>
                <li>Wait a few minutes and try again (QBO API may be temporarily down)</li>
                <li>Contact support if the issue persists (email link in help modal)</li>
              </ul>
              <h4>Chart Not Rendering</h4>
              <p>
                <strong>Problem:</strong> Chart appears blank or shows loading indefinitely.
              </p>
              <p>
                <strong>Solutions:</strong>
              </p>
              <ul>
                <li>Refresh the page (Ctrl+R or Cmd+R)</li>
                <li>Clear browser cache and reload</li>
                <li>Check browser console for errors (F12 → Console)</li>
                <li>Try a different browser to rule out browser-specific issues</li>
              </ul>
              <h4>Compensation Calculations Seem Wrong</h4>
              <p>
                <strong>Problem:</strong> Partner compensation doesn't match your expectations.
              </p>
              <p>
                <strong>Solutions:</strong>
              </p>
              <ul>
                <li>Check that all physicians are correctly configured (types, salaries, MD hours)</li>
                <li>Verify that MD hours percentages sum to 100%</li>
                <li>Ensure income and cost projections are reasonable</li>
                <li>Check for prior year retirees with trailing MD amounts (reduces active partner pool)</li>
                <li>Enable admin logging and review COMPENSATION logs for detailed breakdown</li>
              </ul>
              <h4>Can't Save Scenario</h4>
              <p>
                <strong>Problem:</strong> Save button shows an error or scenario doesn't appear in list.
              </p>
              <p>
                <strong>Solutions:</strong>
              </p>
              <ul>
                <li>Ensure you're logged in (check header for user email)</li>
                <li>Check that scenario name is not empty</li>
                <li>Verify you have internet connection (saves to database)</li>
                <li>Try saving with a different name (possible name conflict)</li>
                <li>Refresh the page and try again</li>
              </ul>
              <h4>Lost Work / Changes Disappeared</h4>
              <p>
                <strong>Problem:</strong> Changes you made are no longer visible.
              </p>
              <p>
                <strong>Solutions:</strong>
              </p>
              <ul>
                <li>Check if you accidentally loaded a different scenario (overwrites current state)</li>
                <li>Look for your changes in local storage (may be recoverable)</li>
                <li>Check if you have unsaved dirty state (yellow dot)</li>
                <li>In the future, save frequently to avoid data loss</li>
              </ul>
              <h4>Shared Link Not Working</h4>
              <p>
                <strong>Problem:</strong> Recipient can't access shared link or sees wrong data.
              </p>
              <p>
                <strong>Solutions:</strong>
              </p>
              <ul>
                <li>Verify all scenarios in the link are marked as Public</li>
                <li>Ensure recipient is logged in (shared links require authentication)</li>
                <li>Check that the link was copied completely (no truncation)</li>
                <li>Re-generate the link and try again</li>
              </ul>
            </>
          )
        }
      ]
    }
  ]

  const selectedChapter = chapters.find(c => c.id === selectedChapterId) || chapters[0]
  const selectedSection = selectedChapter.sections.find(s => s.id === selectedSectionId) || selectedChapter.sections[0]

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#fff',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 30px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: '#7c2a83',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 600,
              borderRadius: 6,
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3e8ff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            title="Back to Dashboard"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Back to Dashboard</span>
          </button>
        </div>
        <h1 style={{
          margin: 0,
          color: '#7c2a83',
          fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif',
          fontSize: 28,
          fontWeight: 900,
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)'
        }}>
          Comprehensive Help Guide
        </h1>
        <div style={{ width: 180 }}>{/* Spacer for centering */}</div>
      </div>

      {/* Main Content Area */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
            {/* Left Sidebar - Chapter Navigation */}
            <div style={{
              width: 250,
              borderRight: '1px solid #e5e7eb',
              overflowY: 'auto',
              backgroundColor: '#f9fafb'
            }}>
              {chapters.map(chapter => (
                <div key={chapter.id}>
                  <button
                    onClick={() => {
                      setSelectedChapterId(chapter.id)
                      setSelectedSectionId(chapter.sections[0].id)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 20px',
                      border: 'none',
                      backgroundColor: selectedChapterId === chapter.id ? '#7c2a83' : 'transparent',
                      color: selectedChapterId === chapter.id ? '#fff' : '#374151',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: selectedChapterId === chapter.id ? 600 : 500,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedChapterId !== chapter.id) {
                        e.currentTarget.style.backgroundColor = '#e5e7eb'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedChapterId !== chapter.id) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    {chapter.title}
                  </button>
                  {selectedChapterId === chapter.id && (
                    <div style={{ backgroundColor: '#fff' }}>
                      {chapter.sections.map(section => (
                        <button
                          key={section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          style={{
                            width: '100%',
                            padding: '8px 20px 8px 40px',
                            border: 'none',
                            backgroundColor: selectedSectionId === section.id ? '#f3e8ff' : 'transparent',
                            color: selectedSectionId === section.id ? '#7c2a83' : '#6b7280',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: selectedSectionId === section.id ? 600 : 400,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}
                          onMouseEnter={(e) => {
                            if (selectedSectionId !== section.id) {
                              e.currentTarget.style.backgroundColor = '#f3f4f6'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedSectionId !== section.id) {
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }
                          }}
                        >
                          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 10 }} />
                          {section.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

        {/* Right Content Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '40px 60px'
        }}>
          <h2 style={{
            margin: '0 0 24px 0',
            color: '#7c2a83',
            fontSize: 26,
            fontWeight: 700,
            textAlign: 'left'
          }}>
            {selectedSection.title}
          </h2>
          <div style={{
            lineHeight: 1.8,
            color: '#374151',
            fontSize: 15,
            textAlign: 'left',
            maxWidth: 900
          }}>
            {selectedSection.content}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '15px 30px',
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Navigate using the sidebar or scroll through the content
        </div>
        <button
          onClick={() => {
            window.location.href = 'mailto:connor@radiantcare.com?subject=Compensation Dashboard Support'
          }}
          style={{
            padding: '8px 16px',
            border: '1px solid #7c2a83',
            borderRadius: 6,
            backgroundColor: '#fff',
            color: '#7c2a83',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fff'
          }}
        >
          Contact Support
        </button>
      </div>
    </div>
  )
}
