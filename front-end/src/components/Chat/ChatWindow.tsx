
import { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage'
import type { ChatMessage as ChatMessageType } from '../../types/chat'
import './ChatWindow.css'

type ChatWindowProps = {
  messages: ChatMessageType[]
  documentName: string | null
}

function ChatWindow({
  messages,
  documentName,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Yeni mesaj geldiğinde sohbetin sonuna kaydırıyoruz.
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <section className="chat-window">
      {messages.length === 0 ? (
        <div className="chat-window-empty">
          <h2>
            {documentName
              ? `Chat with ${documentName}`
              : 'Ask about your documents'}
          </h2>
          <p>
            {documentName
              ? 'Ask a question to start the conversation.'
              : 'Select a ready document to get started.'}
          </p>
        </div>
      ) : (
        <div className="chat-messages">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </section>
  )
}

export default ChatWindow
