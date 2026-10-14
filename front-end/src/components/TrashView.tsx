import { useState } from 'react'
import type { DocumentSummary } from '../types/document'
import DocumentMenu, { TrashIcon } from './DocumentMenu'

type Props = { documents: DocumentSummary[]; busy: boolean; loading: boolean; error: string | null; onRefresh: () => void; onRestore: (ids: string[]) => void; onDelete: (ids: string[]) => void }

export default function TrashView({ documents, busy, loading, error, onRefresh, onRestore, onDelete }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const ids = selected.filter(id => documents.some(doc => doc.id === id))
  const allSelected = documents.length > 0 && ids.length === documents.length
  return <section className="trash-view" aria-label="Deleted documents">
    <h2><TrashIcon /> Trash</h2>
    <p>Restore documents with their chats, or delete them permanently.</p>
    {error && <p role="alert">{error} <button onClick={onRefresh} disabled={loading}>Try again</button></p>}
    {loading ? <p role="status">Loading Trash…</p> : documents.length === 0 ? <p>Trash is empty.</p> : <>
      <div className="trash-toolbar">
        <label><input type="checkbox" checked={allSelected} disabled={busy} onChange={() => setSelected(allSelected ? [] : documents.map(doc => doc.id))} /> Select all</label>
        <span>{ids.length} selected</span>
        <button disabled={busy || !ids.length} onClick={() => onRestore(ids)}>↶ Restore selected</button>
        <button className="danger-button" disabled={busy || !ids.length} onClick={() => onDelete(ids)}><TrashIcon /> Delete permanently</button>
      </div>
      <ul className="trash-list">{documents.map(doc => <li key={doc.id}>
        <input type="checkbox" aria-label={`Select ${doc.name}`} disabled={busy} checked={ids.includes(doc.id)} onChange={() => setSelected(ids.includes(doc.id) ? ids.filter(id => id !== doc.id) : [...ids, doc.id])} />
        <div className="trash-document"><strong>{doc.name}</strong><span>{doc.deleted_at ? `Deleted ${new Date(doc.deleted_at).toLocaleDateString()}` : 'Deleted document'}</span></div>
        <DocumentMenu name={doc.name} trashed disabled={busy} onRestore={() => onRestore([doc.id])} onDelete={() => onDelete([doc.id])} />
      </li>)}</ul>
    </>}
  </section>
}
