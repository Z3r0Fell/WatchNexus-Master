import { Component, Fragment } from 'react';
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom';
import { toast } from '../components/ui/sonner';
import { RefreshCw, Home, AlertTriangle, AlertCircle, RotateCcw } from 'lucide-react';
import { reportClientError, makeCorrelationId } from '../services/errorReporter';

const MAX_RETRIES = 3;

/**
 * True for errors caused by a failed lazy()/dynamic import. React caches the
 * rejected promise of a lazy() component, so remounting can never recover —
 * only a full page reload fetches the chunk again.
 */
export function isChunkLoadError(error) {
  if (!error) return false;
  const name = error.name || '';
  const message = String(error.message || error);
  return (
    name === 'ChunkLoadError' ||
    /Loading (CSS )?chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

const INITIAL_STATE = { hasError: false, error: null, errorInfo: null, correlationId: null };

/**
 * Route-level Error Boundary (class part).
 * Router access (navigate/location) is injected via props by the
 * RouteErrorBoundary function wrapper below — hooks cannot be used here.
 */
export class RouteErrorBoundaryInner extends Component {
  constructor(props) {
    super(props);
    this.state = { ...INITIAL_STATE, retryCount: 0, resetKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    // Auto-reset when the user navigates elsewhere (sidebar, back button...).
    if (this.state.hasError && prevProps.pathname !== this.props.pathname) {
      this.reset({ retryCount: 0 });
    }
  }

  componentDidCatch(error, errorInfo) {
    const correlationId = makeCorrelationId();
    const { routeName } = this.props;

    console.error(`[RouteErrorBoundary:${correlationId}]`, error, errorInfo);

    reportClientError({
      level: 'error',
      message: `[RouteErrorBoundary${routeName ? `:${routeName}` : ''}] ${error?.message || String(error)}`,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      correlationId,
    });

    try {
      toast.error(`Something went wrong (${correlationId})`, {
        description: 'This error has been logged. Try again, or contact support with the code above.',
        duration: 10000,
        action: {
          label: 'Copy ID',
          onClick: () => navigator.clipboard?.writeText(correlationId)
            .then(() => toast.success('Correlation ID copied'))
            .catch(() => {}),
        },
      });
    } catch { /* toast must never break the fallback */ }

    this.setState({ errorInfo, correlationId });
  }

  reset(extra = {}) {
    // Bumping resetKey forces a fresh mount of the children subtree.
    this.setState((s) => ({ ...INITIAL_STATE, resetKey: s.resetKey + 1, ...extra }));
  }

  handleRetry = () => {
    if (isChunkLoadError(this.state.error)) {
      this.handleReload();
      return;
    }
    this.reset({ retryCount: this.state.retryCount + 1 });
  };

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
      this.reset({ retryCount: 0 });
      return;
    }
    // Navigate first; componentDidUpdate resets the boundary once the
    // pathname actually changes. Resetting before navigating would re-render
    // the crashing subtree and immediately trip the boundary again.
    navigate('/', { replace: true });
  };

  render() {
    const { hasError, error, errorInfo, correlationId, retryCount, resetKey } = this.state;
    const { fallback, children, routeName } = this.props;

    if (hasError) {
      if (fallback) {
        return typeof fallback === 'function' ? fallback({ error, reset: this.handleRetry }) : fallback;
      }

      const chunkError = isChunkLoadError(error);
      const retriesExhausted = !chunkError && retryCount >= MAX_RETRIES;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6" role="alert" data-testid="route-error-boundary">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-white mb-2">
                {routeName ? `Error in ${routeName}` : 'Something went wrong'}
              </h2>
              <p className="text-gray-400 text-sm">
                {chunkError
                  ? 'Part of the app failed to download (it may have been updated). Reload to fetch the latest version.'
                  : 'This section failed to load. The rest of the app is still working.'}
              </p>
            </div>

            <div className="space-y-3">
              {retriesExhausted ? (
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reload Page
                </button>
              ) : (
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {chunkError ? 'Reload Page' : retryCount > 0 ? `Try Again (${retryCount}/${MAX_RETRIES})` : 'Try Again'}
                </button>
              )}

              <button
                type="button"
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
                    {correlationId && `${correlationId}\n`}
                    {error.message}
                    {errorInfo?.componentStack && `\n\n${errorInfo.componentStack}`}
                  </pre>
                </div>
              </details>
            )}

            {correlationId && (
              <p className="text-xs text-gray-500">
                Correlation ID: <code className="font-mono">{correlationId}</code>
                {' — include this when reporting issues'}
              </p>
            )}
          </div>
        </div>
      );
    }

    return <Fragment key={resetKey}>{children}</Fragment>;
  }
}

function RouterAwareRouteErrorBoundary(props) {
  const navigate = useNavigate();
  const location = useLocation();
  return <RouteErrorBoundaryInner {...props} navigate={navigate} pathname={location.pathname} />;
}

/**
 * Route-level Error Boundary.
 * Wraps individual lazy-loaded routes to isolate crashes and shows inline
 * recovery UI. Works inside or outside a Router (outside: falls back to
 * full-page navigation for "Go to Dashboard").
 */
export function RouteErrorBoundary(props) {
  const inRouter = useInRouterContext();
  return inRouter
    ? <RouterAwareRouteErrorBoundary {...props} />
    : <RouteErrorBoundaryInner {...props} />;
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
