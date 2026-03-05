import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-[#06060f] flex items-center justify-center p-6" dir="rtl">
          <div className="max-w-md w-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-white mb-2" style={{ fontFamily: "Outfit" }}>
              حدث خطأ غير متوقع
            </h1>
            <p className="text-white/40 text-sm mb-6">
              نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.
            </p>
            {process.env.NODE_ENV !== "production" && this.state.error && (
              <pre className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 mb-6 text-xs text-red-300/60 text-left overflow-auto max-h-40 font-mono" dir="ltr">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-3 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary rounded-xl font-bold text-sm transition-colors"
              >
                إعادة المحاولة
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 rounded-xl font-bold text-sm transition-colors"
              >
                تحديث الصفحة
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
