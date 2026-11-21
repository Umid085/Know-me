import React from 'react';
import { RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', isQuotaError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'Something unexpected happened.';
    let isQuotaError = false;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        message = parsed.error;
      }
    } catch {
      // keep raw message
    }
    if (message.toLowerCase().includes('quota exceeded')) {
      isQuotaError = true;
    }
    return { hasError: true, message, isQuotaError };
  }

  componentDidCatch(error: Error) {
    console.error('Know Me ErrorBoundary caught:', error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#231F1D] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-[#E5DDD1] rounded-xl p-8 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-mono text-[#6D645D]">Know Me</p>
            <h1 className="text-2xl font-serif font-semibold text-[#231F1D]">
              {this.state.isQuotaError
                ? 'Daily database quota reached'
                : 'Unable to complete that action'}
            </h1>
            <p className="text-sm text-[#6D645D] leading-relaxed">
              {this.state.isQuotaError
                ? 'The free daily Firestore quota for this project has been exceeded. Quota resets tomorrow, or you can upgrade the project plan in the Firebase Console.'
                : this.state.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#2C4C3B] hover:bg-[#213B2D] rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload workspace
          </button>
        </div>
      </div>
    );
  }
}
