import { Component, Fragment } from 'react';
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom';
import { reportClientError, makeCorrelationId } from '../services/errorReporter';

const INITIAL_STATE = { hasError: false, error: null, correlationId: null };

/**
 * Top-level error boundary (class part). Router access is injected via props
 * by the ErrorBoundary function wrapper — hooks cannot be called in a class.
 */
export class ErrorBoundaryInner extends Component {
  constructor(props) {
    super(props);
    this.state = { ...INITIAL_STATE, resetKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.pathname !== this.props.pathname) {
      this.reset();
    }
  }

  componentDidCatch(error, errorInfo) {
    const correlationId = makeCorrelationId();
    console.error(`[ErrorBoundary:${correlationId}] Caught error:`, error, errorInfo);
    reportClientError({
      level: 'fatal',
      message: `[ErrorBoundary] ${error?.message || String(error)}`,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      correlationId,
    });
    this.setState({ correlationId });
  }

  reset() {
    this.setState((s) => ({ ...INITIAL_STATE, resetKey: s.resetKey + 1 }));
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    const { navigate, pathname } = this.props;
    if (typeof navigate !== 'function') {
      window.location.assign('/');
      return;
    }
    if (pathname === '/') {
      // Already on the dashboard: just remount the children.
      this.reset();
      return;
    }
    // Navigate first; componentDidUpdate resets the boundary once the
    // pathname actually changes. Resetting before navigating would re-render
    // the crashing subtree and immediately trip the boundary again.
    navigate('/', { replace: true });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4" role="alert">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              An unexpected error occurred. Please refresh the page or try again later.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-600"
              >
                Go to Dashboard
              </button>
            </div>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-gray-500 cursor-pointer mb-2">Error details</summary>
                <pre className="text-xs text-red-400 bg-black/50 p-3 rounded-lg overflow-auto whitespace-pre-wrap">
                  {this.state.correlationId && `${this.state.correlationId}\n`}
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}

function RouterAwareErrorBoundary(props) {
  const navigate = useNavigate();
  const location = useLocation();
  return <ErrorBoundaryInner {...props} navigate={navigate} pathname={location.pathname} />;
}

export function ErrorBoundary(props) {
  const inRouter = useInRouterContext();
  return inRouter
    ? <RouterAwareErrorBoundary {...props} />
    : <ErrorBoundaryInner {...props} />;
}

export default ErrorBoundary;
