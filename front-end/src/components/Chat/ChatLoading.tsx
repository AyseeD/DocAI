
import './ChatLoading.css'

function ChatLoading() {
  return (
    <div
      className="chat-loading"
      role="status"
      aria-label="DocAI is preparing a response"
    >
      <span className="chat-loading-label">DocAI</span>

      <div className="chat-loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <span className="chat-loading-text">Preparing answer and checking references...</span>
    </div>
  )
}

export default ChatLoading
