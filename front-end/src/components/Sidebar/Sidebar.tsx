
import { useRef } from 'react'
import type { DocumentSummary } from '../../types/document'
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
  responsePhases,
  unreadAnswers,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">DocAI</div>

      <button
        type="button"
        className={`sidebar-home-button ${
          selectedDocumentId === null ? 'active' : ''
        }`}
        onClick={onGoHome}
        aria-current={
          selectedDocumentId === null ? 'page' : undefined
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
            const isSelected =
              selectedDocumentId === document.id

            const isGenerating =
              Boolean(responsePhases[document.id])

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
                  className={`document-status ${statusClass}`}
                >
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
