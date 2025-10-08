interface BaselineWarningModalProps {
  isOpen: boolean
  scenarioName: string
  baselineMode: string
  baselineDate: string
  onConfirm: (loadBaseline: boolean) => void
  onCancel: () => void
}

export default function BaselineWarningModal({
  isOpen,
  scenarioName,
  baselineMode,
  baselineDate,
  onConfirm,
  onCancel,
}: BaselineWarningModalProps) {
  if (!isOpen) return null

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001, // Above ScenarioManager (10000)
        animation: 'fadeIn 0.2s ease-in',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff',
          padding: '32px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          maxWidth: '500px',
          width: '100%',
          animation: 'slideIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600, color: '#111' }}>
            ⚠️ Loading Scenario into B
          </h3>
          
          <div style={{ 
            padding: '16px', 
            background: '#fef3c7', 
            border: '1px solid #fbbf24',
            borderRadius: '6px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '14px', color: '#92400e', fontWeight: 500, marginBottom: '8px' }}>
              This scenario includes a baseline:
            </div>
            <div style={{ fontSize: '14px', color: '#78350f' }}>
              • <strong>{baselineMode}</strong> from {formatDate(baselineDate)}
            </div>
          </div>

          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#4b5563', lineHeight: 1.6 }}>
            The scenario "<strong>{scenarioName}</strong>" contains baseline data that could affect both
            Scenario A and Scenario B.
          </p>

          <div style={{ 
            background: '#f3f4f6', 
            padding: '16px', 
            borderRadius: '6px',
            fontSize: '14px',
            lineHeight: 1.6,
            color: '#374151'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>Choose how to load:</div>
            
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ color: '#059669', fontWeight: 500 }}>✓ Load Baseline</div>
              </div>
              <div style={{ marginLeft: '24px', color: '#6b7280', fontSize: '13px' }}>
                Replaces Scenario A's baseline with this one (affects both A and B)
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ color: '#0369a1', fontWeight: 500 }}>○ Projections Only</div>
              </div>
              <div style={{ marginLeft: '24px', color: '#6b7280', fontSize: '13px' }}>
                Keeps Scenario A's current baseline, loads only the projection settings into B
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              background: '#fff',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(false)}
            style={{
              padding: '10px 20px',
              background: '#fff',
              color: '#0369a1',
              border: '1px solid #0369a1',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Projections Only
          </button>
          <button
            onClick={() => onConfirm(true)}
            style={{
              padding: '10px 20px',
              background: '#059669',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Load Baseline
          </button>
        </div>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  )
}

