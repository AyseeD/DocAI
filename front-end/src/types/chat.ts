
export type ChatRole = 'user' | 'assistant'

export type ChatSource = {
  label: number
  chunk_id: string
  doc_id: string
  name: string
  page_number: number | null
  section: string | null
  content: string
}

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  sources?: ChatSource[]
  createdAt: string
}
