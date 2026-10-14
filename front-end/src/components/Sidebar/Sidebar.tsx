
import { useRef } from 'react'
import type { DocumentSummary } from '../../types/document'
import './Sidebar.css'
import DocumentMenu, { TrashIcon } from '../DocumentMenu'

type SidebarProps = {
  documents: DocumentSummary[]
  selectedDocumentId: string | null
  onSelectDocument: (documentId: string) => void
  onGoHome: () => void
  onFileSelect: (file: File) => void
  isLoading: boolean
  isUploading: boolean
  isTrashOpen: boolean
  isChangingDocuments: boolean
  onOpenTrash: () => void
  onDeleteDocument: (id: string) => void
}

function Sidebar({
  documents,
  selectedDocumentId,
  onSelectDocument,
  onGoHome,
  onFileSelect,
  isLoading,
  isUploading,
  isTrashOpen,
  isChangingDocuments,
  onOpenTrash,
  onDeleteDocument,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">DocAI</div>

      {/* Home: Belge seçimini kaldırır, verileri silmez. */}
      <button
        type="button"
        className={`sidebar-home-button ${
          selectedDocumentId === null && !isTrashOpen ? 'active' : ''
        }`}
        onClick={onGoHome}
        aria-current={
          selectedDocumentId === null && !isTrashOpen ? 'page' : undefined
        }
      >
        <span aria-hidden="true">⌂</span>
        <span>Home</span>
      </button>

      <button
        type="button"
        className="add-document-button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? 'Uploading...' : '+ Add document'}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt"
        hidden
        disabled={isUploading}
        onChange={(event) => {
          const file = event.target.files?.[0]

          if (file) {
            onFileSelect(file)
          }

          event.target.value = ''
        }}
      />

      <div className="documents-section">
        <h2>Documents</h2>

        <div className="document-list">
          {isLoading && (
            <p className="document-list-message">
              Loading documents...
            </p>
          )}

          {!isLoading && documents.length === 0 && (
            <p className="document-list-message">
              No documents yet.
            </p>
          )}

          {documents.map((document) => {
            const isSelected = !isTrashOpen && selectedDocumentId === document.id

            return (
              <div className="sidebar-document-row" key={document.id}>
              <button
                type="button"
                className={`document-item ${
                  isSelected ? 'selected' : ''
                }`}
                onClick={() => onSelectDocument(document.id)}
                aria-pressed={isSelected}
              >
                <div className="document-name">
                  {document.name}
                </div>

                <div
                  className={`document-status ${document.status}`}
                >
                  {document.status === 'queued'
                    ? 'processing'
                    : document.status}
                </div>
              </button>
              <DocumentMenu name={document.name} disabled={isChangingDocuments} onDelete={() => onDeleteDocument(document.id)} />
              </div>
            )
          })}
        </div>
      </div>
      <button type="button" className={`sidebar-home-button sidebar-trash-button ${isTrashOpen ? 'active' : ''}`} aria-current={isTrashOpen ? 'page' : undefined} onClick={onOpenTrash}><TrashIcon /> Trash</button>
    </aside>
  )
}

export default Sidebar
