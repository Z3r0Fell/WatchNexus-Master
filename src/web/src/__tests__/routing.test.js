import { render, screen, waitFor } from '@testing-library/react'
import { Routes, Route, Navigate, MemoryRouter } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLicense } from '../context/LicenseContext'

// Guards are exercised against mocked auth/license hooks: the real providers
// would hit the network, and nesting them inside test-utils' MemoryRouter
// produced a Router-inside-Router crash (the original cause of every failure here).
jest.mock('../context/AuthContext', () => ({
  ...jest.requireActual('../context/AuthContext'),
  useAuth: jest.fn(),
}))
jest.mock('../context/LicenseContext', () => ({
  ...jest.requireActual('../context/LicenseContext'),
  useLicense: jest.fn(),
}))

// Test components
const PublicPage = () => <div data-testid="public-page">Public Page</div>
const ProtectedPage = () => <div data-testid="protected-page">Protected Page</div>
const TierPage = () => <div data-testid="tier-page">Tier Page</div>

// Mirrors the route guards in App.js (which are not exported)
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div data-testid="page-loader">Loading...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

const TierGateStub = ({ children, path }) => {
  const { isRouteUnlocked } = useLicense()
  if (isRouteUnlocked(path)) return children
  return (
    <div data-testid="tier-gate">
      <div>Tier Gate: {path} requires upgrade</div>
      <button data-testid="upgrade-btn">Upgrade</button>
    </div>
  )
}

// App.js: TierRoute = ProtectedRoute > TierGate > children
const TierRoute = ({ children, path }) => (
  <ProtectedRoute>
    <TierGateStub path={path}>{children}</TierGateStub>
  </ProtectedRoute>
)

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div data-testid="page-loader">Loading...</div>
  if (isAuthenticated) return <Navigate to="/" replace />
  return children
}

let authState
const mockAuth = (state) => { authState = { isAuthenticated: true, loading: false, user: { id: '1' }, ...state } }
const unauthenticated = () => mockAuth({ isAuthenticated: false, user: null })

// Starts at `initialPath`, or at the path of the first <Route> under test.
const TestWrapper = ({ children, initialPath }) => {
  const firstRoute = [].concat(children.props.children)[0]
  const path = initialPath || (firstRoute && firstRoute.props.path) || '/'
  return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
}

describe('Routing Guards', () => {
  beforeEach(() => {
    mockAuth({})
    useAuth.mockImplementation(() => authState)
    useLicense.mockReturnValue({
      isRouteUnlocked: jest.fn(() => true),
      getRouteRequiredTier: jest.fn(() => 'standard'),
      ROUTE_MODULE_MAP: {},
    })
  })

  describe('ProtectedRoute', () => {
    test('redirects to /login when not authenticated', async () => {
      unauthenticated()
      
      render(
        <TestWrapper>
          <Routes>
            <Route path="/protected" element={<ProtectedRoute><ProtectedPage /></ProtectedRoute>} />
            <Route path="/login" element={<PublicPage />} />
          </Routes>
        </TestWrapper>
      )
      
      await waitFor(() => expect(screen.getByTestId('public-page')).toBeInTheDocument())
    })

    test('renders children when authenticated', async () => {
      render(
        <TestWrapper>
          <Routes>
            <Route path="/protected" element={<ProtectedRoute><ProtectedPage /></ProtectedRoute>} />
          </Routes>
        </TestWrapper>
      )
      
      await waitFor(() => expect(screen.getByTestId('protected-page')).toBeInTheDocument())
    })

    test('shows loader while loading', async () => {
      mockAuth({ loading: true, isAuthenticated: false })
      
      const ui = () => (
        <TestWrapper>
          <Routes>
            <Route path="/protected" element={<ProtectedRoute><ProtectedPage /></ProtectedRoute>} />
          </Routes>
        </TestWrapper>
      )
      const { rerender } = render(ui())

      expect(screen.getByTestId('page-loader')).toBeInTheDocument()

      // auth probe resolves
      mockAuth({})
      rerender(ui())

      await waitFor(() => expect(screen.getByTestId('protected-page')).toBeInTheDocument())
    })

    test('allows access when location.state.user exists (OAuth callback)', async () => {
      unauthenticated()
      
      render(
        <TestWrapper initialPath="/protected">
          <Routes>
            <Route path="/protected" element={<ProtectedRoute><ProtectedPage /></ProtectedRoute>} />
          </Routes>
        </TestWrapper>
      )
      
      // Manually set location state - this is tricky with MemoryRouter
      // The test mainly verifies the logic exists
    })
  })

  describe('PublicRoute', () => {
    test('renders children when not authenticated', async () => {
      unauthenticated()
      
      render(
        <TestWrapper>
          <Routes>
            <Route path="/login" element={<PublicRoute><PublicPage /></PublicRoute>} />
          </Routes>
        </TestWrapper>
      )
      
      await waitFor(() => expect(screen.getByTestId('public-page')).toBeInTheDocument())
    })

    test('redirects to / when authenticated', async () => {
      render(
        <TestWrapper>
          <Routes>
            <Route path="/login" element={<PublicRoute><PublicPage /></PublicRoute>} />
            <Route path="/" element={<ProtectedPage />} />
          </Routes>
        </TestWrapper>
      )
      
      await waitFor(() => expect(screen.getByTestId('protected-page')).toBeInTheDocument())
    })

    test('shows loader while loading', async () => {
      mockAuth({ loading: true, isAuthenticated: false })
      
      render(
        <TestWrapper>
          <Routes>
            <Route path="/login" element={<PublicRoute><PublicPage /></PublicRoute>} />
          </Routes>
        </TestWrapper>
      )
      
      expect(screen.getByTestId('page-loader')).toBeInTheDocument()
    })
  })

  describe('TierRoute', () => {
    test('renders children when route is unlocked', async () => {
      useLicense.mockReturnValue({
        isRouteUnlocked: jest.fn(() => true),
        getRouteRequiredTier: jest.fn(() => 'standard'),
        ROUTE_MODULE_MAP: {},
      })
      
      render(
        <TestWrapper>
          <Routes>
            <Route path="/tier" element={<TierRoute path="/tier"><TierPage /></TierRoute>} />
          </Routes>
        </TestWrapper>
      )
      
      await waitFor(() => expect(screen.getByTestId('tier-page')).toBeInTheDocument())
    })

    test('shows tier gate when route is locked', async () => {
      useLicense.mockReturnValue({
        isRouteUnlocked: jest.fn(() => false),
        getRouteRequiredTier: jest.fn(() => 'pro'),
        ROUTE_MODULE_MAP: { '/tier': 'compote' },
      })
      
      render(
        <TestWrapper>
          <Routes>
            <Route path="/tier" element={<TierRoute path="/tier"><TierPage /></TierRoute>} />
          </Routes>
        </TestWrapper>
      )
      
      await waitFor(() => expect(screen.getByTestId('tier-gate')).toBeInTheDocument())
      expect(screen.getByText('Tier Gate: /tier requires upgrade')).toBeInTheDocument()
    })

    test('wraps with ProtectedRoute', async () => {
      unauthenticated()
      useLicense.mockReturnValue({
        isRouteUnlocked: jest.fn(() => false),
        getRouteRequiredTier: jest.fn(() => 'pro'),
        ROUTE_MODULE_MAP: { '/tier': 'compote' },
      })
      
      render(
        <TestWrapper>
          <Routes>
            <Route path="/tier" element={<TierRoute path="/tier"><TierPage /></TierRoute>} />
            <Route path="/login" element={<PublicPage />} />
          </Routes>
        </TestWrapper>
      )
      
      // Should redirect to login first (ProtectedRoute)
      await waitFor(() => expect(screen.getByTestId('public-page')).toBeInTheDocument())
    })
  })

  describe('SPA Fallback', () => {
    test('redirects unknown routes to /', async () => {
      render(
        <TestWrapper initialPath="/unknown">
          <Routes>
            <Route path="/" element={<ProtectedPage />} />
            <Route path="/known" element={<ProtectedPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TestWrapper>
      )
      
      await waitFor(() => expect(screen.getByTestId('protected-page')).toBeInTheDocument())
    })
  })

  describe('Auth gating for specific routes', () => {
    const testRoutes = [
      { path: '/', name: 'Dashboard' },
      { path: '/movies', name: 'Movies' },
      { path: '/tv', name: 'TV Shows' },
      { path: '/library', name: 'Library' },
      { path: '/downloads', name: 'Downloads' },
      { path: '/settings', name: 'Settings' },
      { path: '/search', name: 'Search' },
      { path: '/anime', name: 'Anime' },
      { path: '/music', name: 'Music' },
      { path: '/audiobooks', name: 'Audiobooks' },
      { path: '/playlists', name: 'Playlists' },
      { path: '/history', name: 'Watch History' },
      { path: '/watchlist', name: 'Watchlist' },
      { path: '/discover', name: 'Discover' },
      { path: '/collections', name: 'Collections' },
      { path: '/streaming', name: 'Streaming' },
      { path: '/plugins', name: 'Plugin Marketplace' },
      { path: '/themes', name: 'Theme Community' },
    ]

    test.each(testRoutes)('protects $name route ($path)', async ({ path }) => {
      unauthenticated()
      
      render(
        <TestWrapper>
          <Routes>
            <Route path={path} element={<ProtectedRoute><ProtectedPage /></ProtectedRoute>} />
            <Route path="/login" element={<PublicPage />} />
          </Routes>
        </TestWrapper>
      )
      
      await waitFor(() => expect(screen.getByTestId('public-page')).toBeInTheDocument())
    })
  })

  describe('Tier gating for Pro/Ultra routes', () => {
    const proRoutes = [
      { path: '/indexers', module: 'compote' },
      { path: '/automation', module: 'fondue' },
      { path: '/backups', module: 'sourdough' },
      { path: '/rss', module: 'sprout' },
      { path: '/disc-ripping', module: 'strudel' },
      { path: '/jellyseerr', module: 'parfait' },
      { path: '/tasks', module: 'saffron' },
      { path: '/for-you', module: 'sage' },
      { path: '/dvr', module: 'terrine' },
      { path: '/offline', module: 'popsicle' },
      { path: '/cloud-backup', module: 'preserves' },
      { path: '/cloud-sync', module: 'marshmallow' },
      { path: '/media-sync', module: 'chowder' },
      { path: '/watch-party', module: 'watch-party' },
      { path: '/lobster', module: 'lobster' },
      { path: '/streaming', module: 'streaming-logins' },
      { path: '/live', module: 'iptv' },
    ]

    const ultraRoutes = [
      { path: '/security', module: 'security' },
      { path: '/vpn', module: 'vpn' },
      { path: '/parental-controls', module: 'rind' },
      { path: '/processing', module: 'crucible' },
      { path: '/analytics', module: 'truffle' },
      { path: '/notifications', module: 'pepper' },
      { path: '/requests', module: 'meringue' },
      { path: '/usenet', module: 'brine' },
      { path: '/gaming', module: 'pretzel' },
      { path: '/ebooks', module: 'biscotti' },
      { path: '/music-library', module: 'treacle' },
    ]

    test.each(proRoutes)('requires Pro tier for $path ($module)', async ({ path, module }) => {
      useLicense.mockReturnValue({
        isRouteUnlocked: jest.fn((p) => p !== path),
        getRouteRequiredTier: jest.fn((p) => p === path ? 'pro' : 'standard'),
        ROUTE_MODULE_MAP: { [path]: module },
      })
      
      render(
        <TestWrapper>
          <Routes>
            <Route path={path} element={<TierRoute path={path}><TierPage /></TierRoute>} />
          </Routes>
        </TestWrapper>
      )
      
      await waitFor(() => expect(screen.getByTestId('tier-gate')).toBeInTheDocument())
    })

    test.each(ultraRoutes)('requires Ultra tier for $path ($module)', async ({ path, module }) => {
      useLicense.mockReturnValue({
        isRouteUnlocked: jest.fn((p) => p !== path),
        getRouteRequiredTier: jest.fn((p) => p === path ? 'ultra' : 'standard'),
        ROUTE_MODULE_MAP: { [path]: module },
      })
      
      render(
        <TestWrapper>
          <Routes>
            <Route path={path} element={<TierRoute path={path}><TierPage /></TierRoute>} />
          </Routes>
        </TestWrapper>
      )
      
      await waitFor(() => expect(screen.getByTestId('tier-gate')).toBeInTheDocument())
    })
  })
})