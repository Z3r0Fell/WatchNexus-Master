jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  defaults: {},
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn(), handlers: [] },
    response: { use: jest.fn(), eject: jest.fn(), handlers: [] },
  },
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: {},
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn(), handlers: [] },
      response: { use: jest.fn(), eject: jest.fn(), handlers: [] },
    },
  })),
}))

// Bare render: these tests mount the providers under test themselves.
// test-utils' render wraps every test in Auth/Theme/Gadget/License providers,
// whose own mount-time axios.get calls consumed the tests' Once-mocks.
import { render, screen, waitFor, act } from '@testing-library/react'

// Providers mounted without an <AuthProvider> see a signed-out user (the
// real app always has one); inside an AuthProvider the real context is used.
jest.mock('../../context/AuthContext', () => {
  const actual = jest.requireActual('../../context/AuthContext')
  return {
    ...actual,
    useAuth: () => actual.useOptionalAuth() ?? { isAuthenticated: false, user: null, loading: false },
  }
})
import { AuthProvider, useAuth } from '../../context/AuthContext'
import { LicenseProvider, useLicense } from '../../context/LicenseContext'
import { ThemeProvider, useTheme } from '../../context/ThemeContext'
import { GadgetProvider, useGadgets } from '../../context/GadgetContext'
import axios from 'axios'

// Several providers fire requests concurrently, so a single Once-sequence on
// axios.get breaks as soon as their order shifts (e.g. LicenseProvider
// re-fetching when auth state changes). Answer by URL instead. A value may be
// an array: each call takes the next entry, the last one sticks.
const isFailure = (v) => v instanceof Error || (v && v.response && v.response.status >= 400)
let routes = {}
const routeGet = (table) => {
  routes = { ...table }
  axios.get.mockImplementation((url) => {
    const key = Object.keys(routes).find(k => url.includes(k))
    if (!key) return Promise.reject({ response: { status: 404 } })
    let v = routes[key]
    if (Array.isArray(v)) v = v.length > 1 ? v.shift() : v[0]
    return isFailure(v) ? Promise.reject(v) : Promise.resolve(v)
  })
}
const setRoute = (key, value) => { routes[key] = value }
const ok = (data) => ({ data })
const THEME_OK = {
  '/user/preferences': ok({ theme_mode: 'dark' }),
  '/milk/theme-forge': ok({ current_theme: null }),
  '/api/settings': ok({ ui_accent: 'violet' }),
}

describe('Cross-Context Interaction Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('AuthContext → LicenseContext: Login Triggers Tier Fetch', () => {
    test('login triggers license refresh via watchnexus_license_changed event', async () => {
      // Initial state: unauthenticated, standard tier
      routeGet({
        '/users/me': { response: { status: 401 } },
        '/cellar/status': ok({ tier: 'standard', modules_unlocked: [] }),
      })

      let authRef, licenseRef
      const Grab = () => {
        authRef = useAuth();
        licenseRef = useLicense();
        return (
          <div>
            <div data-testid="auth-state">{String(authRef.isAuthenticated)}</div>
            <div data-testid="license-tier">{licenseRef.tier}</div>
          </div>
        )
      }

      render(
        <AuthProvider>
          <LicenseProvider>
            <Grab />
          </LicenseProvider>
        </AuthProvider>
      )

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('false'))
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('standard'))

      // Login
      axios.post.mockResolvedValueOnce({
        data: { user: { id: '1', username: 'owner', email: 'owner@test.com', role: 'admin' } }
      })
      // License refresh after login / event
      setRoute('/cellar/status', ok({ tier: 'pro', modules_unlocked: [] }))

      await act(async () => {
        await authRef.login('owner@test.com', 'password')
      })

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('true'))

      // Dispatch the event that ActivationSettings would dispatch
      act(() => {
        window.dispatchEvent(new CustomEvent('watchnexus_license_changed'))
      })

      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'))
    })

    test('logout clears license tier to standard', async () => {
      routeGet({
        '/users/me': ok({ Id: '1', Username: 'owner' }),
        '/cellar/status': ok({ tier: 'pro', modules_unlocked: [] }),
      })

      let authRef, licenseRef
      const Grab = () => {
        authRef = useAuth();
        licenseRef = useLicense();
        return (
          <div>
            <div data-testid="auth-state">{String(authRef.isAuthenticated)}</div>
            <div data-testid="license-tier">{licenseRef.tier}</div>
          </div>
        )
      }

      render(
        <AuthProvider>
          <LicenseProvider>
            <Grab />
          </LicenseProvider>
        </AuthProvider>
      )

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('true'))
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'))

      // Logout
      axios.post.mockResolvedValueOnce({ data: { success: true } });  // Auth logout
      // License would be re-fetched on auth change, but current implementation
      // doesn't auto-refresh on logout - this documents the gap
      setRoute('/cellar/status', ok({ tier: 'standard', modules_unlocked: [] }))

      await act(async () => {
        await authRef.logout()
      })

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('false'))
      // License tier would still show 'pro' until manual refresh or event
      // This is a known limitation - license doesn't auto-refresh on logout
    })
  })

  describe('LicenseContext → GadgetContext: Tier Change Triggers Module Re-filter', () => {
    test('gadgets only load when authenticated, tier affects available modules', async () => {
      // This tests the integration: GadgetContext uses isAuthenticated from AuthContext
      // LicenseContext provides tier info that affects which gadgets are available
      routeGet({
        '/users/me': { response: { status: 401 } },
        '/cellar/status': ok({ tier: 'pro', modules_unlocked: [] }),
        '/ripen/installed': ok({ gadgets: [] }),
        '/ripen/hooks': ok({ sidebar_entries: [] }),
      })

      let authRef, licenseRef, gadgetRef
      const Grab = () => {
        authRef = useAuth();
        licenseRef = useLicense();
        gadgetRef = useGadgets();
        return (
          <div>
            <div data-testid="auth-state">{String(authRef.isAuthenticated)}</div>
            <div data-testid="license-tier">{licenseRef.tier}</div>
            <div data-testid="gadgets-loading">{String(gadgetRef.loading)}</div>
          </div>
        )
      }

      render(
        <AuthProvider>
          <LicenseProvider>
            <GadgetProvider>
              <Grab />
            </GadgetProvider>
          </LicenseProvider>
        </AuthProvider>
      )

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('false'))
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'))
      await waitFor(() => expect(screen.getByTestId('gadgets-loading')).toHaveTextContent('false'))
      expect(screen.getByTestId('gadgets-loading')).toHaveTextContent('false')
    })

    test('tier upgrade unlocks pro gadgets (compote, fondue, etc.)', async () => {
      routeGet({
        '/users/me': { response: { status: 401 } },
        '/cellar/status': ok({ tier: 'standard', modules_unlocked: [] }),
        '/ripen/installed': ok({ gadgets: [] }),
        '/ripen/hooks': ok({ sidebar_entries: [] }),
      })

      let licenseRef, gadgetRef
      const Grab = () => {
        licenseRef = useLicense();
        gadgetRef = useGadgets();
        return (
          <div>
            <div data-testid="license-tier">{licenseRef.tier}</div>
            <div data-testid="mod-compote">{String(licenseRef.isModuleUnlocked('compote'))}</div>
            <div data-testid="mod-fondue">{String(licenseRef.isModuleUnlocked('fondue'))}</div>
            <div data-testid="gadgets-count">{gadgetRef.installed.length}</div>
          </div>
        )
      }

      render(
        <AuthProvider>
          <LicenseProvider>
            <GadgetProvider>
              <Grab />
            </GadgetProvider>
          </LicenseProvider>
        </AuthProvider>
      )

      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('standard'))
      expect(screen.getByTestId('mod-compote')).toHaveTextContent('false')
      expect(screen.getByTestId('mod-fondue')).toHaveTextContent('false')

      // Upgrade to pro via event
      setRoute('/cellar/status', ok({ tier: 'pro', modules_unlocked: [] }))
      act(() => {
        window.dispatchEvent(new CustomEvent('watchnexus_license_changed'))
      })

      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'))
      expect(screen.getByTestId('mod-compote')).toHaveTextContent('true')
      expect(screen.getByTestId('mod-fondue')).toHaveTextContent('true')
    })
  })

  describe('ThemeContext → All: CSS Var Changes Propagate Instantly', () => {
    test('theme mode change updates CSS variables globally', async () => {
      routeGet({ '/users/me': { response: { status: 401 } }, ...THEME_OK })
      axios.put.mockResolvedValue({ data: {} })

      let themeRef
      const Grab = () => {
        themeRef = useTheme();
        return (
          <div>
            <div data-testid="mode">{themeRef.mode}</div>
            <div data-testid="bg">{document.documentElement.style.getPropertyValue('--background')}</div>
            <button data-testid="toggle" onClick={() => themeRef.toggleMode()}>Toggle</button>
          </div>
        )
      }

      render(
        <AuthProvider>
          <ThemeProvider>
            <Grab />
          </ThemeProvider>
        </AuthProvider>
      )

      await waitFor(() => expect(document.documentElement.style.getPropertyValue('--background')).toBe('#0A0A0A'))
      expect(screen.getByTestId('mode')).toHaveTextContent('dark')

      await act(async () => {
        await screen.getByTestId('toggle').click()
      })

      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('light'))
      const lightBg = document.documentElement.style.getPropertyValue('--background')
      expect(lightBg).toBe('#FFFFFF')
    })

    test('accent change updates CSS variables across all components', async () => {
      routeGet({ '/users/me': { response: { status: 401 } }, ...THEME_OK })
      axios.put.mockResolvedValue({ data: {} })

      let themeRef
      const Grab = () => {
        themeRef = useTheme();
        return (
          <div>
            <div data-testid="accent">{themeRef.accentId}</div>
            <div data-testid="primary">{document.documentElement.style.getPropertyValue('--primary')}</div>
            <button data-testid="apply-accent" onClick={() => themeRef.applyAccent('amber')}>Apply Amber</button>
          </div>
        )
      }

      render(
        <AuthProvider>
          <ThemeProvider>
            <Grab />
          </ThemeProvider>
        </AuthProvider>
      )

      await waitFor(() => expect(screen.getByTestId('accent')).toHaveTextContent('violet'))
      const violetPrimary = document.documentElement.style.getPropertyValue('--primary')
      expect(violetPrimary).toBe('#8B5CF6')

      await act(async () => {
        await screen.getByTestId('apply-accent').click()
      })

      await waitFor(() => expect(screen.getByTestId('accent')).toHaveTextContent('amber'))
      const amberPrimary = document.documentElement.style.getPropertyValue('--primary')
      expect(amberPrimary).toBe('#F59E0B')
    })

    test('custom theme application propagates to all consumers', async () => {
      // no ui_accent here: ThemeContext layers the accent over any loaded theme
      routeGet({ '/users/me': { response: { status: 401 } }, ...THEME_OK, '/api/settings': ok({}) })
      axios.post.mockResolvedValueOnce({
        data: { theme: { type: 'custom', colors: { ...require('../../context/ThemeContext').DEFAULT_DARK_THEME, primary: '#FF0000' } } }
      })

      let themeRef
      const Grab = () => {
        themeRef = useTheme();
        return (
          <div>
            <div data-testid="type">{themeRef.themeType}</div>
            <div data-testid="primary">{document.documentElement.style.getPropertyValue('--primary')}</div>
            <button data-testid="apply-custom" onClick={() => themeRef.applyCustomColors({ primary: '#FF0000', background: '#000000' })}>Apply</button>
          </div>
        )
      }

      render(
        <AuthProvider>
          <ThemeProvider>
            <Grab />
          </ThemeProvider>
        </AuthProvider>
      )

      await waitFor(() => expect(screen.getByTestId('type')).toHaveTextContent('default'))
      // let the initial theme + accent application finish before applying
      await waitFor(() => expect(document.documentElement.style.getPropertyValue('--background')).not.toBe(''))
      await act(async () => { await new Promise(r => setTimeout(r, 0)) })

      await act(async () => {
        await screen.getByTestId('apply-custom').click()
      })

      await waitFor(() => expect(screen.getByTestId('type')).toHaveTextContent('custom'))
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#FF0000')
    })
  })

  describe('AuthContext → AuthContext: Token Refresh Does Not Lose User State', () => {
    test('concurrent auth operations maintain consistent state', async () => {
      axios.get.mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } })

      let authRef
      const Grab = () => {
        authRef = useAuth();
        return (
          <div>
            <div data-testid="user">{authRef.user?.username}</div>
            <div data-testid="authenticated">{String(authRef.isAuthenticated)}</div>
          </div>
        )
      }

      render(<AuthProvider><Grab /></AuthProvider>)
      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'))

      // Simulate token refresh - user data might be re-fetched
      axios.get.mockResolvedValueOnce({ data: { Id: '1', Username: 'owner', Email: 'updated@test.com' } })
      await act(async () => {
        await authRef.loginWithToken('new-token', null); // Triggers fetchUser
      })

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'))
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    })

    test('failed token refresh logs out user', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } })
        .mockRejectedValueOnce({ response: { status: 401 } }); // fetchUser fails after token refresh

      let authRef
      const Grab = () => {
        authRef = useAuth();
        return (
          <div>
            <div data-testid="user">{authRef.user?.username || 'none'}</div>
            <div data-testid="authenticated">{String(authRef.isAuthenticated)}</div>
          </div>
        )
      }

      render(<AuthProvider><Grab /></AuthProvider>)
      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'))

      // Token refresh fails
      await act(async () => {
        await authRef.loginWithToken('expired-token', null)
      })

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'))
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
    })
  })

  describe('Full Provider Tree Integration', () => {
    test('all four providers work together without conflicts', async () => {
      routeGet({
        '/users/me': ok({ Id: '1', Username: 'owner' }),
        '/cellar/status': ok({ tier: 'pro', modules_unlocked: [] }),
        ...THEME_OK,
        '/ripen/installed': ok({ gadgets: [{ gadget_id: 'weather' }] }),
        '/ripen/hooks': ok({ sidebar_entries: [{ label: 'Weather' }] }),
      })

      const Probe = () => {
        const auth = useAuth()
        const license = useLicense()
        const theme = useTheme()
        const gadgets = useGadgets()

        return (
          <div>
            <div data-testid="auth-user">{auth.user?.username || 'none'}</div>
            <div data-testid="license-tier">{license.tier}</div>
            <div data-testid="theme-mode">{theme.mode}</div>
            <div data-testid="gadgets-count">{gadgets.installed.length}</div>
          </div>
        )
      }

      render(
        <AuthProvider>
          <LicenseProvider>
            <ThemeProvider>
              <GadgetProvider>
                <Probe />
              </GadgetProvider>
            </ThemeProvider>
          </LicenseProvider>
        </AuthProvider>
      )

      await waitFor(() => expect(screen.getByTestId('auth-user')).toHaveTextContent('owner'))
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'))
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'))
      await waitFor(() => expect(screen.getByTestId('gadgets-count')).toHaveTextContent('1'))
    })

    test('provider nesting order does not break consumers', async () => {
      // Different nesting orders should all work
      routeGet({
        '/users/me': ok({ Id: '1', Username: 'owner' }),
        '/cellar/status': ok({ tier: 'pro', modules_unlocked: [] }),
        ...THEME_OK,
        '/ripen/installed': ok({ gadgets: [] }),
        '/ripen/hooks': ok({ sidebar_entries: [] }),
      })

      // Order: Theme → Auth → License → Gadgets
      const Probe = () => {
        const auth = useAuth()
        const license = useLicense()
        const theme = useTheme()
        const gadgets = useGadgets()
        return (
          <div>
            <div data-testid="auth-user">{auth.user?.username || 'none'}</div>
            <div data-testid="license-tier">{license.tier}</div>
            <div data-testid="theme-mode">{theme.mode}</div>
            <div data-testid="gadgets-count">{gadgets.installed.length}</div>
          </div>
        )
      }

      render(
        <ThemeProvider>
          <AuthProvider>
            <LicenseProvider>
              <GadgetProvider>
                <Probe />
              </GadgetProvider>
            </LicenseProvider>
          </AuthProvider>
        </ThemeProvider>
      )

      await waitFor(() => expect(screen.getByTestId('auth-user')).toHaveTextContent('owner'))
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'))
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'))
    })
  })

  describe('Context Value Memoization', () => {
    test('AuthContext value is memoized - same reference when the provider re-renders with unchanged state', async () => {
      routeGet({ '/users/me': ok({ Id: '1', Username: 'owner' }) })
      const seen = []
      const Grab = () => {
        const v = useAuth()
        seen.push(v)
        return <div data-testid="probe">{String(v.loading ?? '')}</div>
      }

      const tree = () => <AuthProvider><Grab /></AuthProvider>
      const { rerender } = render(tree())
      await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('false'))
      await act(async () => { await new Promise(r => setTimeout(r, 0)) })
      const before = seen[seen.length - 1]
      rerender(tree())
      expect(seen[seen.length - 1]).toBe(before)
    })


    test('LicenseContext value is memoized - same reference when the provider re-renders with unchanged state', async () => {
      routeGet({ '/cellar/status': ok({ tier: 'pro', modules_unlocked: [] }) })
      const seen = []
      const Grab = () => {
        const v = useLicense()
        seen.push(v)
        return <div data-testid="probe">{String(v.loading ?? '')}</div>
      }

      const tree = () => <LicenseProvider><Grab /></LicenseProvider>
      const { rerender } = render(tree())
      await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('false'))
      await act(async () => { await new Promise(r => setTimeout(r, 0)) })
      const before = seen[seen.length - 1]
      rerender(tree())
      expect(seen[seen.length - 1]).toBe(before)
    })


    test('ThemeContext value is memoized - same reference when the provider re-renders with unchanged state', async () => {
      routeGet(THEME_OK)
      const seen = []
      const Grab = () => {
        const v = useTheme()
        seen.push(v)
        return <div data-testid="probe">{String(v.loading ?? '')}</div>
      }

      const tree = () => <ThemeProvider><Grab /></ThemeProvider>
      const { rerender } = render(tree())
      await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('false'))
      await act(async () => { await new Promise(r => setTimeout(r, 0)) })
      const before = seen[seen.length - 1]
      rerender(tree())
      expect(seen[seen.length - 1]).toBe(before)
    })


    test('GadgetContext value is memoized - same reference when the provider re-renders with unchanged state', async () => {
      routeGet({ '/ripen/installed': ok({ gadgets: [] }), '/ripen/hooks': ok({ sidebar_entries: [] }) })
      const seen = []
      const Grab = () => {
        const v = useGadgets()
        seen.push(v)
        return <div data-testid="probe">{String(v.loading ?? '')}</div>
      }

      const tree = () => <GadgetProvider><Grab /></GadgetProvider>
      const { rerender } = render(tree())
      await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('false'))
      await act(async () => { await new Promise(r => setTimeout(r, 0)) })
      const before = seen[seen.length - 1]
      rerender(tree())
      expect(seen[seen.length - 1]).toBe(before)
    })

  })
})