import React from 'react'
import Editor from '@monaco-editor/react'

export default function CodeQuestion({ question, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--outline-variant)' }}>
        <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          {question.questionText}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span className="badge badge-neutral">{question.codeLanguage || 'javascript'}</span>
          <span className="badge badge-neutral">{question.marks} Points</span>
        </div>
      </div>
      
      <div style={{ flex: 1, minHeight: '400px', border: '1px solid var(--outline-variant)', borderRadius: '8px', overflow: 'hidden', margin: '1rem' }}>
        <Editor
          height="100%"
          language={question.codeLanguage?.toLowerCase() || 'javascript'}
          value={value || question.codeTemplate || ''}
          onChange={onChange}
          theme="vs-dark"
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            padding: { top: 10, bottom: 10 }
          }}
        />
      </div>

      <div style={{ padding: '0 1rem 1rem' }}>
        <button className="btn-secondary" style={{ width: '100%' }}>
          Run Test Cases
        </button>
      </div>
    </div>
  )
}
