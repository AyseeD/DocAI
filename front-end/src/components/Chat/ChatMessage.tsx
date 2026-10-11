
import type { ChatMessage as ChatMessageType } from '../../types/chat'
import SourceCards from './SourceCards'
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
        <div className="chat-message-author">
          DocAI
        </div>
      )}

      <div className="chat-message-content">
        {message.content}
      </div>

      {!isUser &&
        message.sources &&
        message.sources.length > 0 && (
          <SourceCards sources={message.sources} />
        )}
    </article>
  )
}

export default ChatMessage
