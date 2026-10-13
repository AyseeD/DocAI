
import type { ChatMessage as ChatMessageType } from '../../types/chat'
import SourceCards from './SourceCards'
import './ChatMessage.css'

type ChatMessageProps = {
  message: ChatMessageType
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const metrics = message.metrics

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

      {!isUser && metrics && (
        <div
          className="chat-message-metrics"
          aria-label="Answer performance information"
        >
          <span>
            {metrics.cacheHit
              ? 'Cached response'
              : 'New response'}
          </span>

          <span aria-hidden="true">·</span>

          <span>
            {metrics.tokenCount === null
              ? 'Tokens unavailable'
              : `${metrics.tokenCount} tokens`}
          </span>

          <span aria-hidden="true">·</span>

          <span>
            {metrics.latencyMs} ms
          </span>

          {metrics.aiMode === 'mock' && (
            <>
              <span aria-hidden="true">·</span>
              <span>Mock mode</span>
            </>
          )}
        </div>
      )}
    </article>
  )
}

export default ChatMessage
