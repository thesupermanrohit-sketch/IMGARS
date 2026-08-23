import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#111111] border border-[#1f1f1f] p-6 flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#ff4444]/10 border border-[#ff4444]/20 flex items-center justify-center text-[#ff4444]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            
            <h1 className="text-base font-medium text-white">Something went wrong</h1>
            
            <p className="text-xs text-[#666666] leading-relaxed">
              An unexpected error occurred while processing. You can reload the app to continue.
            </p>

            {this.state.error?.message && (
              <pre className="w-full text-left text-[11px] text-[#ff4444] bg-[#0a0a0a] p-3 border border-[#1f1f1f] overflow-x-auto">
                {this.state.error.message}
              </pre>
            )}

            <div className="flex items-center gap-3 w-full mt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 bg-white text-black py-2 text-xs font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload App
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 border border-[#1f1f1f] text-white py-2 text-xs font-medium hover:border-white transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
