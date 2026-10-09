
import { initialMockDocuments } from './mockDocuments'
import type { DocumentSummary } from '../types/document'
import type { ChatMessage } from '../types/chat'

const STORAGE_KEY = 'docai-mock-state-v1'

export type MockAppState = {
  documents: DocumentSummary[]
  selectedDocumentId: string | null
  messagesByDocument: Record<string, ChatMessage[]>
}

// Tarayıcıda daha önce kaydedilmiş mock verileri okur.
export function loadMockState(): MockAppState {
  const fallback: MockAppState = {
    documents: [...initialMockDocuments],
    selectedDocumentId: null,
    messagesByDocument: {},
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (!stored) return fallback

    const parsed: unknown = JSON.parse(stored)

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('documents' in parsed) ||
      !Array.isArray(parsed.documents) ||
      !('messagesByDocument' in parsed) ||
      !parsed.messagesByDocument ||
      typeof parsed.messagesByDocument !== 'object' ||
      Array.isArray(parsed.messagesByDocument)
    ) {
      return fallback
    }

    const state = parsed as MockAppState

    // Önceki oturumda processing durumunda kalan mock belgeleri
    // tekrar kullanılabilir hâle getiriyoruz.
    const documents = state.documents.map((document) =>
      document.status === 'queued'
        ? {
            ...document,
            status: 'ready' as const,
            processed_at: new Date().toISOString(),
          }
        : document
    )

    return {
      documents,
      selectedDocumentId:
        typeof state.selectedDocumentId === 'string' &&
        documents.some((doc) => doc.id === state.selectedDocumentId)
          ? state.selectedDocumentId
          : null,
      messagesByDocument: state.messagesByDocument,
    }
  } catch {
    // Bozuk veya erişilemeyen storage uygulamayı çökertmemeli.
    return fallback
  }
}

// Mock verileri tarayıcıda saklar.
export function saveMockState(state: MockAppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage kullanılamıyorsa uygulama bellek üzerinden çalışmaya devam eder.
  }
}
