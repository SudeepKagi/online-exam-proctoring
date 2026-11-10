import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UploadCloud, FileText, ArrowRight, Sparkles, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { api, errorMessage } from '@/lib/apiClient'

export default function ExamWizardStepUpload({
  onPdfExtracted,
  onSkipToManual,
  draftStatus,
  onDraftResume
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const validateFile = (selectedFile) => {
    if (!selectedFile) return false
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file (.pdf). Other formats are not supported.')
      return false
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('PDF file size exceeds maximum limit of 10 MB. Please upload a smaller document.')
      return false
    }
    setError('')
    return true
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const droppedFile = e.dataTransfer?.files?.[0]
    if (validateFile(droppedFile)) {
      setFile(droppedFile)
    }
  }

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0]
    if (validateFile(selected)) {
      setFile(selected)
    }
  }

  const handleExtract = async () => {
    if (!file) return
    setIsExtracting(true)
    setError('')
    setUploadProgress(20)

    try {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async () => {
        setUploadProgress(50)
        try {
          const res = await api.post('/exams/generate-from-pdf', {
            pdfBase64: reader.result,
            fileName: file.name,
            count: 10,
            difficulty: 'MEDIUM'
          })
          setUploadProgress(100)
          onPdfExtracted(res.data)
        } catch (err) {
          setError(errorMessage(err, 'Failed to extract exam content from PDF. Please enter manually or try another file.'))
        } finally {
          setIsExtracting(false)
        }
      }
      reader.onerror = () => {
        setError('Could not read the selected PDF file.')
        setIsExtracting(false)
      }
    } catch (err) {
      setError(errorMessage(err, 'Unexpected file reading error.'))
      setIsExtracting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center max-w-lg mx-auto">
        <h3 className="text-lg font-[480] text-foreground">Start Your Examination</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Upload a question paper, syllabus, or lecture notes PDF. Our AI will automatically extract questions,
          suggest title, course code, duration, and marking scheme.
        </p>
      </div>

      {draftStatus?.hasDraft && (
        <div className="p-3 bg-[rgba(82,102,235,0.08)] rounded-[14px] flex items-center justify-between text-xs text-foreground">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-primary" />
            <span>Saved draft found from {new Date(draftStatus.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDraftResume}
            className="h-7 text-xs rounded-[40px] px-3 bg-white text-primary border-primary/20 hover:bg-primary/10"
          >
            Resume Draft
          </Button>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-[20px] p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : file
            ? 'border-primary/40 bg-muted/10'
            : 'border-muted-foreground/25 hover:border-primary/40 bg-card'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileSelect}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className={`p-4 rounded-full ${file ? 'bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground'}`}>
            {file ? <FileText className="w-8 h-8" /> : <UploadCloud className="w-8 h-8" />}
          </div>

          <div>
            <p className="text-sm font-[480] text-foreground">
              {file ? file.name : 'Click to select or drag and drop your PDF'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {file
                ? `${(file.size / (1024 * 1024)).toFixed(2)} MB â€¢ Ready for AI analysis`
                : 'Maximum file size: 10 MB â€¢ PDF question papers or notes'}
            </p>
          </div>

          {file && !isExtracting && (
            <div className="pt-2">
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleExtract()
                }}
                className="bg-primary text-primary-foreground font-medium rounded-[40px] px-5 h-9"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze PDF with AI
              </Button>
            </div>
          )}

          {isExtracting && (
            <div className="w-full max-w-xs space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Reading document & generating questions...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 text-xs text-destructive bg-destructive/10 p-3 rounded-[12px] font-[420]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Alternative: Skip to manual entry */}
      <div className="pt-2 flex items-center justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSkipToManual}
          disabled={isExtracting}
          className="text-xs text-muted-foreground hover:text-foreground rounded-[40px] px-4 h-8 bg-transparent border-border hover:bg-muted/20"
        >
          Skip, I'll type the exam details and questions manually <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  )
}

