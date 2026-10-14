
import { useEffect, useRef, useState } from 'react'
import InjectionWarning from './components/InjectionWarning'
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
  const [pendingUpload, setPendingUpload] = useState<File | null>(null)

  const [retryingDocumentId, setRetryingDocumentId] =
    useState<string | null>(null)

  const retryInProgressRef = useRef(false)

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

  // Henüz tamamlanmamış assistant mesajını takip ediyoruz.
  const pendingAssistantRef = useRef<{
    documentId: string
    messageId: string
  } | null>(null)

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
      // Eski SSE isteğini geçersiz kılıyoruz.
      streamRequestIdRef.current += 1

      // Devam eden ağ isteğini iptal ediyoruz.
      streamControllerRef.current?.abort()
      streamControllerRef.current = null

      // İptal edilen isteğin yarım assistant yanıtını siliyoruz.
      const pending = pendingAssistantRef.current

      if (pending) {
        setMessagesByDocument((previous) => ({
          ...previous,
          [pending.documentId]: (
            previous[pending.documentId] ?? []
          ).filter((item) => item.id !== pending.messageId),
        }))

        pendingAssistantRef.current = null
      }

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

  const handleFileSelect = async (file: File, acknowledgeInjection = false) => {
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
      const uploadResult = await uploadDocument(file, undefined, acknowledgeInjection)
      if (uploadResult.requires_confirmation) {
        setPendingUpload(file)
        return
      }
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

  // Failed durumundaki belgeyi yeniden işlemeye gönderiyoruz.
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

    pendingAssistantRef.current = {
      documentId,
      messageId: assistantMessageId,
    }

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

            // Yanıt başarıyla tamamlandı; artık silinmemeli.
            pendingAssistantRef.current = null

            // Yalnızca yanıtın gerçekten kullandığı kaynakları saklıyoruz.
            const citedSources = receivedSources.filter((source) =>
              result.cited_labels.includes(source.label)
            )

            // Tamamlanan yanıtı kaynak ve performans bilgileriyle saklıyoruz.
            const completedMessage: ChatMessage = {
              id: assistantMessageId,
              role: 'assistant',
              content: result.answer,
              sources: citedSources,
              metrics: {
                cacheHit: result.cache_hit,
                tokenCount:
                  result.generation_token_usage?.total_token_count ?? null,
                latencyMs: result.latency_ms,
                aiMode: result.ai_mode,
              },
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
      {pendingUpload && (
        <InjectionWarning
          fileName={pendingUpload.name}
          onCancel={() => {
            setPendingUpload(null)
            setFeedback({ type: 'success', title: 'Upload canceled', message: 'The document was deleted.' })
          }}
          onConfirm={() => {
            const file = pendingUpload
            setPendingUpload(null)
            void handleFileSelect(file, true)
          }}
        />
      )}
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
              isRetrying={retryingDocumentId === selectedDocumentId}
              onRetryDocument={handleRetryDocument}
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
