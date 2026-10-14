import { useEffect, useRef, useState } from 'react'

export function TrashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
}

type Props = { name: string; trashed?: boolean; disabled?: boolean; onDelete: () => void; onRestore?: () => void }

export default function DocumentMenu({ name, trashed = false, disabled, onDelete, onRestore }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  return <div className="document-menu" ref={root} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }} onKeyDown={(event) => {
    if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); event.stopPropagation() }
  }}>
    <button ref={trigger} className="document-menu-trigger" type="button" aria-label={`Actions for ${name}`} aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}>⋯</button>
    {open && <div className="document-menu-options">
      {trashed && <button type="button" disabled={disabled} onClick={() => { setOpen(false); onRestore?.() }}>↶ Restore</button>}
      <button type="button" className="danger-button" disabled={disabled} onClick={() => { setOpen(false); onDelete() }}><TrashIcon /> {trashed ? 'Delete permanently' : 'Delete'}</button>
    </div>}
  </div>
}
