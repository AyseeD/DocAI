
import { useState } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import './App.css'

type Document = {
  id: string
  filename: string
  status: 'ready' | 'processing' | 'failed'
}

// Backend entegrasyonu henüz olmadığı için sabit örnek veri var. Şu an değişmediğinden React state kullanmamıza gerek yok.
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
  // Seçim kullanıcı etkileşimiyle değiştiği için state kullanıyoruz.
  const [selectedDocumentId, setSelectedDocumentId] =
    useState<string | null>(null)

  // Seçili belgeyi ID üzerinden buluyoruz. Ayrı state tutmayarak veri tekrarını önlüyoruz.
  const selectedDocument = mockDocuments.find(
    (document) => document.id === selectedDocumentId
  )

  return (
    <div className="app">
      {/* Sidebar'a mevcut belge verilerini ve seçim bilgisini
      iletiyoruz. Callback ile seçim App'te güncelleniyor. */}
      <Sidebar
        documents={mockDocuments}
        selectedDocumentId={selectedDocumentId}
        onSelectDocument={setSelectedDocumentId}
      />

      <main className="chat-workspace">
        <header className="chat-header">
          <h1>
            {selectedDocument
              ? selectedDocument.filename
              : 'Document Chat'}
          </h1>
        </header>

        <section className="chat-content">
          <div className="empty-state">
            <h2>Ask about your documents</h2>
            <p>Upload a PDF or TXT file to start asking questions.</p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
