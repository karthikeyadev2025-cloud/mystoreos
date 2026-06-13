import { Component } from 'react';

// Glassmorphic error fallback UI that matches the MyStore OS dark theme.
// Shows a friendly error message with a retry button.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Report to Sentry if available
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error, { extra: { componentStack: errorInfo?.componentStack } });
    }
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, retry: this.handleRetry })
          : this.props.fallback;
      }

      let isDev = false;
      try {
        isDev = !!(import.meta.env && import.meta.env.DEV);
      } catch {
        // Safe fallback
      }

      let errorString;
      try {
        errorString = this.state.error ? String(this.state.error.message || this.state.error) : '';
      } catch {
        errorString = 'An unknown error occurred.';
      }

      return (
        <div style={{
          minHeight: this.props.fullPage ? '100vh' : '300px',
          background: this.props.fullPage ? '#0f172a' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
        }}>
          <div style={{
            maxWidth: '480px', width: '100%',
            background: 'linear-gradient(135deg, rgba(30,41,59,0.95), rgba(15,23,42,0.98))',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '20px', padding: '40px 36px', textAlign: 'center',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', lineHeight: 1 }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: 'white' }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>
              We hit an unexpected error. Your data is safe — try refreshing the page or click retry below.
            </p>

            {isDev && errorString && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px', padding: '12px', marginBottom: '20px', textAlign: 'left',
                maxHeight: '120px', overflowY: 'auto',
              }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#f87171', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {errorString}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white',
                  border: 'none', padding: '12px 28px', borderRadius: '10px',
                  fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(124,58,237,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                🔄 Retry
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.1)', padding: '12px 28px',
                  borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
