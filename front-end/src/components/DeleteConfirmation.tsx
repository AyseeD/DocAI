import { useEffect, useRef } from 'react'

type Props = { count: number; permanent: boolean; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }

export default function DeleteConfirmation({ count, permanent, busy, error, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return <dialog ref={ref} className="injection-warning" aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <h2 id="delete-title">{permanent ? 'Delete permanently?' : 'Move to Trash?'}</h2>
    <p id="delete-description">{permanent
      ? `Permanently delete ${count === 1 ? 'this document' : `these ${count} documents`} and associated chats? This cannot be undone.`
      : `Move ${count === 1 ? 'this document' : `these ${count} documents`} and associated chats to Trash? You can restore them later.`}</p>
    {error && <p role="alert">{error}</p>}
    <div className="injection-actions">
      <button type="button" autoFocus disabled={busy} onClick={onCancel}>Cancel</button>
      <button type="button" className="danger-button" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : permanent ? 'Delete permanently' : 'Delete'}</button>
    </div>
  </dialog>
}
