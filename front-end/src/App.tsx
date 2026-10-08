
import { useState } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import './App.css'

type Document = {
  id: string
  filename: string
  status: 'ready' | 'processing' | 'failed'
}

// Backend entegrasyonu olmadığı için şimdilik örnek belgeler kullanıyoruz.
const mockDocuments: Document[] = [
  {
    id: '1',
    filename: 'AI Research.pdf',
    status: 'ready',
  },
  {
    id: '2',
    filename: 'Lecture Notes.txt',
    status: 'processing',
  },
]

function App() {
  // Kullanıcının seçtiği belgeyi ID üzerinden takip ediyoruz.
  const [selectedDocumentId, setSelectedDocumentId] =
    useState<string | null>(null)

  // Dosya seçimi ve doğrulama sonucunu arayüzde göstermek için.
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  // Seçili belgeyi mevcut listeden buluyoruz.
  const selectedDocument = mockDocuments.find(
    (document) => document.id === selectedDocumentId
  )

  const handleFileSelect = (file: File) => {
    // Dosya uzantısının PDF veya TXT olup olmadığını kontrol ediyoruz.
    const isValidType = /\.(pdf|txt)$/i.test(file.name)

    if (!isValidType) {
      setSelectedFile(null)
      setFileError('Only PDF and TXT files are supported.')
      return
    }

    // Backend bağlantısı olmadığı için dosyayı henüz yüklemiyoruz.
    setSelectedFile(file)
    setFileError(null)
  }

  // Kullanıcının bildirim mesajını kapatmasını sağlıyoruz.
  const dismissFileFeedback = () => {
    setSelectedFile(null)
    setFileError(null)
  }

  return (
    <div className="app">
      {/* Sidebar'a belgeleri, seçimi ve callback fonksiyonlarını iletiyoruz. */}
      <Sidebar
        documents={mockDocuments}
        selectedDocumentId={selectedDocumentId}
        onSelectDocument={setSelectedDocumentId}
        onFileSelect={handleFileSelect}
      />

      <main className="chat-workspace">
        <header className="chat-header">
          <h1>
            {selectedDocument
              ? selectedDocument.filename
              : 'Document Chat'}
          </h1>
        </header>

        {/* Dosya seçimi veya hata oluştuğunda geri bildirim gösteriyoruz. */}
        {(selectedFile || fileError) && (
          <div
            className={`file-feedback ${fileError ? 'error' : 'success'}`}
            role={fileError ? 'alert' : 'status'}
          >
            <div>
              <strong>
                {fileError
                  ? 'Unsupported file type'
                  : selectedFile?.name}
              </strong>

              <p>
                {fileError
                  ? fileError
                  : 'File selected. Not uploaded yet.'}
              </p>
            </div>

            <button
              type="button"
              className="file-feedback-close"
              aria-label="Dismiss file notification"
              onClick={dismissFileFeedback}
            >
              ×
            </button>
          </div>
        )}

        <section className="chat-content">
          <div className="empty-state">
            <h2>Ask about your documents</h2>
            <p>
              Upload a PDF or TXT file to start asking questions.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
