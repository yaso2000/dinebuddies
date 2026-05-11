import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null,
            errorInfo: null,
            retryCount: 0 
        };
        this.maxRetries = 2; // Auto-retry rendering twice before showing error screen
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Critical UI Component Error:", error);
        
        // Auto-refresh on chunk load errors (Vite deployment mismatches)
        const isChunkLoadError = error?.name === 'ChunkLoadError' || 
                                 (error?.message && /Failed to fetch dynamically imported module|Importing a module script failed/i.test(error.message));
        
        if (isChunkLoadError) {
            console.warn("Chunk load error detected. Forcing hard reload to get new deployment assets.");
            // Prevent infinite reload loops
            if (!sessionStorage.getItem('chunk_load_reload')) {
                sessionStorage.setItem('chunk_load_reload', 'true');
                window.location.reload();
                return;
            } else {
                sessionStorage.removeItem('chunk_load_reload');
            }
        }
        
        if (this.state.retryCount < this.maxRetries) {
            console.warn(`Silently retrying to recover from error... (Attempt ${this.state.retryCount + 1}/${this.maxRetries})`);
            
            // Wait 500ms for asynchronous data to potentially resolveen reset state
            this.retryTimer = setTimeout(() => {
                this.setState((prevState) => ({
                    hasError: false,
                    error: null,
                    errorInfo: null,
                    retryCount: prevState.retryCount + 1
                }));
            }, 600); // 600ms grace period for network requests to finish settling
        } else {
            console.error("Max auto-retries reached. Redirecting to Home to prevent fatal crash screen.");
            this.setState({ errorInfo });
            
            // Never send affiliate shell to /posts-feed — Layout will bounce them back to /affiliate/dashboard
            // and a render error there becomes an infinite loop with ErrorBoundary.
            const p = window.location.pathname || '';
            if (p.startsWith('/affiliate')) {
                window.location.replace('/affiliate');
                return;
            }
            // Avoid "/" — HomeRouter redirects business users (e.g. pending registration) and can create
            // navigate loops with /business/signup; feed is a neutral recovery target.
            if (window.location.pathname !== '/posts-feed') {
                window.location.href = '/posts-feed';
            } else {
                if (!sessionStorage.getItem('home_crash_reload')) {
                    sessionStorage.setItem('home_crash_reload', 'true');
                    window.location.reload();
                } else {
                    sessionStorage.removeItem('home_crash_reload');
                    setTimeout(() => window.location.reload(), 2000);
                }
            }
        }
    }

    componentWillUnmount() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
        }
    }

    // Reset retry count if the user successfully navigates somewhere else or the children change entirely
    componentDidUpdate(prevProps) {
        if (this.props.children !== prevProps.children && this.state.hasError && this.state.retryCount >= this.maxRetries) {
            // A hard reset if the router naturally changes the view
            this.setState({ hasError: false, error: null, errorInfo: null, retryCount: 0 });
        }
    }

    render() {
        if (this.state.hasError) {
            const err = this.state.error;
            const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
            return (
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: 'var(--bg-body)',
                    padding: '1.5rem',
                    boxSizing: 'border-box',
                }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s infinite linear', marginBottom: '15px' }} />
                    <span style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 700, textAlign: 'center' }}>
                        Recovering…
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.35rem', textAlign: 'center', maxWidth: 360 }}>
                        The app hit an error and is retrying. If this stays stuck, hard-refresh the page (Ctrl+Shift+R).
                    </span>
                    {isDev && err && (
                        <pre
                            style={{
                                marginTop: '1rem',
                                padding: '0.75rem',
                                maxWidth: 'min(100%, 560px)',
                                maxHeight: '40vh',
                                overflow: 'auto',
                                fontSize: '0.75rem',
                                textAlign: 'left',
                                background: 'rgba(239,68,68,0.12)',
                                color: '#fecaca',
                                borderRadius: '8px',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}
                        >
                            {err?.message || String(err)}
                        </pre>
                    )}
                    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
