import { useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar/Sidebar'

type Document = {
  id: string
  filename: string
  status: 'ready' | 'processing' | 'failed'
}

function App() {
  const [documents] = useState<Document[]>([
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
  ])

  return (
    <div className="app">
      <Sidebar documents={documents} />

      <main className="chat-workspace">
        <header className="chat-header">
          <h1>Document Chat</h1>
        </header>

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