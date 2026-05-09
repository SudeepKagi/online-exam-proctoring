import { createContext, useContext, useState } from 'react'

const ExamContext = createContext(null)

export function ExamProvider({ children }) {
  const [exam, setExam]                   = useState(null)
  const [questions, setQuestions]         = useState([])
  const [answers, setAnswers]             = useState({})
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [optionOrderMap, setOptionOrderMap] = useState({})
  const [studentExamId, setStudentExamId] = useState(null)
  const [securityPassed, setSecurityPassed] = useState(false)

  const saveAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  const resetExam = () => {
    setExam(null)
    setQuestions([])
    setAnswers({})
    setCurrentIndex(0)
    setOptionOrderMap({})
    setStudentExamId(null)
    setSecurityPassed(false)
  }

  return (
    <ExamContext.Provider value={{
      exam, setExam,
      questions, setQuestions,
      answers, saveAnswer,
      currentIndex, setCurrentIndex,
      optionOrderMap, setOptionOrderMap,
      studentExamId, setStudentExamId,
      securityPassed, setSecurityPassed,
      resetExam,
    }}>
      {children}
    </ExamContext.Provider>
  )
}

export function useExam() {
  const ctx = useContext(ExamContext)
  if (!ctx) throw new Error('useExam must be used within ExamProvider')
  return ctx
}
