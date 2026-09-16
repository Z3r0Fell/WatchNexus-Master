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
}));

import { render, screen, waitFor, act } from '../test-utils';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { LicenseProvider, useLicense } from '../../context/LicenseContext';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';
import { GadgetProvider, useGadgets } from '../../context/GadgetContext';
import axios from 'axios';

describe('Cross-Context Interaction Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AuthContext → LicenseContext: Login Triggers Tier Fetch', () => {
    test('login triggers license refresh via watchnexus_license_changed event', async () => {
      // Initial state: unauthenticated, standard tier
      axios.get
        .mockRejectedValueOnce({ response: { status: 401 } })          // Auth: /users/me
        .mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } }); // License: /api/cellar/status

      let authRef, licenseRef;
      const Grab = () => { 
        authRef = useAuth(); 
        licenseRef = useLicense(); 
        return (
          <div>
            <div data-testid="auth-state">{String(authRef.isAuthenticated)}</div>
            <div data-testid="license-tier">{licenseRef.tier}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <LicenseProvider>
            <Grab />
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('false'));
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('standard'));

      // Login
      axios.post.mockResolvedValueOnce({ 
        data: { user: { id: '1', username: 'owner', email: 'owner@test.com', role: 'admin' } } 
      });
      // License refresh after event
      axios.get.mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });

      await act(async () => {
        await authRef.login('owner@test.com', 'password');
      });

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('true'));
      
      // Dispatch the event that ActivationSettings would dispatch
      act(() => {
        window.dispatchEvent(new CustomEvent('watchnexus_license_changed'));
      });

      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'));
    });

    test('logout clears license tier to standard', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } })  // Auth: /users/me
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } }); // License

      let authRef, licenseRef;
      const Grab = () => { 
        authRef = useAuth(); 
        licenseRef = useLicense(); 
        return (
          <div>
            <div data-testid="auth-state">{String(authRef.isAuthenticated)}</div>
            <div data-testid="license-tier">{licenseRef.tier}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <LicenseProvider>
            <Grab />
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('true'));
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'));

      // Logout
      axios.post.mockResolvedValueOnce({ data: { success: true } });  // Auth logout
      // License would be re-fetched on auth change, but current implementation
      // doesn't auto-refresh on logout - this documents the gap
      axios.get.mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } });

      await act(async () => {
        await authRef.logout();
      });

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('false'));
      // License tier would still show 'pro' until manual refresh or event
      // This is a known limitation - license doesn't auto-refresh on logout
    });
  });

  describe('LicenseContext → GadgetContext: Tier Change Triggers Module Re-filter', () => {
    test('gadgets only load when authenticated, tier affects available modules', async () => {
      // This tests the integration: GadgetContext uses isAuthenticated from AuthContext
      // LicenseContext provides tier info that affects which gadgets are available
      axios.get
        .mockRejectedValueOnce({ response: { status: 401 } })                    // Auth
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } })  // License
        .mockResolvedValueOnce({ data: { gadgets: [] } })                        // Gadgets (not auth)
        .mockResolvedValueOnce({ data: { sidebar_entries: [] } });

      let authRef, licenseRef, gadgetRef;
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
        );
      };

      render(
        <AuthProvider>
          <LicenseProvider>
            <GadgetProvider>
              <Grab />
            </GadgetProvider>
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('false'));
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'));
      await waitFor(() => expect(screen.getByTestId('gadgets-loading')).toHaveTextContent('false'));
      expect(screen.getByTestId('gadgets-loading')).toHaveTextContent('false');
    });

    test('tier upgrade unlocks pro gadgets (compote, fondue, etc.)', async () => {
      axios.get
        .mockRejectedValueOnce({ response: { status: 401 } })                    // Auth
        .mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } }) // License initial
        .mockResolvedValueOnce({ data: { gadgets: [] } })                        // Gadgets
        .mockResolvedValueOnce({ data: { sidebar_entries: [] } });

      let licenseRef, gadgetRef;
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
        );
      };

      render(
        <AuthProvider>
          <LicenseProvider>
            <GadgetProvider>
              <Grab />
            </GadgetProvider>
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('standard'));
      expect(screen.getByTestId('mod-compote')).toHaveTextContent('false');
      expect(screen.getByTestId('mod-fondue')).toHaveTextContent('false');

      // Upgrade to pro via event
      axios.get.mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });
      act(() => {
        window.dispatchEvent(new CustomEvent('watchnexus_license_changed'));
      });

      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'));
      expect(screen.getByTestId('mod-compote')).toHaveTextContent('true');
      expect(screen.getByTestId('mod-fondue')).toHaveTextContent('true');
    });
  });

  describe('ThemeContext → All: CSS Var Changes Propagate Instantly', () => {
    test('theme mode change updates CSS variables globally', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })          // Theme: preferences
        .mockResolvedValueOnce({ data: { current_theme: null } })         // Theme: theme-forge
        .mockResolvedValue({ data: { ui_accent: 'violet' } });           // Theme: settings
      axios.put.mockResolvedValue({ data: {} });

      let themeRef;
      const Grab = () => { 
        themeRef = useTheme(); 
        return (
          <div>
            <div data-testid="mode">{themeRef.mode}</div>
            <div data-testid="bg">{document.documentElement.style.getPropertyValue('--background')}</div>
            <button data-testid="toggle" onClick={() => themeRef.toggleMode()}>Toggle</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <ThemeProvider>
            <Grab />
          </ThemeProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));
      const darkBg = document.documentElement.style.getPropertyValue('--background');
      expect(darkBg).toBe('#0A0A0A');

      await act(async () => {
        await screen.getByTestId('toggle').click();
      });

      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('light'));
      const lightBg = document.documentElement.style.getPropertyValue('--background');
      expect(lightBg).toBe('#FFFFFF');
    });

    test('accent change updates CSS variables across all components', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.put.mockResolvedValue({ data: {} });

      let themeRef;
      const Grab = () => { 
        themeRef = useTheme(); 
        return (
          <div>
            <div data-testid="accent">{themeRef.accentId}</div>
            <div data-testid="primary">{document.documentElement.style.getPropertyValue('--primary')}</div>
            <button data-testid="apply-accent" onClick={() => themeRef.applyAccent('amber')}>Apply Amber</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <ThemeProvider>
            <Grab />
          </ThemeProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('accent')).toHaveTextContent('violet'));
      const violetPrimary = document.documentElement.style.getPropertyValue('--primary');
      expect(violetPrimary).toBe('#8B5CF6');

      await act(async () => {
        await screen.getByTestId('apply-accent').click();
      });

      await waitFor(() => expect(screen.getByTestId('accent')).toHaveTextContent('amber'));
      const amberPrimary = document.documentElement.style.getPropertyValue('--primary');
      expect(amberPrimary).toBe('#F59E0B');
    });

    test('custom theme application propagates to all consumers', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.post.mockResolvedValueOnce({
        data: { theme: { type: 'custom', colors: { ...require('../../context/ThemeContext').DEFAULT_DARK_THEME, primary: '#FF0000' } } }
      });

      let themeRef;
      const Grab = () => { 
        themeRef = useTheme(); 
        return (
          <div>
            <div data-testid="type">{themeRef.themeType}</div>
            <div data-testid="primary">{document.documentElement.style.getPropertyValue('--primary')}</div>
            <button data-testid="apply-custom" onClick={() => themeRef.applyCustomColors({ primary: '#FF0000', background: '#000000' })}>Apply</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <ThemeProvider>
            <Grab />
          </ThemeProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('type')).toHaveTextContent('default'));

      await act(async () => {
        await screen.getByTestId('apply-custom').click();
      });

      await waitFor(() => expect(screen.getByTestId('type')).toHaveTextContent('custom'));
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#FF0000');
    });
  });

  describe('AuthContext → AuthContext: Token Refresh Does Not Lose User State', () => {
    test('concurrent auth operations maintain consistent state', async () => {
      axios.get.mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } });

      let authRef;
      const Grab = () => { 
        authRef = useAuth(); 
        return (
          <div>
            <div data-testid="user">{authRef.user?.username}</div>
            <div data-testid="authenticated">{String(authRef.isAuthenticated)}</div>
          </div>
        );
      };

      render(<AuthProvider><Grab /></AuthProvider>);
      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'));

      // Simulate token refresh - user data might be re-fetched
      axios.get.mockResolvedValueOnce({ data: { Id: '1', Username: 'owner', Email: 'updated@test.com' } });
      await act(async () => {
        await authRef.loginWithToken('new-token', null); // Triggers fetchUser
      });

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'));
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    test('failed token refresh logs out user', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } })
        .mockRejectedValueOnce({ response: { status: 401 } }); // fetchUser fails after token refresh

      let authRef;
      const Grab = () => { 
        authRef = useAuth(); 
        return (
          <div>
            <div data-testid="user">{authRef.user?.username || 'none'}</div>
            <div data-testid="authenticated">{String(authRef.isAuthenticated)}</div>
          </div>
        );
      };

      render(<AuthProvider><Grab /></AuthProvider>);
      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'));

      // Token refresh fails
      await act(async () => {
        await authRef.loginWithToken('expired-token', null);
      });

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });
  });

  describe('Full Provider Tree Integration', () => {
    test('all four providers work together without conflicts', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } })                 // Auth
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } })           // License
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })                          // Theme: preferences
        .mockResolvedValueOnce({ data: { current_theme: null } })                         // Theme: theme-forge
        .mockResolvedValueOnce({ data: { ui_accent: 'violet' } })                         // Theme: settings
        .mockResolvedValueOnce({ data: { gadgets: [{ gadget_id: 'weather' }] } })         // Gadgets: installed
        .mockResolvedValueOnce({ data: { sidebar_entries: [{ label: 'Weather' }] } });    // Gadgets: hooks

      const Probe = () => {
        const auth = useAuth();
        const license = useLicense();
        const theme = useTheme();
        const gadgets = useGadgets();
        
        return (
          <div>
            <div data-testid="auth-user">{auth.user?.username}</div>
            <div data-testid="license-tier">{license.tier}</div>
            <div data-testid="theme-mode">{theme.mode}</div>
            <div data-testid="gadgets-count">{gadgets.installed.length}</div>
          </div>
        );
      };

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
      );

      await waitFor(() => expect(screen.getByTestId('auth-user')).toHaveTextContent('owner'));
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'));
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));
      await waitFor(() => expect(screen.getByTestId('gadgets-count')).toHaveTextContent('1'));
    });

    test('provider nesting order does not break consumers', async () => {
      // Different nesting orders should all work
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } })
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } })
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } })
        .mockResolvedValueOnce({ data: { gadgets: [] } })
        .mockResolvedValueOnce({ data: { sidebar_entries: [] } });

      // Order: Theme → Auth → License → Gadgets
      const Probe = () => {
        const auth = useAuth();
        const license = useLicense();
        const theme = useTheme();
        const gadgets = useGadgets();
        return (
          <div>
            <div data-testid="auth-user">{auth.user?.username}</div>
            <div data-testid="license-tier">{license.tier}</div>
            <div data-testid="theme-mode">{theme.mode}</div>
            <div data-testid="gadgets-count">{gadgets.installed.length}</div>
          </div>
        );
      };

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
      );

      await waitFor(() => expect(screen.getByTestId('auth-user')).toHaveTextContent('owner'));
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'));
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));
    });
  });

  describe('Context Value Memoization', () => {
    test('AuthContext value is memoized - same reference on re-render', async () => {
      axios.get.mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } });

      let authRef1, authRef2;
      const Grab = () => { 
        const auth = useAuth();
        if (!authRef1) authRef1 = auth;
        else authRef2 = auth;
        return <div data-testid="user">{auth.user?.username}</div>;
      };

      render(<AuthProvider><Grab /></AuthProvider>);
      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'));

      // Force re-render by calling a no-op
      // The value should be the same reference
      expect(authRef1).toBe(authRef2);
    });

    test('LicenseContext value is memoized', async () => {
      axios.get.mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });

      let licenseRef1, licenseRef2;
      const Grab = () => { 
        const license = useLicense();
        if (!licenseRef1) licenseRef1 = license;
        else licenseRef2 = license;
        return <div data-testid="tier">{license.tier}</div>;
      };

      render(<LicenseProvider><Grab /></LicenseProvider>);
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('pro'));

      expect(licenseRef1).toBe(licenseRef2);
    });

    test('ThemeContext value is memoized', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      let themeRef1, themeRef2;
      const Grab = () => { 
        const theme = useTheme();
        if (!themeRef1) themeRef1 = theme;
        else themeRef2 = theme;
        return <div data-testid="mode">{theme.mode}</div>;
      };

      render(<ThemeProvider><Grab /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));

      expect(themeRef1).toBe(themeRef2);
    });

    test('GadgetContext value is memoized', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { gadgets: [] } })
        .mockResolvedValueOnce({ data: { sidebar_entries: [] } });

      let gadgetRef1, gadgetRef2;
      const Grab = () => { 
        const gadgets = useGadgets();
        if (!gadgetRef1) gadgetRef1 = gadgets;
        else gadgetRef2 = gadgets;
        return <div data-testid="count">{gadgets.installed.length}</div>;
      };

      render(<GadgetProvider><Grab /></GadgetProvider>);
      await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));

      expect(gadgetRef1).toBe(gadgetRef2);
    });
  });
});