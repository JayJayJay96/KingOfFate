import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  readonly error: Error | null;
}

/**
 * Last-resort screen for an unexpected rendering error. Saved data is untouched: every match
 * transition was checkpointed before it rendered, so a reload resumes where play stopped.
 */
export class ErrorBoundary extends Component<{ readonly children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('King of Fate crashed', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="crash" role="alert">
        <h1 className="title__logo">Game over?</h1>
        <p>
          Something went wrong on this screen. Your saved match and history are safe: reloading
          continues from the last saved moment, without re-rolling anything.
        </p>
        <p className="hint">{this.state.error.message}</p>
        <button type="button" className="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </main>
    );
  }
}
