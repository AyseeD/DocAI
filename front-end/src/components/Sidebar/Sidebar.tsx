
import { useRef } from 'react'
import './Sidebar.css'

// Sidebar'ın kullanacağı belge veri yapısı.
type Document = {
  id: string
  filename: string
  status: 'ready' | 'processing' | 'failed'
}

// Parent component'ten alınan veriler ve callback fonksiyonları.
type SidebarProps = {
  documents: Document[]
  selectedDocumentId: string | null
  onSelectDocument: (documentId: string) => void
  onFileSelect: (file: File) => void
}

function Sidebar({
  documents,
  selectedDocumentId,
  onSelectDocument,
  onFileSelect,
}: SidebarProps) {
  // Gizli dosya input'una erişmek için ref kullanıyoruz.
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">DocAI</div>

      {/* Özel butonumuz üzerinden dosya seçme penceresini açıyoruz. */}
      <button
        type="button"
        className="add-document-button"
        onClick={() => fileInputRef.current?.click()}
      >
        + Add document
      </button>

      {/* Seçilen dosyayı App'e iletiyoruz. */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]

          if (file) {
            onFileSelect(file)
          }

          // Aynı dosyanın tekrar seçilmesini algılayabilmek için.
          event.target.value = ''
        }}
      />

      <div className="documents-section">
        <h2>Documents</h2>

        <div className="document-list">
          {/* Belgeleri seçilebilir butonlar olarak oluşturuyoruz. */}
          {documents.map((document) => {
            const isSelected = selectedDocumentId === document.id

            return (
              <button
                type="button"
                key={document.id}
                className={`document-item ${
                  isSelected ? 'selected' : ''
                }`}
                onClick={() => onSelectDocument(document.id)}
                aria-pressed={isSelected}
              >
                <div className="document-name">
                  {document.filename}
                </div>

                <div className={`document-status ${document.status}`}>
                  {document.status}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
