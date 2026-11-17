import React from 'react'
import { ShieldAlert, RefreshCw, Home, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import COPY from '@/copy'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorRefId: null,
      copied: false
    }
  }

  static getDerivedStateFromError(error) {
    const errorRefId = `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`
    return { hasError: true, error, errorRefId }
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      `[ErrorBoundary ${this.state.errorRefId}] Caught unhandled rendering failure:`,
      error,
      errorInfo
    )
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorRefId: null,
      copied: false
    })
  }

  handleCopyRefId = () => {
    if (this.state.errorRefId && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this.state.errorRefId).catch(() => {})
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2500)
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoDashboard = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const isDev = Boolean(import.meta.env?.DEV)

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#fbfcfd] font-sans text-[#28253b]">
          <div className="max-w-md w-full bg-[#edecfb] rounded-[20px] p-8 sm:p-10 text-center shadow-xs">
            <div className="w-14 h-14 rounded-full bg-white text-[#5266eb] flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={28} />
            </div>

            <h2 className="text-xl font-[480] text-[#28253b] tracking-tight mb-2">
              {COPY.errors.boundaryTitle}
            </h2>
            <p className="text-xs text-[#554e7b] font-[360] leading-relaxed mb-6">
              {COPY.errors.boundarySubtitle}
            </p>

            {/* Error Reference ID Display */}
            {this.state.errorRefId && (
              <div className="mb-6 p-3 bg-white rounded-[14px] flex items-center justify-between gap-3 text-left">
                <div>
                  <span className="block text-[10px] font-[500] uppercase tracking-wider text-[#554e7b]">
                    {COPY.errors.referenceIdLabel}
                  </span>
                  <span className="font-mono text-xs font-[480] text-[#5266eb]">
                    {this.state.errorRefId}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={this.handleCopyRefId}
                  title="Copy Reference ID"
                >
                  {this.state.copied ? (
                    <>
                      <Check size={12} className="text-[#5266eb]" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </Button>
              </div>
            )}

            {isDev && this.state.error && (
              <div className="mb-6 p-4 bg-white rounded-[14px] text-left max-h-36 overflow-y-auto">
                <p className="text-xs font-mono font-[480] text-[#5266eb] mb-1">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] font-mono text-[#554e7b] whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                type="button"
                variant="primary"
                onClick={this.handleReload}
              >
                <RefreshCw size={14} /> {COPY.errors.reloadButton}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={this.handleGoDashboard}
              >
                <Home size={14} /> {COPY.errors.dashboardButton}
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
