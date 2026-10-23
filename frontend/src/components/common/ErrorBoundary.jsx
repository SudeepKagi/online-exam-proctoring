import React from 'react'
import { ShieldAlert, RefreshCw, Home } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught unhandled rendering failure:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
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

      const isDev = import.meta.env?.DEV

      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-[#fbfcfd] font-sans">
          <div className="max-w-md w-full bg-[#edecfb] rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-white text-[#5266eb] flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={24} />
            </div>

            <h2 className="text-xl font-[480] text-[#28253b] tracking-tight mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-[#554e7b] font-[360] leading-relaxed mb-6">
              An unexpected error occurred while rendering this section. Your examination session and saved answers remain secure.
            </p>

            {isDev && this.state.error && (
              <div className="mb-6 p-4 bg-white rounded-lg text-left max-h-36 overflow-y-auto">
                <p className="text-xs font-mono font-[480] text-[#5266eb] mb-1">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[11px] font-mono text-[#554e7b] whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="h-10 px-5 text-sm font-[420] bg-[#5266eb] hover:bg-[#4354d0] text-white rounded-[32px] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw size={14} /> Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoDashboard}
                className="h-10 px-5 text-sm font-[420] bg-[rgba(82,102,235,0.10)] hover:bg-[rgba(82,102,235,0.18)] text-[#28253b] rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home size={14} /> Return to Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
