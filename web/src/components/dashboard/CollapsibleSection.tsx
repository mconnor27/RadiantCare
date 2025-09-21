import { useEffect, useRef, useState } from 'react'

export default function CollapsibleSection({
  title,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  children,
  right,
  tone = 'neutral'
}: {
  title: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: any
  right?: any
  tone?: 'neutral' | 'green' | 'red' | 'purple'
}) {
  const isControlled = typeof controlledOpen === 'boolean'
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(defaultOpen)
  const open = isControlled ? controlledOpen! : uncontrolledOpen
  const contentRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState<number>(0)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    // Measure full height for transition
    const fullHeight = el.scrollHeight
    setMaxHeight(fullHeight)
  }, [children, open])

  const headerStyle: any = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    cursor: 'pointer',
    padding: '6px 8px',
    borderRadius: 6,
    userSelect: 'none',
    transition: 'background-color 0.2s ease',
  }

  const wrapStyle: any = {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 6,
    background: '#f3f4f6',
  }

  const chevronStyle: any = {
    transition: 'transform 160ms ease',
    transform: `rotate(${open ? 90 : 0}deg)`,
  }

  const toneClass = tone === 'green' ? 'panel-green' : tone === 'red' ? 'panel-red' : tone === 'purple' ? 'panel-purple' : ''

  return (
    <div style={{ marginTop: 12 }}>
      <div
        className={toneClass}
        style={wrapStyle}
      >
        <div
          className="collapsible-header"
          style={headerStyle}
          onClick={() => {
            if (isControlled) {
              onOpenChange && onOpenChange(!open)
            } else {
              setUncontrolledOpen((v) => !v)
            }
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.75)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={chevronStyle}>
              <path d="M8 5l8 7-8 7" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>{right}</div>
        </div>

        <div
          className="collapsible-content"
          ref={contentRef}
          style={{
            overflow: 'hidden',
            transition: 'max-height 220ms ease, opacity 180ms ease',
            maxHeight: open ? maxHeight : 0,
            opacity: open ? 1 : 0,
          }}
        >
          <div style={{ paddingTop: 8 }}>{children}</div>
        </div>
      </div>
    </div>
  )
}


