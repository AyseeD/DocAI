
import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ChatInput from './components/Chat/ChatInput'
import ChatWindow from './components/Chat/ChatWindow'
import { loadMockState, saveMockState } from './data/mockStorage'
import type { DocumentSummary } from './types/document'
import type { ChatMessage } from './types/chat'
import './App.css'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const MOCK_PROCESSING_DELAY = 2000

type Feedback = {
  type: 'success' | 'error'
  title: string
  message: string
}

function App() {
  // Storage'ı başlangıçta yalnızca bir kez okuyoruz.
  const [initialState] = useState(loadMockState)

  const [documents, setDocuments] = useState<DocumentSummary[]>(
    initialState.documents
  )

  const [selectedDocumentId, setSelectedDocumentId] =
    useState<string | null>(initialState.selectedDocumentId)

  const [messagesByDocument, setMessagesByDocument] = useState<
    Record<string, ChatMessage[]>
  >(initialState.messagesByDocument)

  const [isUploading, setIsUploading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const processingTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Belgeler, seçim veya mesajlar değiştiğinde storage'ı günceller.
  useEffect(() => {
    saveMockState({
      documents,
      selectedDocumentId,
      messagesByDocument,
    })
  }, [documents, selectedDocumentId, messagesByDocument])

  useEffect(() => {
    return () => {
      processingTimers.current.forEach(clearTimeout)
    }
  }, [])

  const selectedDocument = documents.find(
    (document) => document.id === selectedDocumentId
  )

  const currentMessages = selectedDocumentId
    ? messagesByDocument[selectedDocumentId] ?? []
    : []
  
  const handleGoHome = () => {
    // Yalnızca aktif belge seçimini kaldırıyoruz.
    // Belgeler ve sohbet geçmişi korunuyor.
    setSelectedDocumentId(null)
    setFeedback(null)
  }


  const handleFileSelect = (file: File) => {
    if (isUploading) return

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

    // Gerçek dosya değil, yalnızca mock belge bilgileri saklanır.
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
      message: 'Mock document added. No file was uploaded.',
    })

    // İşleme sürecini yalnızca frontend üzerinde simüle eder.
    const timer = setTimeout(() => {
      setDocuments((previous) =>
        previous.map((document) =>
          document.id === mockDocument.id
            ? {
                ...document,
                status: 'ready',
                processed_at: new Date().toISOString(),
              }
            : document
        )
      )
    }, MOCK_PROCESSING_DELAY)

    processingTimers.current.push(timer)
  }

  const handleSendMessage = (message: string) => {
    if (!selectedDocument || selectedDocument.status !== 'ready') {
      return
    }

    const documentId = selectedDocument.id

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }

    const mockAnswer: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        'This is a mock AI response for UI testing. ' +
        'The document content has not been analyzed yet. ' +
        'Real answers and citations will be available after backend integration.',
      createdAt: new Date().toISOString(),
    }

    setMessagesByDocument((previous) => ({
      ...previous,
      [documentId]: [
        ...(previous[documentId] ?? []),
        userMessage,
        mockAnswer,
      ],
    }))
  }

  return (
    <div className="app">
      <Sidebar
        documents={documents}
        selectedDocumentId={selectedDocumentId}
        onSelectDocument={setSelectedDocumentId}
        onGoHome={handleGoHome}
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

        <ChatWindow
          messages={currentMessages}
          document={selectedDocument ?? null}
        />

        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={selectedDocument?.status !== 'ready'}
        />
      </main>
    </div>
  )
}

export default App
