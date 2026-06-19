import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-theme');
      const bg = isDark ? '#0f172a' : '#f8fafc';
      const fg = isDark ? '#e2e8f0' : '#1e293b';
      const sub = isDark ? '#94a3b8' : '#64748b';
      const preBg = isDark ? '#1e293b' : '#f1f5f9';

      return (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: bg, minHeight: '100vh', color: fg }}>
          <h1 style={{ color: '#e63946', fontSize: '1.5rem' }}>This section hit an error</h1>
          <p style={{ color: sub, maxWidth: '520px', margin: '12px auto', lineHeight: 1.5 }}>
            The rest of the app may still work. Details were logged to the browser console. You can retry this view or reload the page.
          </p>
          <pre style={{
            background: preBg,
            padding: '16px',
            borderRadius: '8px',
            textAlign: 'left',
            display: 'block',
            maxWidth: '640px',
            margin: '20px auto',
            color: '#d62828',
            fontSize: '13px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{ padding: '10px 20px', background: '#4361ee', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ padding: '10px 20px', background: 'transparent', color: fg, border: `1px solid ${sub}`, borderRadius: '8px', cursor: 'pointer' }}
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{ padding: '10px 20px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              Clear data & reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
