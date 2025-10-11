import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShare } from '@fortawesome/free-solid-svg-icons'
import ShareLinkModal from './ShareLinkModal'

interface ShareLinkButtonProps {
  viewMode: 'YTD Detailed' | 'Multi-Year'
  scenarioAId: string | null
  scenarioAIsPublic: boolean
  scenarioBId: string | null
  scenarioBIsPublic: boolean
  scenarioBEnabled: boolean
  isScenarioDirty: boolean
  isScenarioBDirty: boolean
  uiSettings: any
  onLinkCreated?: (url: string) => void
}

export default function ShareLinkButton({
  viewMode,
  scenarioAId,
  scenarioAIsPublic,
  scenarioBId,
  scenarioBIsPublic,
  scenarioBEnabled,
  isScenarioDirty,
  isScenarioBDirty,
  uiSettings,
  onLinkCreated
}: ShareLinkButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [warningType, setWarningType] = useState<'private' | 'unsaved' | null>(null)

  const handleClick = () => {
    // Check for private scenarios
    if (!scenarioAIsPublic) {
      setWarningType('private')
      setShowModal(true)
      return
    }

    if (scenarioBEnabled && scenarioBId && !scenarioBIsPublic) {
      setWarningType('private')
      setShowModal(true)
      return
    }

    // Check for unsaved changes
    const hasUnsavedChanges = isScenarioDirty || (scenarioBEnabled && isScenarioBDirty)
    if (hasUnsavedChanges) {
      setWarningType('unsaved')
      setShowModal(true)
      return
    }

    // All checks passed, show modal
    setWarningType(null)
    setShowModal(true)
  }

  const handleClose = () => {
    setShowModal(false)
    setWarningType(null)
  }

  return (
    <>
      <button
        onClick={handleClick}
        style={{
          padding: '8px 12px',
          background: '#0ea5e9',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        title="Create Shareable Link"
      >
        <FontAwesomeIcon icon={faShare} />
        Share
      </button>

      {showModal && (
        <ShareLinkModal
          isOpen={showModal}
          onClose={handleClose}
          viewMode={viewMode}
          scenarioAId={scenarioAId}
          scenarioAIsPublic={scenarioAIsPublic}
          scenarioBId={scenarioBId}
          scenarioBIsPublic={scenarioBIsPublic}
          scenarioBEnabled={scenarioBEnabled}
          uiSettings={uiSettings}
          warningType={warningType}
          onLinkCreated={onLinkCreated}
        />
      )}
    </>
  )
}
