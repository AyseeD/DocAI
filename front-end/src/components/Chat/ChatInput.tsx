
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import './ChatInput.css'

type ChatInputProps = {
  onSendMessage: (message: string) => void
  disabled?: boolean
}

function ChatInput({
  onSendMessage,
  disabled = false,
}: ChatInputProps) {
  const [message, setMessage] = useState('')

  const canSend = !disabled && message.trim().length > 0

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSend) return

    onSendMessage(message.trim())
    setMessage('')
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()

      if (canSend) {
        onSendMessage(message.trim())
        setMessage('')
      }
    }
  }

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <textarea
        className="chat-input-textarea"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          disabled
            ? 'Select a ready document to start chatting'
            : 'Ask anything about this document...'
        }
        disabled={disabled}
        rows={2}
        maxLength={2000}
        aria-label="Ask a question about the document"
      />

      <div className="chat-input-actions">
        <span className="chat-input-hint">
          Enter to send · Shift + Enter for new line
        </span>

        <button
          type="submit"
          className="chat-send-button"
          disabled={!canSend}
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
    </form>
  )
}

export default ChatInput
