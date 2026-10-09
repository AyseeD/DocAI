
import type { ChatMessage as ChatMessageType } from '../../types/chat'
import './ChatMessage.css'

type ChatMessageProps = {
  message: ChatMessageType
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <article
      className={`chat-message ${isUser ? 'user' : 'assistant'}`}
    >
      {!isUser && (
        <div className="chat-message-author">DocAI</div>
      )}

      <div className="chat-message-content">
        {message.content}
      </div>

      {message.sources && message.sources.length > 0 && (
        <div className="chat-message-sources">
          {message.sources.map((source) => (
            <span className="chat-source" key={source.chunk_id}>
              [{source.label}] {source.name}
              {source.page_number !== null
                ? ` · Page ${source.page_number}`
                : ''}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

export default ChatMessage
