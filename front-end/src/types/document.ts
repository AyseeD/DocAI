export type DocumentStatus = 'processing' | 'ready' | 'failed'

export type Document = {
  id: string
  filename: string
  status: DocumentStatus
}