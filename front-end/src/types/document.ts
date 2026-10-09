export type DocumentStatus = 'queued' | 'ready' | 'failed'

// GET /documents yanıtındaki belge modeli.
export type DocumentSummary = {
  id: string
  name: string
  size: number
  mime_type: string
  status: DocumentStatus
  created_at: string
  processed_at: string | null
  error: string | null
}

// GET /documents/{doc_id} mime_type döndürmüyor.
export type DocumentDetail = Omit<DocumentSummary, 'mime_type'>

// POST /documents yanıtı.
export type UploadDocumentResponse = {
  id: string
  status: DocumentStatus
  duplicate: boolean
}

// POST /documents/{doc_id}/retry yanıtı.
export type RetryDocumentResponse = {
  id: string
  status: 'queued'
}
