
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export type Source = {
  label: number
  chunk_id: string
  doc_id: string
  name: string
  page_number: number | null
  section: string | null
  content: string
}

export type QuestionResult = {
  answer: string
  cited_labels: number[]
  cache_hit: boolean
  generation_token_usage: {
    total_token_count: number
  } | null
  latency_ms: number
  ai_mode: string
  document_id: string
}

type StreamCallbacks = {
  onSources: (sources: Source[]) => void
  onDelta: (text: string) => void
  onDone: (result: QuestionResult) => void
}

type SSEMessage = {
  event: string
  data: string
}

// Backend'in JSON veya validation hatalarını okunabilir hâle getiriyoruz.
async function getErrorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null)

  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = body.detail

    if (typeof detail === 'string') return detail

    if (Array.isArray(detail)) {
      return detail
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

  return `Request failed (${response.status})`
}

// Tek bir SSE frame'ini event ve data alanlarına ayırıyoruz.
function parseSSEFrame(frame: string): SSEMessage | null {
  let event = 'message'
  const dataLines: string[] = []

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) return null

  return {
    event,
    data: dataLines.join('\n'),
  }
}

export async function streamQuestion(
  question: string,
  documentId: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/questions/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      document_id: documentId,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  if (!response.body) {
    throw new Error('Streaming response is not available.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ''
  let completed = false

  // SSE mesajları boş satırlarla ayrılır.
  const processFrame = (frame: string) => {
    const message = parseSSEFrame(frame)
    if (!message) return

    switch (message.event) {
      case 'sources': {
        const data = JSON.parse(message.data) as {
          sources: Source[]
        }
        callbacks.onSources(data.sources)
        break
      }

      case 'delta': {
        const data = JSON.parse(message.data) as {
          text: string
        }
        callbacks.onDelta(data.text)
        break
      }

      case 'done': {
        const data = JSON.parse(message.data) as QuestionResult

        if (data.document_id !== documentId) {
          throw new Error('Response document does not match the selected document.')
        }

        completed = true
        callbacks.onDone(data)
        break
      }

      case 'error': {
        const data = JSON.parse(message.data) as {
          message: string
        }
        throw new Error(data.message || 'Answer generation failed.')
      }
    }
  }

  try {
    while (!completed) {
      const { done, value } = await reader.read()

      if (done) {
        buffer += decoder.decode()
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // CRLF ve CR satır sonlarını LF'ye dönüştürüyoruz.
      buffer = buffer.replace(/\r\n?/g, '\n')

      let separatorIndex = buffer.indexOf('\n\n')

      while (separatorIndex !== -1) {
        const frame = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)

        processFrame(frame)

        if (completed) break

        separatorIndex = buffer.indexOf('\n\n')
      }
    }

    if (!completed && buffer.trim()) {
      processFrame(buffer)
    }

    if (!completed) {
      throw new Error('Stream ended before completion.')
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
