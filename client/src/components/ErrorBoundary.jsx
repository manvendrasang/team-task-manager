import { Component } from 'react';
import './ErrorBoundary.css';

/**
 * Catches render-time crashes so one broken view can't blank the whole app.
 * Class component because React only exposes the boundary API on classes.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <div className="error-boundary-icon" aria-hidden="true">⚠️</div>
          <h1>Something went wrong</h1>
          <p className="error-boundary-text">
            An unexpected error stopped this page from rendering. Your data is safe.
          </p>
          {import.meta.env.DEV && (
            <pre className="error-boundary-detail">{error.message}</pre>
          )}
          <div className="error-boundary-actions">
            <button className="btn btn-primary" onClick={this.handleReset}>Try again</button>
            <button className="btn btn-ghost" onClick={() => window.location.assign('/dashboard')}>
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}