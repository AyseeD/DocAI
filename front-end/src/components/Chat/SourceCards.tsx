
import { useState } from 'react'
import type { ChatSource } from '../../types/chat'
import './SourceCards.css'

type SourceCardsProps = {
  sources: ChatSource[]
}

function SourceCards({ sources }: SourceCardsProps) {
  // Her kaynak kartının açık/kapalı durumunu ayrı tutuyoruz.
  const [expandedSources, setExpandedSources] = useState<string[]>([])

  const toggleSource = (chunkId: string) => {
    setExpandedSources((previous) =>
      previous.includes(chunkId)
        ? previous.filter((id) => id !== chunkId)
        : [...previous, chunkId]
    )
  }

  return (
    <section className="source-cards" aria-label="Answer sources">
      <div className="source-cards-header">
        <div className="source-cards-title">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2Z" />
          </svg>

          <span>Sources</span>
        </div>

        <span className="source-cards-count">
          {sources.length} {sources.length === 1 ? 'reference' : 'references'}
        </span>
      </div>

      <div className="source-cards-list">
        {sources.map((source) => {
          const isExpanded = expandedSources.includes(source.chunk_id)

          return (
            <div
              className={`source-card ${isExpanded ? 'expanded' : ''}`}
              key={source.chunk_id}
            >
              <button
                type="button"
                className="source-card-trigger"
                onClick={() => toggleSource(source.chunk_id)}
                aria-expanded={isExpanded}
              >
                <span className="source-card-number">
                  {source.label}
                </span>

                <span className="source-card-info">
                  <span className="source-card-name">
                    {source.name}
                  </span>

                  <span className="source-card-meta">
                    {source.page_number !== null
                      ? `Page ${source.page_number}`
                      : 'Text document'}

                    {source.section
                      ? ` · ${source.section}`
                      : ''}
                  </span>
                </span>

                <svg
                  className="source-card-chevron"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {isExpanded && (
                <div className="source-card-content">
                  <div className="source-card-content-label">
                    Retrieved passage
                  </div>

                  <p>{source.content}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default SourceCards
