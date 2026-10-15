
import { useRef } from 'react'
import type { DocumentSummary } from '../../types/document'
import DocumentMenu, { TrashIcon } from '../DocumentMenu'
import './Sidebar.css'

type ResponsePhase = 'loading' | 'streaming'

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
  responsePhases: Record<string, ResponsePhase>
  unreadAnswers: Record<string, boolean>
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
  responsePhases,
  unreadAnswers,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isHomeActive = selectedDocumentId === null && !isTrashOpen

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">DocAI</div>

      <nav className="sidebar-navigation" aria-label="Main navigation">
        <button
          type="button"
          className={`sidebar-home-button ${isHomeActive ? 'active' : ''}`}
          onClick={onGoHome}
          aria-current={isHomeActive ? 'page' : undefined}
        >
          <span className="sidebar-nav-icon" aria-hidden="true">⌂</span>
          <span>Home</span>
        </button>
      </nav>

      <button
        type="button"
        className="add-document-button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        <span aria-hidden="true">+</span>
        <span>{isUploading ? 'Uploading...' : 'Add document'}</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt"
        hidden
        disabled={isUploading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFileSelect(file)
          event.target.value = ''
        }}
      />

      <section className="documents-section" aria-label="Documents">
        <div className="documents-section-heading">
          <h2>Documents</h2>
          {!isLoading && (
            <span className="documents-count">{documents.length}</span>
          )}
        </div>

        <div className="document-list">
          {isLoading && (
            <p className="document-list-message">Loading documents...</p>
          )}

          {!isLoading && documents.length === 0 && (
            <p className="document-list-message">No documents yet.</p>
          )}

          {documents.map((document) => {
            const isSelected =
              !isTrashOpen && selectedDocumentId === document.id

            const isGenerating = Boolean(responsePhases[document.id])

            const hasUnreadAnswer =
              !isGenerating &&
              document.status === 'ready' &&
              Boolean(unreadAnswers[document.id])

            const statusClass = isGenerating
              ? 'generating'
              : hasUnreadAnswer
                ? 'answer-ready'
                : document.status

            return (
              <div
                className={`sidebar-document-row ${isSelected ? 'selected' : ''}`}
                key={document.id}
              >
                <button
                  type="button"
                  className="document-item"
                  onClick={() => onSelectDocument(document.id)}
                  aria-pressed={isSelected}
                  title={document.name}
                >
                  <span className="document-name">{document.name}</span>

                  <span className={`document-status ${statusClass}`}>
                    {isGenerating ? (
                      <>
                        <span
                          className="status-spinner"
                          aria-hidden="true"
                        />
                        <span>Generating</span>
                      </>
                    ) : hasUnreadAnswer ? (
                      <>
                        <span
                          className="status-check"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <span>Answer ready</span>
                      </>
                    ) : document.status === 'queued' ? (
                      <span>Processing</span>
                    ) : document.status === 'ready' ? (
                      <span>Ready</span>
                    ) : document.status === 'failed' ? (
                      <span>Failed</span>
                    ) : (
                      <span>{document.status}</span>
                    )}
                  </span>
                </button>

                <DocumentMenu
                  name={document.name}
                  disabled={isChangingDocuments}
                  onDelete={() => onDeleteDocument(document.id)}
                />
              </div>
            )
          })}
        </div>
      </section>

      <div className="sidebar-footer">
        <button
          type="button"
          className={`sidebar-home-button sidebar-trash-button ${
            isTrashOpen ? 'active' : ''
          }`}
          aria-current={isTrashOpen ? 'page' : undefined}
          onClick={onOpenTrash}
        >
          <TrashIcon />
          <span>Trash</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
