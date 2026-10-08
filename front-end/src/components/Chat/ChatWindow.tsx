
import { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage'
import ChatLoading from './ChatLoading'
import type { ChatMessage as ChatMessageType } from '../../types/chat'
import type { DocumentSummary } from '../../types/document'
import './ChatWindow.css'

type ChatWindowProps = {
  messages: ChatMessageType[]
  document: DocumentSummary | null
  isLoading: boolean
  isStreaming: boolean
}

function ChatWindow({
  messages,
  document,
  isLoading,
  isStreaming,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length > 0 || isLoading) {
      bottomRef.current?.scrollIntoView({
        behavior: isStreaming ? 'instant' : 'smooth',
      })
    }
  }, [messages, isLoading, isStreaming])

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
            document.error ?? "This document couldn't be processed.",
        }
    }
  }

  const emptyState = getEmptyState()
  const showConversation = messages.length > 0 || isLoading

  return (
    <section className="chat-window">
      {!showConversation ? (
        <div className="chat-window-empty">
          <h2>{emptyState.title}</h2>
          <p>{emptyState.description}</p>
        </div>
      ) : (
        <div className="chat-messages">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && <ChatLoading />}

          <div ref={bottomRef} />
        </div>
      )}
    </section>
  )
}

export default ChatWindow
