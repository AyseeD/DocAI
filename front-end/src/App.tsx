
import { useState } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import { initialMockDocuments } from './data/mockDocuments'
import type { DocumentSummary } from './types/document'
import './App.css'

const MAX_FILE_SIZE = 20 * 1024 * 1024

type Feedback = {
  type: 'success' | 'error'
  title: string
  message: string
}

function App() {
  // Mock belgeleri state içinde yönetiyoruz.
  const [documents, setDocuments] = useState<DocumentSummary[]>(
    () => [...initialMockDocuments]
  )

  const [selectedDocumentId, setSelectedDocumentId] =
    useState<string | null>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const selectedDocument = documents.find(
    (document) => document.id === selectedDocumentId
  )

  const handleFileSelect = (file: File) => {
    if (isUploading) return

    // Dosya türü ve boyutunu backend kurallarıyla aynı tutuyoruz.
    if (!/\.(pdf|txt)$/i.test(file.name)) {
      setFeedback({
        type: 'error',
        title: 'Unsupported file type',
        message: 'Only PDF and TXT files are supported.',
      })
      return
    }

    if (file.size === 0) {
      setFeedback({
        type: 'error',
        title: 'Empty file',
        message: 'Please select a non-empty file.',
      })
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setFeedback({
        type: 'error',
        title: 'File too large',
        message: 'Maximum file size is 20 MiB.',
      })
      return
    }

    setIsUploading(true)
    setFeedback(null)

    // Bu belge yalnızca frontend belleğine eklenir; sunucuya yüklenmez.
    const mockDocument: DocumentSummary = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      mime_type: /\.pdf$/i.test(file.name)
        ? 'application/pdf'
        : 'text/plain',
      status: 'queued',
      created_at: new Date().toISOString(),
      processed_at: null,
      error: null,
    }

    setDocuments((previous) => [mockDocument, ...previous])
    setSelectedDocumentId(mockDocument.id)
    setIsUploading(false)

    setFeedback({
      type: 'success',
      title: file.name,
      message: 'Document added to mock UI. No file was uploaded.',
    })
  }

  return (
    <div className="app">
      <Sidebar
        documents={documents}
        selectedDocumentId={selectedDocumentId}
        onSelectDocument={setSelectedDocumentId}
        onFileSelect={handleFileSelect}
        isLoading={false}
        isUploading={isUploading}
      />

      <main className="chat-workspace">
        <header className="chat-header">
          <h1>
            {selectedDocument
              ? selectedDocument.name
              : 'Document Chat'}
          </h1>
        </header>

        {feedback && (
          <div
            className={`file-feedback ${feedback.type}`}
            role={feedback.type === 'error' ? 'alert' : 'status'}
          >
            <div>
              <strong>{feedback.title}</strong>
              <p>{feedback.message}</p>
            </div>

            <button
              type="button"
              className="file-feedback-close"
              aria-label="Dismiss file notification"
              onClick={() => setFeedback(null)}
            >
              ×
            </button>
          </div>
        )}

        <section className="chat-content">
          <div className="empty-state">
            {selectedDocument?.status === 'queued' ? (
              <>
                <h2>Processing document</h2>
                <p>
                  This is a mock processing state.
                </p>
              </>
            ) : selectedDocument?.status === 'failed' ? (
              <>
                <h2>Processing failed</h2>
                <p>
                  {selectedDocument.error ??
                    'The document could not be processed.'}
                </p>
              </>
            ) : selectedDocument?.status === 'ready' ? (
              <>
                <h2>Document ready</h2>
                <p>
                  This document is ready for the future chat UI.
                </p>
              </>
            ) : (
              <>
                <h2>Ask about your documents</h2>
                <p>
                  Select a document to get started.
                </p>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
