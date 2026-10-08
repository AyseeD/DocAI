
import { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage'
import type { ChatMessage as ChatMessageType } from '../../types/chat'
import type { DocumentSummary } from '../../types/document'
import './ChatWindow.css'

type ChatWindowProps = {
  messages: ChatMessageType[]
  document: DocumentSummary | null
}

function ChatWindow({ messages, document }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Yeni mesaj geldiğinde sohbetin sonuna kaydırıyoruz.
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Seçili belgeye göre empty state içeriğini belirliyoruz.
  const getEmptyState = () => {
    if (!document) {
      return {
        title: 'Ask about your documents',
        description: 'Select a document to get started.',
      }
    }

    switch (document.status) {
      case 'queued':
        return {
          title: 'Preparing your document',
          description: `${document.name} is being processed. Please wait.`,
        }

      case 'ready':
        return {
          title: `Chat with ${document.name}`,
          description: 'Ask a question to start the conversation.',
        }

      case 'failed':
        return {
          title: 'Document processing failed',
          description:
            document.error ??
            "This document couldn't be processed.",
        }
    }
  }

  const emptyState = getEmptyState()

  return (
    <section className="chat-window">
      {messages.length === 0 ? (
        <div className="chat-window-empty">
          <h2>{emptyState.title}</h2>
          <p>{emptyState.description}</p>
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
