
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
const MOCK_THINKING_DELAY = 1000
const MOCK_STREAM_INTERVAL = 60

const MOCK_ANSWER =
  'This is a mock AI response for UI testing. ' +
  'The document content has not been analyzed yet. ' +
  'Real answers and citations will be available after backend integration.'

type Feedback = {
  type: 'success' | 'error'
  title: string
  message: string
}

function App() {
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

  // Yanıt üretilen belgeyi takip ediyoruz.
  const [respondingDocumentId, setRespondingDocumentId] =
    useState<string | null>(null)

  const [responsePhase, setResponsePhase] = useState<
    'idle' | 'loading' | 'streaming'
  >('idle')

  // Aynı anda ikinci yanıtın başlatılmasını engeller.
  const responseInProgressRef = useRef(false)

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const streamInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    saveMockState({
      documents,
      selectedDocumentId,
      messagesByDocument,
    })
  }, [documents, selectedDocumentId, messagesByDocument])

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout)

      if (streamInterval.current !== null) {
        clearInterval(streamInterval.current)
      }
    }
  }, [])

  const selectedDocument = documents.find(
    (document) => document.id === selectedDocumentId
  )

  const currentMessages = selectedDocumentId
    ? messagesByDocument[selectedDocumentId] ?? []
    : []

  const isCurrentDocumentLoading =
    respondingDocumentId === selectedDocumentId &&
    responsePhase === 'loading'

  const isCurrentDocumentStreaming =
    respondingDocumentId === selectedDocumentId &&
    responsePhase === 'streaming'

  const handleGoHome = () => {
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

    timers.current.push(timer)
  }

  const handleSendMessage = (message: string) => {
    if (
      !selectedDocument ||
      selectedDocument.status !== 'ready' ||
      responseInProgressRef.current
    ) {
      return
    }

    responseInProgressRef.current = true

    const documentId = selectedDocument.id
    const assistantMessageId = crypto.randomUUID()

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }

    setMessagesByDocument((previous) => ({
      ...previous,
      [documentId]: [
        ...(previous[documentId] ?? []),
        userMessage,
      ],
    }))

    setRespondingDocumentId(documentId)
    setResponsePhase('loading')

    // Kısa bir bekleme sonrasında mock streaming başlar.
    const thinkingTimer = setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }

      setMessagesByDocument((previous) => ({
        ...previous,
        [documentId]: [
          ...(previous[documentId] ?? []),
          assistantMessage,
        ],
      }))

      setResponsePhase('streaming')

      // Metni kelimelere ayırarak parça parça ekliyoruz.
      const chunks = MOCK_ANSWER.match(/\S+\s*/g) ?? []
      let chunkIndex = 0

      streamInterval.current = setInterval(() => {
        if (chunkIndex >= chunks.length) {
          if (streamInterval.current !== null) {
            clearInterval(streamInterval.current)
            streamInterval.current = null
          }

          responseInProgressRef.current = false
          setResponsePhase('idle')
          setRespondingDocumentId(null)
          return
        }

        const chunk = chunks[chunkIndex]
        chunkIndex += 1

        setMessagesByDocument((previous) => ({
          ...previous,
          [documentId]: (previous[documentId] ?? []).map(
            (existingMessage) =>
              existingMessage.id === assistantMessageId
                ? {
                    ...existingMessage,
                    content: existingMessage.content + chunk,
                  }
                : existingMessage
          ),
        }))
      }, MOCK_STREAM_INTERVAL)
    }, MOCK_THINKING_DELAY)

    timers.current.push(thinkingTimer)
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
          isLoading={isCurrentDocumentLoading}
          isStreaming={isCurrentDocumentStreaming}
        />

        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={
            selectedDocument?.status !== 'ready' ||
            responsePhase !== 'idle'
          }
        />
      </main>
    </div>
  )
}

export default App
