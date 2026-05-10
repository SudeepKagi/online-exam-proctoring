import React from 'react'

export default function MCQQuestion({ question, selectedOption, onSelect }) {
  const options = question.options || []

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '2rem', lineHeight: 1.5 }}>
        {question.questionText}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {options.map((option, index) => {
          const optionLabel = String.fromCharCode(65 + index) // A, B, C, D
          const isSelected = selectedOption === optionLabel
          
          return (
            <button
              key={index}
              onClick={() => onSelect(optionLabel)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.25rem',
                borderRadius: '12px',
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                background: isSelected ? 'var(--primary-container)' : 'var(--surface)',
                color: isSelected ? 'var(--on-primary-container)' : 'var(--on-surface)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: isSelected ? '6px solid var(--primary)' : '2px solid var(--outline)',
                background: '#fff'
              }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, marginRight: '0.75rem' }}>{optionLabel}.</span>
                {option}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
