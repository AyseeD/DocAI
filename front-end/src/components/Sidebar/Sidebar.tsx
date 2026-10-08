
import { useRef } from 'react'
import type { DocumentSummary } from '../../types/document'
import './Sidebar.css'

type SidebarProps = {
  documents: DocumentSummary[]
  selectedDocumentId: string | null
  onSelectDocument: (documentId: string) => void
  onFileSelect: (file: File) => void
  isLoading: boolean
  isUploading: boolean
}

function Sidebar({
  documents,
  selectedDocumentId,
  onSelectDocument,
  onFileSelect,
  isLoading,
  isUploading,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">DocAI</div>

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

          // Aynı dosyanın tekrar seçilebilmesini sağlar.
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
            const isSelected = selectedDocumentId === document.id

            return (
              <button
                type="button"
                key={document.id}
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
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
