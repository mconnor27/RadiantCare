interface QuickHelpModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenFullGuide: () => void
}

export default function QuickHelpModal({ isOpen, onClose, onOpenFullGuide }: QuickHelpModalProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Dimmed Background Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Modal Content */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 40,
            maxWidth: 800,
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 10px 20px rgba(0, 0, 0, 0.2)',
          }}
        >
          <h2 style={{
            margin: '0 0 20px 0',
            color: '#7c2a83',
            fontFamily: '"Myriad Pro", Myriad, "Helvetica Neue", Arial, sans-serif',
            fontSize: 28,
            fontWeight: 900
          }}>
            Compensation Dashboard Help
          </h2>

          <div style={{ lineHeight: 1.6, color: '#333', textAlign: 'left' }}>
            <h3 style={{ color: '#7c2a83', marginTop: 0 }}>Overview</h3>
            <p>
              The RadiantCare Compensation Dashboard is a financial planning tool designed to project
              and analyze physician compensation across multiple years. It allows you to model different
              scenarios, adjust key financial parameters, and visualize the impact on compensation.
            </p>

            <h3 style={{ color: '#7c2a83', marginTop: 24 }}>Two Main Views</h3>

            <h4 style={{ marginTop: 16, marginBottom: 8 }}>YTD Detailed View</h4>
            <p>
              This view focuses on the current year with detailed day-to-day tracking. It includes:
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>Real-time data synchronization with QuickBooks Online</li>
              <li>Actual year-to-date as well as projected physician compensation</li>
              <li>Interactive and customizable charts showing income trends with historical comparison</li>
              <li>Site-specific breakdowns (Lacey, Centralia, Aberdeen)</li>
              <li>Ability to adjust physician details, salaries, and benefits</li>
              <li>Interactive P&L sheet showing historical data as well as projected data</li>
            </ul>

            <h4 style={{ marginTop: 16, marginBottom: 8 }}>Multi-Year View</h4>
            <p>
              This view provides long-term projections (current year plus 5 years). It features:
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>Year-by-year financial projections</li>
              <li>Adjustable growth rates for income, costs, and employment expenses</li>
              <li>Physician roster planning (hires, retirements, promotions)</li>
              <li>Side-by-side scenario comparison (Scenario A vs Scenario B)</li>
              <li>Medical director hours and consulting services allocation</li>
            </ul>

            <h3 style={{ color: '#7c2a83', marginTop: 24 }}>Saved Scenarios</h3>
            <p>
              Save and manage different planning scenarios to explore various financial outcomes:
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li><strong>Scenario Types:</strong> "Current Year Settings" scenarios save 2025 baseline parameters (physicians, income, costs). "Projection" scenarios save 5-year projections, growth assumptions, and physician roster changes</li>
              <li><strong>Save Scenarios:</strong> Save your current configuration with a custom name and description</li>
              <li><strong>Load Scenarios:</strong> Access your saved scenarios or browse public scenarios shared by others</li>
              <li><strong>Public vs Private:</strong> Mark scenarios as public to share with other users, or keep them private</li>
              <li><strong>Favorites:</strong> Favorite your most-used scenarios for quick access</li>
              <li><strong>Multi-Year Comparisons:</strong> Load two projection scenarios side-by-side (Scenario A vs Scenario B) to compare different planning approaches</li>
            </ul>

            <h3 style={{ color: '#7c2a83', marginTop: 24 }}>Sharing Links</h3>
            <p>
              Generate shareable URLs that preserve your exact configuration:
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li><strong>Share Button:</strong> Click the link icon to create a shareable URL</li>
              <li><strong>What's Included:</strong> Links preserve loaded scenarios, chart settings, and all view configurations</li>
              <li><strong>Requirements:</strong> Scenarios must be saved and marked as public before sharing</li>
              <li><strong>Recipient Access:</strong> Anyone with the link can view the configuration (login required)</li>
            </ul>

            <h3 style={{ color: '#7c2a83', marginTop: 24 }}>Getting Started</h3>
            <ol style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>Choose between "YTD Detailed" and "Multi-Year" views using the tabs</li>
              <li>Review the default projections and adjust parameters as needed</li>
              <li>Modify physician details, growth rates, and other financial assumptions</li>
              <li>Save your configuration as a scenario for future reference</li>
              <li>Share your scenarios with colleagues using shareable links</li>
            </ol>
          </div>

          <div style={{
            display: 'flex',
            gap: 12,
            marginTop: 32,
            justifyContent: 'space-between',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => {
                onClose()
                onOpenFullGuide()
              }}
              style={{
                padding: '10px 20px',
                border: '1px solid #7c2a83',
                borderRadius: 6,
                backgroundColor: '#7c2a83',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#651f6b'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#7c2a83'
              }}
            >
              View Full Help Guide
            </button>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  window.location.href = 'mailto:connor@radiantcare.com?subject=Compensation Dashboard Support'
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #7c2a83',
                  borderRadius: 6,
                  backgroundColor: '#fff',
                  color: '#7c2a83',
                  cursor: 'pointer',
                  fontSize: 14,
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
              <button
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: 6,
                  backgroundColor: '#7c2a83',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#651f6b'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#7c2a83'
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
