import './Sidebar.css'

// Sidebar'ın aldığı belge verisinin yapısını tanımlıyoruz.
type Document = {
  id: string
  filename: string
  status: 'ready' | 'processing' | 'failed'
}

// Parent component'ten alınacak verileri ve kullanıcı etkileşiminde çağrılacak fonksiyonu tanımlıyoruz.
type SidebarProps = {
  documents: Document[]
  selectedDocumentId: string | null
  onSelectDocument: (documentId: string) => void
}

function Sidebar({
  documents,
  selectedDocumentId,
  onSelectDocument,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">DocAI</div>

      <button type="button" className="add-document-button">
        + Add document
      </button>

      <div className="documents-section">
        <h2>Documents</h2>

        <div className="document-list">
          {/* Her belgeyi seçilebilir bir buton olarak gösteriyoruz.
          Tıklanan belgenin ID'sini parent'a bildiriyoruz. */}
          {documents.map((document) => (
            <button
              type="button"
              key={document.id}
              // Aktif belgeye görsel olarak farklı stil uyguluyoruz.
              className={`document-item ${
                selectedDocumentId === document.id ? 'selected' : ''
              }`}
              // Seçilen belgenin ID'sini App'e bildiriyoruz.
              onClick={() => onSelectDocument(document.id)}
              aria-pressed={selectedDocumentId === document.id}
            >
              <div className="document-name">
                {document.filename}
              </div>

              <div className={`document-status ${document.status}`}>
                {document.status}
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
