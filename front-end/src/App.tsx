
import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ChatInput from './components/Chat/ChatInput'
import ChatWindow from './components/Chat/ChatWindow'
import HomeWorkspace from './components/Home/HomeWorkspace'
import { loadMockState, saveMockState } from './data/mockStorage'
import {
  getDocuments,
  uploadDocument,
} from './services/documentService'
import {
  streamQuestion,
  type Source,
} from './services/questionService'
import type { DocumentSummary } from './types/document'
import type { ChatMessage } from './types/chat'
import './App.css'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const DOCUMENT_POLL_INTERVAL = 2000

type Feedback = {
  type: 'success' | 'error'
  title: string
  message: string
}

function App() {
  const [initialState] = useState(loadMockState)

  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true)

  const [selectedDocumentId, setSelectedDocumentId] =
    useState<string | null>(null)

  const [messagesByDocument, setMessagesByDocument] = useState<
    Record<string, ChatMessage[]>
  >(initialState.messagesByDocument)

  const [isUploading, setIsUploading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const [respondingDocumentId, setRespondingDocumentId] =
    useState<string | null>(null)

  const [responsePhase, setResponsePhase] = useState<
    'idle' | 'loading' | 'streaming'
  >('idle')

  // Devam eden SSE isteğini iptal etmek için kullanıyoruz.
  const streamControllerRef = useRef<AbortController | null>(null)

  // Eski isteğin yeni belgeye yanıt yazmasını engeller.
  const streamRequestIdRef = useRef(0)

  const responseInProgressRef = useRef(false)
  const uploadInProgressRef = useRef(false)

  // Seçili belgeyi güncel olarak takip ediyoruz.
  const selectedDocumentIdRef = useRef<string | null>(null)

  // Mock mesaj geçmişi, gerçek belge kayıtlarından ayrı tutuluyor.
  useEffect(() => {
    saveMockState({
      documents: [],
      selectedDocumentId: null,
      messagesByDocument,
    })
  }, [messagesByDocument])

  // Uygulama açıldığında gerçek belgeleri backend'den getiriyoruz.
  useEffect(() => {
    let isActive = true

    const loadDocuments = async () => {
      try {
        const backendDocuments = await getDocuments()

        if (!isActive) return

        setDocuments(backendDocuments)
      } catch (error) {
        if (!isActive) return

        setFeedback({
          type: 'error',
          title: 'Could not load documents',
          message:
            error instanceof Error
              ? error.message
              : 'Please try again later.',
        })
      } finally {
        if (isActive) {
          setIsDocumentsLoading(false)
        }
      }
    }

    void loadDocuments()

    return () => {
      isActive = false
    }
  }, [])

  // Queued belgelerin durumunu otomatik yeniliyoruz.
  useEffect(() => {
    if (!documents.some((document) => document.status === 'queued')) {
      return
    }

    let isActive = true
    let requestInProgress = false

    const refreshDocuments = async () => {
      if (requestInProgress) return
      requestInProgress = true

      try {
        const updatedDocuments = await getDocuments()

        if (isActive) {
          setDocuments(updatedDocuments)
        }
      } catch (error) {
        console.error('Document status refresh failed:', error)
      } finally {
        requestInProgress = false
      }
    }

    const interval = setInterval(() => {
      void refreshDocuments()
    }, DOCUMENT_POLL_INTERVAL)

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [documents])

  // Uygulama kapatılırken devam eden SSE isteğini iptal ediyoruz.
  useEffect(() => {
    return () => {
      streamControllerRef.current?.abort()
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

  // Belge değiştiğinde eski SSE akışını durduruyoruz.
  const selectDocument = (documentId: string | null) => {
    if (selectedDocumentIdRef.current !== documentId) {
      streamRequestIdRef.current += 1
      streamControllerRef.current?.abort()
      streamControllerRef.current = null
      responseInProgressRef.current = false

      setRespondingDocumentId(null)
      setResponsePhase('idle')
    }

    selectedDocumentIdRef.current = documentId
    setSelectedDocumentId(documentId)
  }

  const handleGoHome = () => {
    selectDocument(null)
    setFeedback(null)
  }

  const handleFileSelect = async (file: File) => {
    if (uploadInProgressRef.current) return

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

    uploadInProgressRef.current = true
    setIsUploading(true)
    setFeedback(null)

    try {
      const uploadResult = await uploadDocument(file)
      const backendDocuments = await getDocuments()

      setDocuments(backendDocuments)
      selectDocument(uploadResult.id)

      setFeedback({
        type: 'success',
        title: file.name,
        message: uploadResult.duplicate
          ? 'This document already exists.'
          : 'Document uploaded. Processing will begin shortly.',
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        title: 'Upload failed',
        message:
          error instanceof Error
            ? error.message
            : 'Could not upload document.',
      })
    } finally {
      uploadInProgressRef.current = false
      setIsUploading(false)
    }
  }

  const handleSendMessage = async (message: string) => {
    const document = documents.find(
      (item) => item.id === selectedDocumentIdRef.current
    )

    if (
      !document ||
      document.status !== 'ready' ||
      responseInProgressRef.current ||
      !message.trim()
    ) {
      return
    }

    const documentId = document.id
    const requestId = ++streamRequestIdRef.current
    const controller = new AbortController()

    streamControllerRef.current = controller
    responseInProgressRef.current = true

    const assistantMessageId = crypto.randomUUID()

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }

    // Önce kullanıcının mesajını ekliyoruz.
    setMessagesByDocument((previous) => ({
      ...previous,
      [documentId]: [
        ...(previous[documentId] ?? []),
        userMessage,
      ],
    }))

    setRespondingDocumentId(documentId)
    setResponsePhase('loading')
    setFeedback(null)

    let receivedSources: Source[] = []

    // Yalnızca hâlâ geçerli olan isteğin UI'ı değiştirmesine izin veriyoruz.
    const isCurrentRequest = () =>
      streamRequestIdRef.current === requestId &&
      !controller.signal.aborted

    const removePartialAnswer = () => {
      setMessagesByDocument((previous) => ({
        ...previous,
        [documentId]: (previous[documentId] ?? []).filter(
          (item) => item.id !== assistantMessageId
        ),
      }))
    }

    try {
      await streamQuestion(
        message,
        documentId,
        {
          onSources: (sources) => {
            if (!isCurrentRequest()) return
            receivedSources = sources
          },

          onDelta: (text) => {
            if (!isCurrentRequest()) return

            setResponsePhase('streaming')

            setMessagesByDocument((previous) => {
              const existingMessages = previous[documentId] ?? []
              const assistantExists = existingMessages.some(
                (item) => item.id === assistantMessageId
              )

              if (!assistantExists) {
                const assistantMessage: ChatMessage = {
                  id: assistantMessageId,
                  role: 'assistant',
                  content: text,
                  createdAt: new Date().toISOString(),
                }

                return {
                  ...previous,
                  [documentId]: [
                    ...existingMessages,
                    assistantMessage,
                  ],
                }
              }

              return {
                ...previous,
                [documentId]: existingMessages.map((item) =>
                  item.id === assistantMessageId
                    ? { ...item, content: item.content + text }
                    : item
                ),
              }
            })
          },

          onDone: (result) => {
            if (!isCurrentRequest()) return

            // Yalnızca yanıtın gerçekten kullandığı kaynakları saklıyoruz.
            const citedSources = receivedSources.filter((source) =>
              result.cited_labels.includes(source.label)
            )

            const completedMessage: ChatMessage = {
              id: assistantMessageId,
              role: 'assistant',
              content: result.answer,
              sources: citedSources,
              createdAt: new Date().toISOString(),
            }

            setMessagesByDocument((previous) => {
              const existingMessages = previous[documentId] ?? []

              return {
                ...previous,
                [documentId]: [
                  ...existingMessages.filter(
                    (item) => item.id !== assistantMessageId
                  ),
                  completedMessage,
                ],
              }
            })
          },
        },
        controller.signal
      )
    } catch (error) {
      if (!isCurrentRequest()) return

      // Hata olduğunda tamamlanmamış assistant yanıtını siliyoruz.
      removePartialAnswer()

      setFeedback({
        type: 'error',
        title: 'Could not generate answer',
        message:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    } finally {
      if (streamRequestIdRef.current === requestId) {
        streamControllerRef.current = null
        responseInProgressRef.current = false
        setRespondingDocumentId(null)
        setResponsePhase('idle')
      }
    }
  }

  return (
    <div className="app">
      <Sidebar
        documents={documents}
        selectedDocumentId={selectedDocumentId}
        onSelectDocument={selectDocument}
        onGoHome={handleGoHome}
        onFileSelect={handleFileSelect}
        isLoading={isDocumentsLoading}
        isUploading={isUploading}
      />

      <main className="chat-workspace">
        <header className="chat-header">
          <h1>
            {selectedDocument
              ? selectedDocument.name
              : 'Workspace'}
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

        {selectedDocumentId === null ? (
          <HomeWorkspace
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
          />
        ) : (
          <>
            <ChatWindow
              messages={currentMessages}
              document={selectedDocument ?? null}
              isLoading={isCurrentDocumentLoading}
              isStreaming={isCurrentDocumentStreaming}
            />

            <ChatInput
              onSendMessage={handleSendMessage}
              onFileSelect={handleFileSelect}
              isUploading={isUploading}
              disabled={
                selectedDocument?.status !== 'ready' ||
                responsePhase !== 'idle'
              }
            />
          </>
        )}
      </main>
    </div>
  )
}

export default App
