interface SharedLinkWarningModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function SharedLinkWarningModal({
  isOpen,
  onConfirm,
  onCancel
}: SharedLinkWarningModalProps) {
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
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          maxWidth: '500px',
          width: '90%',
          padding: '24px',
          animation: 'slideIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
          ⚠️ Load Shared Link?
        </h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.5', color: '#333', textAlign: 'left' }}>
          Loading this shared link will replace your current view and any unsaved changes.
        </p>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', lineHeight: '1.5', color: '#666', textAlign: 'left' }}>
          Make sure to save your current work before proceeding.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              background: '#fff',
              color: '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              background: '#0ea5e9',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Load Shared Link
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
