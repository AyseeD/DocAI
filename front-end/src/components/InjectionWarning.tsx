import { useEffect, useRef } from 'react'

type Props = { fileName: string; onCancel: () => void; onConfirm: () => void }

export default function InjectionWarning({ fileName, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return (
    <dialog ref={dialog} className="injection-warning" aria-labelledby="injection-title"
      aria-describedby="injection-description" onCancel={(event) => { event.preventDefault(); onCancel() }}>
      <h2 id="injection-title">Possible security issue</h2>
      <p className="injection-file">{fileName}</p>
      <p id="injection-description">Your document appears to contain instructions that could try to manipulate the AI and may cause security issues. Do you still want to upload it?</p>
      <p>If you continue, the AI’s existing security safeguards will still apply.</p>
      <div className="injection-actions">
        <button type="button" autoFocus onClick={onCancel}>Cancel upload</button>
        <button type="button" className="injection-confirm" onClick={onConfirm}>Upload anyway</button>
      </div>
    </dialog>
  )
}
