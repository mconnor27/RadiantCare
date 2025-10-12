interface MobileWarningModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function MobileWarningModal({
  isOpen,
  onClose
}: MobileWarningModalProps) {
  if (!isOpen) return null

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
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease-in',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          maxWidth: '500px',
          width: '100%',
          padding: '24px',
          animation: 'slideIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          📱 Mobile View
        </h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.5', color: '#333', textAlign: 'left' }}>
          Welcome! On mobile devices, functionality is limited to <strong>loading and viewing Year-To-Date scenarios only</strong>.
        </p>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', lineHeight: '1.5', color: '#666', textAlign: 'left' }}>
          For full features including editing, projections, and multi-year analysis, please visit the desktop version.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#7c2a83',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Got it
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
