import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  override render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <div className="rounded-lg border border-red-700 bg-red-950/40 p-4">
            <h2 className="text-sm font-semibold text-red-200">Something broke in the UI</h2>
            <pre className="text-xs text-red-300 whitespace-pre-wrap mt-2">{String(this.state.error)}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
