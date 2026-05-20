import React from 'react';
import { recoverFromFatalUiError } from '../utils/fatalUiRecovery';

/**
 * App-wide React error boundary. Does not render any error or "recovering" UI —
 * see fatalUiRecovery.js (the only recovery implementation).
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { suppressTree: false };
    }

    static getDerivedStateFromError() {
        return { suppressTree: true };
    }

    componentDidCatch(error, errorInfo) {
        recoverFromFatalUiError(error, { source: 'ErrorBoundary' });
        console.error('ErrorBoundary component stack:', errorInfo?.componentStack);
    }

    componentDidUpdate(prevProps) {
        if (this.props.children !== prevProps.children && this.state.suppressTree) {
            this.setState({ suppressTree: false });
        }
    }

    render() {
        if (this.state.suppressTree) {
            return null;
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
