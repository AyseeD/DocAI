import type {
  DocumentSummary,
  DocumentDetail,
  UploadDocumentResponse,
  RetryDocumentResponse,
} from '../types/document'

// API adresini tek yerden yönetiyoruz.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// Backend hata mesajını mümkün olduğunda kullanıcıya aktarıyoruz.
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null)

    let message = `Request failed (${response.status})`

    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = data.detail

      if (typeof detail === 'string') {
        message = detail
      } else if (Array.isArray(detail)) {
        message = detail
          .map((item: unknown) => {
            if (
              item &&
              typeof item === 'object' &&
              'msg' in item &&
              typeof item.msg === 'string'
            ) {
              return item.msg
            }
            return 'Validation error'
          })
          .join(', ')
      }
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

// Backend'deki belgeleri listeler.
export async function getDocuments(): Promise<DocumentSummary[]> {
  const response = await fetch(`${API_BASE_URL}/documents`)
  return handleResponse<DocumentSummary[]>(response)
}

// Seçilen dosyayı backend'e gönderir.
export async function uploadDocument(
  file: File,
  signal?: AbortSignal
): Promise<UploadDocumentResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/documents`, {
    method: 'POST',
    body: formData,
    signal,
  })

  return handleResponse<UploadDocumentResponse>(response)
}

// Belgenin güncel işlenme durumunu getirir.
export async function getDocument(
  documentId: string
): Promise<DocumentDetail> {
  const response = await fetch(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`
  )

  return handleResponse<DocumentDetail>(response)
}

// Başarısız bir belgeyi yeniden işleme kuyruğuna alır.
export async function retryDocument(
  documentId: string
): Promise<RetryDocumentResponse> {
  const response = await fetch(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/retry`,
    { method: 'POST' }
  )

  return handleResponse<RetryDocumentResponse>(response)
}
