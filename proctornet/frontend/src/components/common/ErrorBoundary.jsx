import React from 'react'
import { ShieldAlert, RefreshCw, ArrowLeft, Home } from 'lucide-react'

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

      const isDev = import.meta.env.DEV

      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-7 shadow-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={28} />
            </div>

            <h2 className="text-lg font-semibold text-slate-900 tracking-tight mb-1">
              Something went wrong
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
              An unexpected error occurred while rendering this section. Your session and saved data remain secure.
            </p>

            {isDev && this.state.error && (
              <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left max-h-32 overflow-y-auto">
                <p className="text-[11px] font-mono font-bold text-rose-600 mb-1">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] font-mono text-slate-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 text-xs font-bold bg-[#2f80ed] hover:bg-[#2563eb] text-white rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} /> Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoDashboard}
                className="px-4 py-2 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home size={13} /> Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
