import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faRotateLeft, faBug } from '@fortawesome/free-solid-svg-icons'
import { logger, type LogLevel, type LogNamespace } from '../../lib/logger'
import { useAuth } from '../auth/AuthProvider'

interface LoggingControlPanelProps {
  isOpen: boolean
  onClose: () => void
}

const ALL_NAMESPACES: LogNamespace[] = [
  'AUTH',
  'QBO_SYNC',
  'QBO_CACHE',
  'SESSION',
  'SHARE_LINK',
  'COMPENSATION',
  'GRID',
  'SCENARIO',
  'STORE',
  'DATA_TRANSFORM',
  'SNAPSHOT',
  'PHYSICIAN',
  'MD_HOURS',
  'API',
  'CHART',
  'UI'
]

const LOG_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE']

const PRESETS = {
  development: {
    level: 'DEBUG' as LogLevel,
    namespaces: ALL_NAMESPACES,
    description: 'All logs, all namespaces'
  },
  production: {
    level: 'ERROR' as LogLevel,
    namespaces: ALL_NAMESPACES,
    description: 'Errors only'
  },
  compensation: {
    level: 'DEBUG' as LogLevel,
    namespaces: ['COMPENSATION', 'GRID', 'MD_HOURS', 'STORE'] as LogNamespace[],
    description: 'Debug compensation calculations'
  },
  quickbooks: {
    level: 'DEBUG' as LogLevel,
    namespaces: ['QBO_SYNC', 'QBO_CACHE', 'API'] as LogNamespace[],
    description: 'Debug QuickBooks operations'
  },
  scenarios: {
    level: 'DEBUG' as LogLevel,
    namespaces: ['SCENARIO', 'SNAPSHOT', 'STORE'] as LogNamespace[],
    description: 'Debug scenario management'
  }
}

export default function LoggingControlPanel({ isOpen, onClose }: LoggingControlPanelProps) {
  const { profile } = useAuth()
  const isAdmin = profile?.is_admin || false
  const [currentLevel, setCurrentLevel] = useState<LogLevel>('INFO')
  const [enabledNamespaces, setEnabledNamespaces] = useState<LogNamespace[]>(ALL_NAMESPACES)
  const [config, setConfig] = useState(logger.getConfiguration())
  const [allowNonAdminLogging, setAllowNonAdminLogging] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const currentConfig = logger.getConfiguration()
      setCurrentLevel(currentConfig.globalLevel)
      setEnabledNamespaces(
        currentConfig.enabledNamespaces === 'ALL'
          ? ALL_NAMESPACES
          : currentConfig.enabledNamespaces
      )
      setAllowNonAdminLogging(currentConfig.allowNonAdminLogging)
      setConfig(currentConfig)
    }
  }, [isOpen])

  // Update logger's admin status whenever profile changes
  useEffect(() => {
    logger.setIsAdmin(isAdmin)
  }, [isAdmin])

  const handleLevelChange = (level: LogLevel) => {
    setCurrentLevel(level)
    logger.setLevel(level)
    setConfig(logger.getConfiguration())
  }

  const handleNamespaceToggle = (namespace: LogNamespace) => {
    const newNamespaces = enabledNamespaces.includes(namespace)
      ? enabledNamespaces.filter(ns => ns !== namespace)
      : [...enabledNamespaces, namespace]

    setEnabledNamespaces(newNamespaces)

    if (newNamespaces.length === ALL_NAMESPACES.length) {
      logger.enableAll()
    } else if (newNamespaces.length === 0) {
      logger.disableAll()
    } else {
      logger.enableOnly(newNamespaces)
    }

    setConfig(logger.getConfiguration())
  }

  const handleSelectAll = () => {
    setEnabledNamespaces(ALL_NAMESPACES)
    logger.enableAll()
    setConfig(logger.getConfiguration())
  }

  const handleDeselectAll = () => {
    setEnabledNamespaces([])
    logger.disableAll()
    setConfig(logger.getConfiguration())
  }

  const handlePreset = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey]
    setCurrentLevel(preset.level)
    setEnabledNamespaces(preset.namespaces)
    logger.setLevel(preset.level)
    logger.enableOnly(preset.namespaces)
    setConfig(logger.getConfiguration())
  }

  const handleReset = () => {
    const defaultLevel = import.meta.env.PROD ? 'WARN' : 'INFO'
    setCurrentLevel(defaultLevel as LogLevel)
    setEnabledNamespaces(ALL_NAMESPACES)
    setAllowNonAdminLogging(false)
    logger.setLevel(defaultLevel as LogLevel)
    logger.enableAll()
    logger.setAllowNonAdminLogging(false)
    setConfig(logger.getConfiguration())

    // Clear localStorage
    localStorage.removeItem('LOG_LEVEL')
    localStorage.removeItem('LOG_NAMESPACES')
    localStorage.removeItem('LOG_ALLOW_NON_ADMIN')
  }

  const handleToggleNonAdminLogging = () => {
    const newValue = !allowNonAdminLogging
    setAllowNonAdminLogging(newValue)
    logger.setAllowNonAdminLogging(newValue)
    setConfig(logger.getConfiguration())
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'fadeIn 0.2s ease-in'
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          zIndex: 9999,
          width: 'min(90vw, 700px)',
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FontAwesomeIcon icon={faBug} size="lg" />
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
                Logging Control Panel
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9 }}>
                Configure application logging in real-time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: 6,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {/* Current Config Info */}
          <div
            style={{
              background: '#f3f4f6',
              padding: 16,
              borderRadius: 8,
              marginBottom: 24,
              fontSize: 13
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Current Configuration</div>
            <div style={{ color: '#6b7280' }}>
              <div>Level: <span style={{ fontWeight: 500, color: '#374151' }}>{config.globalLevel}</span></div>
              <div>Environment: <span style={{ fontWeight: 500, color: '#374151' }}>{config.isProduction ? 'Production' : 'Development'}</span></div>
              <div>Active Namespaces: <span style={{ fontWeight: 500, color: '#374151' }}>
                {config.enabledNamespaces === 'ALL' ? 'All' : config.enabledNamespaces.length}
              </span></div>
              <div>User Role: <span style={{ fontWeight: 500, color: '#374151' }}>{isAdmin ? 'Admin' : 'Non-Admin'}</span></div>
              <div>Non-Admin Logging: <span style={{ fontWeight: 500, color: allowNonAdminLogging ? '#10b981' : '#ef4444' }}>
                {allowNonAdminLogging ? 'Enabled' : 'Disabled'}
              </span></div>
            </div>
          </div>

          {/* Admin Controls */}
          {isAdmin && (
            <div
              style={{
                background: '#fef3c7',
                border: '2px solid #f59e0b',
                padding: 16,
                borderRadius: 8,
                marginBottom: 24,
                fontSize: 13
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                Admin Controls
              </div>
              <div style={{ marginBottom: 12, color: '#78350f' }}>
                Enable logging for non-admin users. When disabled, only admins can see logs.
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  background: '#fff',
                  border: `2px solid ${allowNonAdminLogging ? '#10b981' : '#e5e7eb'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fefce8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff'
                }}
              >
                <input
                  type="checkbox"
                  checked={allowNonAdminLogging}
                  onChange={handleToggleNonAdminLogging}
                  style={{
                    width: 18,
                    height: 18,
                    cursor: 'pointer',
                    accentColor: '#10b981'
                  }}
                />
                <span style={{ color: allowNonAdminLogging ? '#059669' : '#6b7280' }}>
                  Allow Non-Admin Users to See Logs
                </span>
              </label>
            </div>
          )}

          {/* Quick Presets */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: '#374151' }}>
              Quick Presets
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handlePreset(key as keyof typeof PRESETS)}
                  style={{
                    padding: '10px 14px',
                    background: '#fff',
                    border: '1.5px solid #e5e7eb',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    fontSize: 13
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#667eea'
                    e.currentTarget.style.background = '#f9fafb'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.background = '#fff'
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#374151', textTransform: 'capitalize', marginBottom: 4 }}>
                    {key}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Log Level */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: '#374151' }}>
              Log Level
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LOG_LEVELS.map(level => (
                <button
                  key={level}
                  onClick={() => handleLevelChange(level)}
                  style={{
                    padding: '8px 16px',
                    background: currentLevel === level ? '#667eea' : '#fff',
                    color: currentLevel === level ? '#fff' : '#374151',
                    border: currentLevel === level ? 'none' : '1.5px solid #e5e7eb',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (currentLevel !== level) {
                      e.currentTarget.style.borderColor = '#667eea'
                      e.currentTarget.style.color = '#667eea'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentLevel !== level) {
                      e.currentTarget.style.borderColor = '#e5e7eb'
                      e.currentTarget.style.color = '#374151'
                    }
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Namespaces */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>
                Namespaces ({enabledNamespaces.length}/{ALL_NAMESPACES.length})
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleSelectAll}
                  style={{
                    padding: '4px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: '#667eea',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  style={{
                    padding: '4px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: '#667eea',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 10,
                maxHeight: 300,
                overflow: 'auto',
                padding: 2
              }}
            >
              {ALL_NAMESPACES.map(namespace => {
                const isEnabled = enabledNamespaces.includes(namespace)
                return (
                  <label
                    key={namespace}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: isEnabled ? '#ede9fe' : '#f9fafb',
                      border: `1.5px solid ${isEnabled ? '#a78bfa' : '#e5e7eb'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      transition: 'all 0.2s',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isEnabled) {
                        e.currentTarget.style.background = '#f3f4f6'
                        e.currentTarget.style.borderColor = '#d1d5db'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isEnabled) {
                        e.currentTarget.style.background = '#f9fafb'
                        e.currentTarget.style.borderColor = '#e5e7eb'
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleNamespaceToggle(namespace)}
                      style={{
                        width: 16,
                        height: 16,
                        cursor: 'pointer',
                        accentColor: '#667eea'
                      }}
                    />
                    <span style={{ fontWeight: 500, color: isEnabled ? '#5b21b6' : '#6b7280' }}>
                      {namespace}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f9fafb'
          }}
        >
          <button
            onClick={handleReset}
            style={{
              padding: '8px 16px',
              background: '#fff',
              border: '1.5px solid #e5e7eb',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#667eea'
              e.currentTarget.style.color = '#667eea'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.color = '#6b7280'
            }}
          >
            <FontAwesomeIcon icon={faRotateLeft} />
            Reset to Defaults
          </button>

          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Settings persist in localStorage
          </div>
        </div>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from { transform: translate(-50%, -45%); opacity: 0; }
            to { transform: translate(-50%, -50%); opacity: 1; }
          }
        `}</style>
      </div>
    </>
  )
}
