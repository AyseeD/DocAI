
import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import './ChatInput.css'

type ChatInputProps = {
  onSendMessage: (message: string) => void
  onFileSelect?: (file: File) => void
  disabled?: boolean
  isUploading?: boolean
  isHome?: boolean
}

function ChatInput({
  onSendMessage,
  onFileSelect,
  disabled = false,
  isUploading = false,
  isHome = false,
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canSend = !disabled && message.trim().length > 0

  const sendMessage = () => {
    if (!canSend) return

    onSendMessage(message.trim())
    setMessage('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendMessage()
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      sendMessage()
    }
  }

  return (
    <form
      className={`chat-input-form ${isHome ? 'home-chat-input' : ''}`}
      onSubmit={handleSubmit}
    >
      <textarea
        className="chat-input-textarea"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          isHome
            ? 'Select or upload a document to start chatting...'
            : disabled
              ? 'Select a ready document to start chatting'
              : 'Ask anything about this document...'
        }
        disabled={disabled}
        rows={2}
        maxLength={2000}
        aria-label="Ask a question about the document"
      />

      <div className="chat-input-actions">
        <div className="chat-input-left">
          {onFileSelect && (
            <>
              <button
                type="button"
                className="chat-attach-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                aria-label="Attach document"
                title="Attach PDF or TXT"
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
                </svg>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                hidden
                disabled={isUploading}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onFileSelect(file)
                  event.target.value = ''
                }}
              />
            </>
          )}

          <span className="chat-input-hint">
            {isHome
              ? 'Attach PDF or TXT'
              : 'Enter to send · Shift + Enter for new line'}
          </span>
        </div>

        <button
          type="submit"
          className="chat-send-button"
          disabled={!canSend}
          aria-label="Send message"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      </div>
    </form>
  )
}

export default ChatInput
