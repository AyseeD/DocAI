
import type { DocumentSummary } from '../types/document'

// Backend hazır olana kadar arayüzü test etmek için kullanılır.
export const initialMockDocuments: DocumentSummary[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'AI Research.pdf',
    size: 245760,
    mime_type: 'application/pdf',
    status: 'ready',
    created_at: '2026-10-08T10:00:00Z',
    processed_at: '2026-10-08T10:00:05Z',
    error: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Lecture Notes.txt',
    size: 12288,
    mime_type: 'text/plain',
    status: 'queued',
    created_at: '2026-10-08T11:00:00Z',
    processed_at: null,
    error: null,
  },
]
