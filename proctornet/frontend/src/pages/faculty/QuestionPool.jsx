import React, { useState } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import { FormInput, SelectInput, SubmitButton, FormTextarea } from '@/components/common/FormComponents'

function Icon({ name, style }) {
  return <span className="material-icon" style={style}>{name}</span>
}

const navItems = [
  { to: '/faculty/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/faculty/exams', icon: 'assignment', label: 'My Exams' },
  { to: '/faculty/question-pool', icon: 'quiz', label: 'Question Bank' },
  { to: '/faculty/students', icon: 'groups', label: 'My Students' },
  { to: '/faculty/results', icon: 'analytics', label: 'Results & Reports' },
]

export default function FacultyQuestionPool() {
  const [activeTab, setActiveTab] = useState('bank')

  return (
    <DashboardLayout navItems={navItems}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Question Bank</h1>
          <p className="page-subtitle">Manage and organize your reusable question repository.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={() => setActiveTab('import')}>
            <Icon name="upload_file" /> Import CSV
          </button>
          <button className="btn-primary" onClick={() => setActiveTab('add')}>
            <Icon name="add" /> New Question
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ borderBottom: '1px solid var(--outline-variant)', display: 'flex', gap: '2rem', padding: '0 1.5rem' }}>
          <button 
            style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeTab === 'bank' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeTab === 'bank' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('bank')}
          >
            Question Repository
          </button>
          <button 
            style={{ background: 'none', border: 'none', padding: '1rem 0', fontWeight: 600, color: activeTab === 'add' ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: activeTab === 'add' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('add')}
          >
            Add Question
          </button>
        </div>

        <div className="card-body">
          {activeTab === 'bank' && (
            <div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                  <FormInput id="search-q" placeholder="Search questions..." prefixIcon="search" />
                </div>
                <div style={{ width: '200px' }}>
                  <SelectInput id="filter-topic" options={[{value: '', label: 'All Topics'}, {value: 'ds', label: 'Data Structures'}]} />
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Question Prompt</th>
                    <th>Type</th>
                    <th>Topic</th>
                    <th>Difficulty</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 500, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>What is the time complexity of a binary search tree?</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>Multiple Choice</td>
                    <td>Data Structures</td>
                    <td><span className="badge badge-warning">Medium</span></td>
                    <td>
                      <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginRight: '0.5rem' }}><Icon name="edit" size={16} /></button>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Explain the difference between a process and a thread.</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>Descriptive</td>
                    <td>Operating Systems</td>
                    <td><span className="badge badge-info">Easy</span></td>
                    <td>
                      <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginRight: '0.5rem' }}><Icon name="edit" size={16} /></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'add' && (
            <div style={{ maxWidth: '800px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <SelectInput 
                  id="q-topic" label="Topic / Course"
                  options={[{value: 'ds', label: 'Data Structures'}, {value: 'os', label: 'Operating Systems'}]}
                />
                <SelectInput 
                  id="q-type" label="Question Type"
                  options={[{value: 'mcq', label: 'Multiple Choice'}, {value: 'subjective', label: 'Descriptive Text'}]}
                />
              </div>

              <FormTextarea 
                id="q-prompt" label="Question Prompt" placeholder="Enter the question text..." rows={4}
              />

              <div style={{ padding: '1rem', background: 'var(--surface-container-lowest)', border: '1px solid var(--outline-variant)', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '1rem' }}>Options (For MCQ)</h4>
                {['A', 'B', 'C', 'D'].map((opt) => (
                  <div key={opt} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <input type="radio" name="correct-option" style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                    <FormInput id={`opt-${opt}`} placeholder={`Option ${opt}`} style={{ marginBottom: 0, flex: 1 }} />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button className="btn-secondary" onClick={() => setActiveTab('bank')}>Cancel</button>
                <SubmitButton style={{ width: 'auto', marginTop: 0 }} onClick={(e) => { e.preventDefault(); setActiveTab('bank') }}>Save Question</SubmitButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
