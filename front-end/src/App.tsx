
import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ChatInput from './components/Chat/ChatInput'
import ChatWindow from './components/Chat/ChatWindow'
import HomeWorkspace from './components/Home/HomeWorkspace'
import { loadMockState, saveMockState } from './data/mockStorage'
import {
  getDocuments,
  uploadDocument,
  retryDocument,
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

type ResponsePhase = 'loading' | 'streaming'

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

  const [retryingDocumentId, setRetryingDocumentId] =
    useState<string | null>(null)

  const retryInProgressRef = useRef(false)
  const uploadInProgressRef = useRef(false)

  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // Her belge kendi cevap üretme durumunu tutar.
  const [responsePhases, setResponsePhases] = useState<
    Record<string, ResponsePhase>
  >({})

  // Her belge için bağımsız hata bilgisi.
  const [responseErrors, setResponseErrors] = useState<
    Record<string, string>
  >({})

  // Arka planda tamamlanan, henüz görülmemiş cevaplar.
  const [unreadAnswers, setUnreadAnswers] = useState<
    Record<string, boolean>
  >({})

  // Her belgenin kendi SSE bağlantısı.
  const streamControllersRef = useRef<
    Record<string, AbortController>
  >({})

  // Her belge için bağımsız request ID.
  const streamRequestIdsRef = useRef<
    Record<string, number>
  >({})

  // Tamamlanmamış assistant mesajlarının ID'leri.
  const pendingAssistantsRef = useRef<
    Record<string, string>
  >({})

  // Aynı belgeye eşzamanlı ikinci soru gönderilmesini engeller.
  const responseInProgressRef = useRef<
    Record<string, boolean>
  >({})

  // Async callback'ler için güncel seçili belge.
  const selectedDocumentIdRef = useRef<string | null>(null)

  // Sohbet geçmişini yerel olarak sakla.
  useEffect(() => {
    saveMockState({
      documents: [],
      selectedDocumentId: null,
      messagesByDocument,
    })
  }, [messagesByDocument])

  // Uygulama açıldığında backend'deki belgeleri getir.
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

  // İşlenmekte olan belgelerin durumunu yenile.
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

  // Uygulama kapandığında bütün SSE isteklerini iptal et.
  // Belge değiştirmek bu cleanup'ı çalıştırmaz.
  useEffect(() => {
    const controllers = streamControllersRef.current

    return () => {
      Object.values(controllers).forEach((controller) => {
        controller.abort()
      })
    }
  }, [])

  const selectedDocument = documents.find(
    (document) => document.id === selectedDocumentId
  )

  const currentMessages = selectedDocumentId
    ? messagesByDocument[selectedDocumentId] ?? []
    : []

  const currentResponsePhase = selectedDocumentId
    ? responsePhases[selectedDocumentId]
    : undefined

  const isCurrentDocumentLoading =
    currentResponsePhase === 'loading'

  const isCurrentDocumentStreaming =
    currentResponsePhase === 'streaming'

  const isCurrentDocumentResponding =
    currentResponsePhase !== undefined

  const currentResponseError = selectedDocumentId
    ? responseErrors[selectedDocumentId]
    : undefined

  // Belge değiştir; diğer belgelerin isteklerine dokunma.
  const selectDocument = (documentId: string | null) => {
    selectedDocumentIdRef.current = documentId
    setSelectedDocumentId(documentId)

    // Belge açıldığında okunmamış cevap bildirimi temizlenir.
    if (documentId) {
      setUnreadAnswers((previous) => {
        if (!previous[documentId]) return previous

        const updated = { ...previous }
        delete updated[documentId]
        return updated
      })
    }
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

  // Failed durumundaki belgeyi yeniden işlemeye gönder.
  const handleRetryDocument = async (documentId: string) => {
    if (retryInProgressRef.current) return

    retryInProgressRef.current = true
    setRetryingDocumentId(documentId)
    setFeedback(null)

    try {
      await retryDocument(documentId)

      setDocuments((previous) =>
        previous.map((document) =>
          document.id === documentId
            ? {
                ...document,
                status: 'queued',
                error: null,
              }
            : document
        )
      )

      setFeedback({
        type: 'success',
        title: 'Processing restarted',
        message: 'Your document is being processed again.',
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        title: 'Retry failed',
        message:
          error instanceof Error
            ? error.message
            : 'Could not retry document processing.',
      })
    } finally {
      retryInProgressRef.current = false
      setRetryingDocumentId(null)
    }
  }

  // Her belge kendi SSE isteğini bağımsız yönetir.
  const handleSendMessage = async (message: string) => {
    const document = documents.find(
      (item) => item.id === selectedDocumentIdRef.current
    )

    if (
      !document ||
      document.status !== 'ready' ||
      responseInProgressRef.current[document.id] ||
      !message.trim()
    ) {
      return
    }

    const documentId = document.id

    const requestId =
      (streamRequestIdsRef.current[documentId] ?? 0) + 1

    streamRequestIdsRef.current[documentId] = requestId

    const controller = new AbortController()

    streamControllersRef.current[documentId] = controller
    responseInProgressRef.current[documentId] = true

    const assistantMessageId = crypto.randomUUID()

    pendingAssistantsRef.current[documentId] =
      assistantMessageId

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

    setResponsePhases((previous) => ({
      ...previous,
      [documentId]: 'loading',
    }))

    // Yeni soruda yalnızca bu belgenin eski hatasını temizle.
    setResponseErrors((previous) => {
      if (!previous[documentId]) return previous

      const updated = { ...previous }
      delete updated[documentId]
      return updated
    })

    // Yeni soru gönderildiğinde eski "Answer ready" bildirimi temizlenir.
    setUnreadAnswers((previous) => {
      if (!previous[documentId]) return previous

      const updated = { ...previous }
      delete updated[documentId]
      return updated
    })

    setFeedback(null)

    let receivedSources: Source[] = []
    let answerCompleted = false

    const isCurrentRequest = () =>
      streamRequestIdsRef.current[documentId] === requestId &&
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

            setResponsePhases((previous) => ({
              ...previous,
              [documentId]: 'streaming',
            }))

            setMessagesByDocument((previous) => {
              const existingMessages =
                previous[documentId] ?? []

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
                    ? {
                        ...item,
                        content: item.content + text,
                      }
                    : item
                ),
              }
            })
          },

          onDone: (result) => {
            if (!isCurrentRequest()) return

            answerCompleted = true
            delete pendingAssistantsRef.current[documentId]

            // Başka belge açıkken tamamlanan cevabı işaretle.
            if (selectedDocumentIdRef.current !== documentId) {
              setUnreadAnswers((previous) => ({
                ...previous,
                [documentId]: true,
              }))
            }

            const citedSources = receivedSources.filter(
              (source) =>
                result.cited_labels.includes(source.label)
            )

            const completedMessage: ChatMessage = {
              id: assistantMessageId,
              role: 'assistant',
              content: result.answer,
              sources: citedSources,
              metrics: {
                cacheHit: result.cache_hit,
                tokenCount:
                  result.generation_token_usage
                    ?.total_token_count ?? null,
                latencyMs: result.latency_ms,
                aiMode: result.ai_mode,
              },
              createdAt: new Date().toISOString(),
            }

            setMessagesByDocument((previous) => {
              const existingMessages =
                previous[documentId] ?? []

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

      // Akış "done" olmadan sona ererse yarım cevabı koruma.
      if (!answerCompleted && isCurrentRequest()) {
        throw new Error(
          'The answer stream ended before completion. Please retry.'
        )
      }
    } catch (error) {
      if (!isCurrentRequest()) return

      removePartialAnswer()
      delete pendingAssistantsRef.current[documentId]

      setResponseErrors((previous) => ({
        ...previous,
        [documentId]:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      }))
    } finally {
      if (
        streamRequestIdsRef.current[documentId] === requestId
      ) {
        delete streamControllersRef.current[documentId]
        delete responseInProgressRef.current[documentId]
        delete pendingAssistantsRef.current[documentId]

        setResponsePhases((previous) => {
          const updated = { ...previous }
          delete updated[documentId]
          return updated
        })
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
        responsePhases={responsePhases}
        unreadAnswers={unreadAnswers}
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
            role={
              feedback.type === 'error'
                ? 'alert'
                : 'status'
            }
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

        {currentResponseError && (
          <div
            className="file-feedback error"
            role="alert"
          >
            <div>
              <strong>Could not generate answer</strong>
              <p>{currentResponseError}</p>
            </div>

            <button
              type="button"
              className="file-feedback-close"
              aria-label="Dismiss answer error"
              onClick={() => {
                if (!selectedDocumentId) return

                const documentId = selectedDocumentId

                setResponseErrors((previous) => {
                  const updated = { ...previous }
                  delete updated[documentId]
                  return updated
                })
              }}
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
              isRetrying={
                retryingDocumentId === selectedDocumentId
              }
              onRetryDocument={handleRetryDocument}
            />

            <ChatInput
              onSendMessage={handleSendMessage}
              onFileSelect={handleFileSelect}
              isUploading={isUploading}
              disabled={
                selectedDocument?.status !== 'ready' ||
                isCurrentDocumentResponding
              }
            />
          </>
        )}
      </main>
    </div>
  )
}

export default App
