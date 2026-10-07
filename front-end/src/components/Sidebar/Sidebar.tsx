import './Sidebar.css'

type Document = {
  id: string
  filename: string
  status: 'ready' | 'processing' | 'failed'
}

type SidebarProps = {
  documents: Document[]
}

function Sidebar({ documents }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">DocAI</div>

      <button className="add-document-button">
        + Add document
      </button>

      <div className="documents-section">
        <h2>Documents</h2>

        <div className="document-list">
          {documents.map((document) => (
            <div className="document-item" key={document.id}>
              <div className="document-name">
                {document.filename}
              </div>

              <div className={`document-status ${document.status}`}>
                {document.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar