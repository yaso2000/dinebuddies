import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Critical UI Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    textAlign: 'center',
                    background: 'var(--bg-body)',
                    color: 'var(--text-main)'
                }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚠️</div>
                    <h2 style={{ fontWeight: '800' }}>Something went wrong.</h2>
                    <p style={{ opacity: 0.8, maxWidth: '400px', marginBottom: '30px' }}>
                        We've encountered an unexpected error. Please try refreshing the page or restarting the app.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            padding: '12px 30px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Refresh App
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        style={{
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-color)',
                            marginTop: '15px',
                            padding: '8px 20px',
                            borderRadius: '10px',
                            cursor: 'pointer'
                        }}
                    >
                        Go to Home
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
