import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLink } from '@fortawesome/free-solid-svg-icons'
import ShareLinkModal from './ShareLinkModal'

interface ShareLinkButtonProps {
  viewMode: 'YTD Detailed' | 'Multi-Year' | 'YTD Mobile'
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
          background: 'none',
          border: 'none',
          color: '#6b7280',
          fontSize: 18,
          cursor: 'pointer',
          transition: 'opacity 0.2s',
          padding: 2
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        title="Create Shareable Link"
      >
        <FontAwesomeIcon icon={faLink} />
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
