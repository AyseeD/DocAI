
import ChatInput from '../Chat/ChatInput'
import './HomeWorkspace.css'

type HomeWorkspaceProps = {
  onFileSelect: (file: File) => void
  isUploading: boolean
}

function HomeWorkspace({
  onFileSelect,
  isUploading,
}: HomeWorkspaceProps) {
  return (
    <section className="home-workspace">
      <div className="home-workspace-content">
        <div className="home-illustration" aria-hidden="true">
          <svg
            width="86"
            height="86"
            viewBox="0 0 86 86"
            fill="none"
          >
            <rect
              x="20"
              y="9"
              width="46"
              height="64"
              rx="10"
              fill="#E8E9FF"
            />
            <rect
              x="28"
              y="22"
              width="30"
              height="4"
              rx="2"
              fill="#969AF6"
            />
            <rect
              x="28"
              y="34"
              width="30"
              height="4"
              rx="2"
              fill="#B5B8FF"
            />
            <rect
              x="28"
              y="46"
              width="23"
              height="4"
              rx="2"
              fill="#B5B8FF"
            />
            <path
              d="M70 7L73 14L80 17L73 20L70 27L67 20L60 17L67 14L70 7Z"
              fill="#8589F5"
            />
          </svg>
        </div>

        <div className="home-heading">
          <h2>What would you like to explore?</h2>
          <p>
            Upload a document to start asking questions.
          </p>
        </div>

        <div className="home-input-wrapper">
          <ChatInput
            onSendMessage={() => {}}
            onFileSelect={onFileSelect}
            isUploading={isUploading}
            disabled
            isHome
          />

          <p className="home-input-note">
            Or select an existing document from the sidebar.
          </p>
        </div>
      </div>
    </section>
  )
}

export default HomeWorkspace
