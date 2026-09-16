import { Component } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '../components/ui/sonner';
import { RefreshCw, Home, AlertTriangle, AlertCircle } from 'lucide-react';

/**
 * Route-level Error Boundary
 * Wraps individual lazy-loaded routes to isolate crashes.
 * Shows inline recovery UI without taking down the entire app.
 */
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const correlationId = `FE-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    
    // Log to console with correlation ID for debugging
    console.error(`[RouteErrorBoundary:${correlationId}]`, error, errorInfo);
    
    // Report to error tracking service (if configured)
    this.reportError(error, errorInfo, correlationId);
    
    this.setState({ errorInfo, correlationId });
  }

  reportError(error, errorInfo, correlationId) {
    // In production, send to Sentry/LogRocket/etc.
    // Example: Sentry.captureException(error, { extra: { correlationId, componentStack: errorInfo.componentStack } });
    
    // Also show toast with correlation ID for user to report
    toast.error(`Something went wrong (${correlationId})`, {
      description: 'This error has been logged. Please try refreshing or contact support with the code above.',
      duration: 10000,
      action: {
        label: 'Copy ID',
        onClick: () => navigator.clipboard.writeText(correlationId).then(() => toast.success('Correlation ID copied'))
      }
    });
  }

  handleRetry = () => {
    const { retryCount } = this.state;
    if (retryCount >= 3) {
      toast.error('Maximum retries reached. Please refresh the page.');
      return;
    }
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: retryCount + 1 
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    const navigate = useNavigate();
    navigate('/', { replace: true });
  };

  render() {
    const { hasError, error, errorInfo, correlationId, retryCount } = this.state;
    const { fallback, children, routeName } = this.props;

    if (hasError) {
      // Custom fallback takes priority
      if (fallback) {
        return typeof fallback === 'function' ? fallback({ error, reset: this.handleRetry }) : fallback;
      }

      // Default inline recovery UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-white mb-2">
                {routeName ? `Error in ${routeName}` : 'Something went wrong'}
              </h2>
              <p className="text-gray-400 text-sm">
                This section failed to load. The rest of the app is still working.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                disabled={retryCount >= 3}
                className="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {retryCount > 0 ? `Retry (${retryCount}/3)` : 'Try Again'}
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-600"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </button>
            </div>

            {error && (
              <details className="text-left border border-gray-700 rounded-lg overflow-hidden">
                <summary className="px-4 py-2 bg-gray-900 text-xs text-gray-500 cursor-pointer flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" />
                  Error details (for support)
                </summary>
                <div className="p-4 bg-black/50 max-h-64 overflow-auto">
                  <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
                    {correlationId}
                    {error.message}
                    {errorInfo?.componentStack && `\n\n${errorInfo.componentStack}`}
                  </pre>
                </div>
              </details>
            )}

            <p className="text-xs text-gray-500">
              Correlation ID: <code className="font-mono">{correlationId}</code>
              {' — include this when reporting issues'}
            </p>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * HOC to wrap a lazy route component with RouteErrorBoundary
 */
export function withErrorBoundary(Component, routeName) {
  return function WrappedComponent(props) {
    return (
      <RouteErrorBoundary routeName={routeName}>
        <Component {...props} />
      </RouteErrorBoundary>
    );
  };
}

/**
 * Wrapper for use in Suspense + lazy routes
 */
export function ErrorBoundaryWrapper({ children, routeName }) {
  return (
    <RouteErrorBoundary routeName={routeName}>
      {children}
    </RouteErrorBoundary>
  );
}