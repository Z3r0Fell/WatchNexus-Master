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

describe('Failure Recovery Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Corrupted localStorage → Fallback to Defaults', () => {
    test('ThemeContext: invalid theme_mode in localStorage falls back to dark', async () => {
      localStorage.getItem.mockReturnValueOnce('not-a-valid-mode');
      axios.get
        .mockRejectedValueOnce(new Error('Network error'))             // /api/user/preferences
        .mockResolvedValueOnce({ data: { current_theme: null } })      // /api/milk/theme-forge
        .mockResolvedValue({ data: { ui_accent: 'violet' } });        // /api/settings

      const Probe = () => {
        const { mode, loading } = useTheme();
        if (loading) return <div data-testid="loading">loading</div>;
        return <div data-testid="mode">{mode}</div>;
      };

      render(<ThemeProvider><Probe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));
    });

    test('ThemeContext: corrupted JSON in localStorage falls back gracefully', async () => {
      // Simulate corrupted localStorage (though theme_mode is stored as plain string)
      localStorage.getItem.mockImplementationOnce(() => {
        throw new Error('localStorage corrupted');
      });
      axios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      const Probe = () => {
        const { mode, loading } = useTheme();
        if (loading) return <div data-testid="loading">loading</div>;
        return <div data-testid="mode">{mode}</div>;
      };

      render(<ThemeProvider><Probe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));
    });

    test('AuthContext: no localStorage usage (httpOnly cookies)', async () => {
      // AuthContext doesn't use localStorage - it uses httpOnly cookies
      // This test documents that there's no localStorage corruption risk for auth
      axios.get.mockRejectedValueOnce({ response: { status: 401 } });

      const Probe = () => {
        const { loading, isAuthenticated } = useAuth();
        if (loading) return <div data-testid="loading">loading</div>;
        return <div data-testid="auth">{String(isAuthenticated)}</div>;
      };

      render(<AuthProvider><Probe /></AuthProvider>);
      await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('false'));
    });
  });

  describe('Network Failure During Tier Fetch → Retry with Backoff', () => {
    test('LicenseContext: retry on network failure', async () => {
      let callCount = 0;
      axios.get.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: { tier: 'pro', modules_unlocked: [] } });
      });

      const Probe = () => {
        const { tier, loading, refreshLicense } = useLicense();
        if (loading) return <div data-testid="loading">loading</div>;
        return (
          <div>
            <div data-testid="tier">{tier}</div>
            <button data-testid="retry" onClick={refreshLicense}>Retry</button>
          </div>
        );
      };

      render(<LicenseProvider><Probe /></LicenseProvider>);
      
      // Initial load fails
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('standard'));
      expect(callCount).toBe(1);

      // Manual retry
      await act(async () => {
        await screen.getByTestId('retry').click();
      });

      // Should retry and eventually succeed
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('pro'));
      expect(callCount).toBe(2); // Only one retry call
    });

    test('LicenseContext: exponential backoff not implemented (documents gap)', async () => {
      // Current implementation doesn't have automatic retry with backoff
      // This documents the missing feature
      axios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });

      const Probe = () => {
        const { tier, loading } = useLicense();
        if (loading) return <div data-testid="loading">loading</div>;
        return <div data-testid="tier">{tier}</div>;
      };

      render(<LicenseProvider><Probe /></LicenseProvider>);
      
      // Falls back to standard on first failure
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('standard'));
      
      // No automatic retry - requires manual refresh
    });

    test('ThemeContext: network failure during theme load falls back to defaults', async () => {
      axios.get
        .mockRejectedValueOnce(new Error('Network error'))             // /api/user/preferences
        .mockRejectedValueOnce(new Error('Network error'))             // /api/milk/theme-forge
        .mockResolvedValue({ data: { ui_accent: 'violet' } });        // /api/settings

      const Probe = () => {
        const { mode, loading, themeType } = useTheme();
        if (loading) return <div data-testid="loading">loading</div>;
        return (
          <div>
            <div data-testid="mode">{mode}</div>
            <div data-testid="type">{themeType}</div>
          </div>
        );
      };

      render(<ThemeProvider><Probe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));
      expect(screen.getByTestId('type')).toHaveTextContent('default');
    });

    test('GadgetContext: network failure during load shows empty state', async () => {
      axios.get
        .mockRejectedValueOnce(new Error('Network error'))   // /api/ripen/installed
        .mockRejectedValueOnce(new Error('Network error'));  // /api/ripen/hooks

      const Probe = () => {
        const { installed, loading } = useGadgets();
        if (loading) return <div data-testid="loading">loading</div>;
        return <div data-testid="count">{installed.length}</div>;
      };

      render(<GadgetProvider><Probe /></GadgetProvider>);
      
      await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    });
  });

  describe('Token Refresh Fails → Logout + Redirect', () => {
    test('AuthContext: failed token refresh (401) logs out user', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } })  // Initial load
        .mockRejectedValueOnce({ response: { status: 401 } });             // fetchUser after loginWithToken

      let authRef;
      const Grab = () => { 
        authRef = useAuth(); 
        return (
          <div>
            <div data-testid="user">{authRef.user?.username}</div>
            <div data-testid="auth">{String(authRef.isAuthenticated)}</div>
            <button data-testid="refresh" onClick={() => authRef.loginWithToken('expired', null)}>Refresh</button>
          </div>
        );
      };

      render(<AuthProvider><Grab /></AuthProvider>);
      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'));

      await act(async () => {
        await screen.getByTestId('refresh').click();
      });

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
      expect(screen.getByTestId('auth')).toHaveTextContent('false');
    });

    test('AuthContext: network error during fetchUser clears auth state', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } })
        .mockRejectedValueOnce(new Error('Network error'));

      let authRef;
      const Grab = () => { 
        authRef = useAuth(); 
        return (
          <div>
            <div data-testid="user">{authRef.user?.username}</div>
            <div data-testid="auth">{String(authRef.isAuthenticated)}</div>
            <button data-testid="refresh" onClick={() => authRef.loginWithToken('token', null)}>Refresh</button>
          </div>
        );
      };

      render(<AuthProvider><Grab /></AuthProvider>);
      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'));

      await act(async () => {
        await screen.getByTestId('refresh').click();
      });

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
      expect(screen.getByTestId('auth')).toHaveTextContent('false');
    });

    test('AuthContext: login failure does not clear existing valid session', async () => {
      axios.get.mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } });
      axios.post.mockRejectedValueOnce({ response: { status: 401 } });

      let authRef;
      const Grab = () => { 
        authRef = useAuth(); 
        return (
          <div>
            <div data-testid="user">{authRef.user?.username}</div>
            <div data-testid="auth">{String(authRef.isAuthenticated)}</div>
            <button data-testid="login" onClick={() => authRef.login('wrong@test.com', 'wrong')}>Login</button>
          </div>
        );
      };

      render(<AuthProvider><Grab /></AuthProvider>);
      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'));

      // Failed login should not affect current session
      await expect(act(async () => {
        await authRef.login('wrong@test.com', 'wrong');
      })).rejects.toThrow();

      // Session should still be valid
      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'));
      expect(screen.getByTestId('auth')).toHaveTextContent('true');
    });
  });

  describe('License Server Down → Cached Tier Used, Warning Banner', () => {
    test('LicenseContext: uses cached tier when server unavailable', async () => {
      // First load succeeds
      axios.get.mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });

      const Probe = () => {
        const { tier, loading, refreshLicense } = useLicense();
        if (loading) return <div data-testid="loading">loading</div>;
        return (
          <div>
            <div data-testid="tier">{tier}</div>
            <button data-testid="refresh" onClick={refreshLicense}>Refresh</button>
          </div>
        );
      };

      render(<LicenseProvider><Probe /></LicenseProvider>);
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('pro'));

      // Server goes down
      axios.get.mockRejectedValueOnce(new Error('Server down'));

      await act(async () => {
        await screen.getByTestId('refresh').click();
      });

      // Should keep cached tier (pro) on failure
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('pro'));
    });

    test('LicenseContext: first load failure falls back to standard', async () => {
      axios.get.mockRejectedValueOnce(new Error('Server down'));

      const Probe = () => {
        const { tier, loading } = useLicense();
        if (loading) return <div data-testid="loading">loading</div>;
        return <div data-testid="tier">{tier}</div>;
      };

      render(<LicenseProvider><Probe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('standard'));
    });

    test('GadgetContext: 401 on load clears gadgets gracefully', async () => {
      axios.get
        .mockRejectedValueOnce({ response: { status: 401 } })   // /api/ripen/installed
        .mockRejectedValueOnce({ response: { status: 401 } });  // /api/ripen/hooks

      const Probe = () => {
        const { installed, loading } = useGadgets();
        if (loading) return <div data-testid="loading">loading</div>;
        return <div data-testid="count">{installed.length}</div>;
      };

      render(<GadgetProvider><Probe /></GadgetProvider>);
      
      await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('Partial Backend Failures', () => {
    test('ThemeContext: theme-forge fails but preferences succeeds', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })        // preferences OK
        .mockRejectedValueOnce(new Error('theme-forge down'))           // theme-forge fails
        .mockResolvedValue({ data: { ui_accent: 'violet' } });         // settings OK

      const Probe = () => {
        const { mode, loading, themeType } = useTheme();
        if (loading) return <div data-testid="loading">loading</div>;
        return (
          <div>
            <div data-testid="mode">{mode}</div>
            <div data-testid="type">{themeType}</div>
          </div>
        );
      };

      render(<ThemeProvider><Probe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));
      expect(screen.getByTestId('type')).toHaveTextContent('default'); // Falls back to default theme
    });

    test('ThemeContext: settings (accent) fails but theme loads', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockRejectedValueOnce(new Error('settings down'));

      const Probe = () => {
        const { mode, loading, accentId } = useTheme();
        if (loading) return <div data-testid="loading">loading</div>;
        return (
          <div>
            <div data-testid="mode">{mode}</div>
            <div data-testid="accent">{accentId || 'none'}</div>
          </div>
        );
      };

      render(<ThemeProvider><Probe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));
      expect(screen.getByTestId('accent')).toHaveTextContent('none'); // No accent applied
    });

    test('AuthContext: logout backend fails but local state clears', async () => {
      axios.get.mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } });
      axios.post.mockRejectedValueOnce(new Error('Network error'));

      let authRef;
      const Grab = () => { 
        authRef = useAuth(); 
        return (
          <div>
            <div data-testid="user">{authRef.user?.username}</div>
            <div data-testid="auth">{String(authRef.isAuthenticated)}</div>
            <button data-testid="logout" onClick={() => authRef.logout()}>Logout</button>
          </div>
        );
      };

      render(<AuthProvider><Grab /></AuthProvider>);
      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'));

      await act(async () => {
        await screen.getByTestId('logout').click();
      });

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
      expect(screen.getByTestId('auth')).toHaveTextContent('false');
    });
  });

  describe('Timeout Handling', () => {
    test('axios timeout (30s) triggers error handling', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.code = 'ECONNABORTED';
      axios.get.mockRejectedValueOnce(timeoutError);

      const Probe = () => {
        const { loading, isAuthenticated } = useAuth();
        if (loading) return <div data-testid="loading">loading</div>;
        return <div data-testid="auth">{String(isAuthenticated)}</div>;
      };

      render(<AuthProvider><Probe /></AuthProvider>);
      
      await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('false'));
    });

    test('marmaladeApi timeout handling', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.code = 'ECONNABORTED';
      
      const marmaladeModule = require('../../services/marmaladeApi');
      marmaladeModule.default.get.mockRejectedValueOnce(timeoutError);
      
      await expect(marmaladeModule.marmaladeStatus.getStatus()).rejects.toThrow('Request timed out');
    });

    test('nexusApi timeout handling', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.code = 'ECONNABORTED';
      
      const nexusModule = require('../../services/nexusApi');
      nexusModule.apiClient.get.mockRejectedValueOnce(timeoutError);
      
      await expect(nexusModule.securityApi.getStats()).rejects.toThrow('Request timed out');
    });
  });

  describe('Error Boundary Integration', () => {
    test('context errors are caught by ErrorBoundary', async () => {
      // Force an error in context
      axios.get.mockImplementation(() => {
        throw new Error('Context error');
      });

      const Probe = () => {
        const auth = useAuth();
        return <div data-testid="auth">{String(auth.isAuthenticated)}</div>;
      };

      // The ErrorBoundary in test-utils should catch this
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>
      );

      // Should not crash the test runner
      await waitFor(() => expect(screen.getByTestId('auth')).toBeInTheDocument());
    });
  });

  describe('State Recovery After Errors', () => {
    test('AuthContext: can re-login after failed login', async () => {
      axios.get.mockRejectedValueOnce({ response: { status: 401 } });
      axios.post
        .mockRejectedValueOnce({ response: { status: 401 } })    // Failed login
        .mockResolvedValueOnce({ data: { user: { id: '1', username: 'owner' } } }); // Successful login

      let authRef;
      const Grab = () => { 
        authRef = useAuth(); 
        return (
          <div>
            <div data-testid="user">{authRef.user?.username || 'none'}</div>
            <div data-testid="auth">{String(authRef.isAuthenticated)}</div>
            <button data-testid="login" onClick={() => authRef.login('test@test.com', 'pass')}>Login</button>
          </div>
        );
      };

      render(<AuthProvider><Grab /></AuthProvider>);
      await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('false'));

      // First login fails
      await expect(act(async () => {
        await authRef.login('wrong@test.com', 'wrong');
      })).rejects.toThrow();

      // Second login succeeds
      await act(async () => {
        await authRef.login('test@test.com', 'pass');
      });

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner'));
      expect(screen.getByTestId('auth')).toHaveTextContent('true');
    });

    test('LicenseContext: can refresh after failed refresh', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } }) // Initial
        .mockRejectedValueOnce(new Error('Network error'))                           // Failed refresh
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });    // Successful refresh

      const Probe = () => {
        const { tier, loading, refreshLicense } = useLicense();
        if (loading) return <div data-testid="loading">loading</div>;
        return (
          <div>
            <div data-testid="tier">{tier}</div>
            <button data-testid="refresh" onClick={refreshLicense}>Refresh</button>
          </div>
        );
      };

      render(<LicenseProvider><Probe /></LicenseProvider>);
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('standard'));

      // Failed refresh
      await act(async () => {
        await screen.getByTestId('refresh').click();
      });
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('standard'));

      // Successful refresh
      await act(async () => {
        await screen.getByTestId('refresh').click();
      });
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('pro'));
    });

    test('ThemeContext: can re-apply theme after failed apply', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.post
        .mockRejectedValueOnce(new Error('Failed'))      // First apply fails
        .mockResolvedValueOnce({                         // Second apply succeeds
          data: { theme: { type: 'custom', colors: { ...require('../../context/ThemeContext').DEFAULT_DARK_THEME, primary: '#FF0000' } } }
        });

      let themeRef;
      const Grab = () => { 
        themeRef = useTheme(); 
        return (
          <div>
            <div data-testid="type">{themeRef.themeType}</div>
            <button data-testid="apply" onClick={() => themeRef.applyCustomColors({ primary: '#FF0000' })}>Apply</button>
          </div>
        );
      };

      render(<ThemeProvider><Grab /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('type')).toHaveTextContent('default'));

      // First apply fails
      await act(async () => {
        try { await themeRef.applyCustomColors({ primary: '#FF0000' }); } catch (e) {}
      });
      expect(screen.getByTestId('type')).toHaveTextContent('default');

      // Second apply succeeds
      await act(async () => {
        await themeRef.applyCustomColors({ primary: '#FF0000' });
      });
      await waitFor(() => expect(screen.getByTestId('type')).toHaveTextContent('custom'));
    });
  });

  describe('Graceful Degradation', () => {
    test('all contexts degrade gracefully when backend completely unavailable', async () => {
      axios.get.mockRejectedValue(new Error('Backend down'));

      const Probe = () => {
        const auth = useAuth();
        const license = useLicense();
        const theme = useTheme();
        const gadgets = useGadgets();
        return (
          <div>
            <div data-testid="auth">{String(auth.isAuthenticated)}</div>
            <div data-testid="license">{license.tier}</div>
            <div data-testid="theme">{theme.mode}</div>
            <div data-testid="gadgets">{gadgets.installed.length}</div>
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

      await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('false'));
      await waitFor(() => expect(screen.getByTestId('license')).toHaveTextContent('standard'));
      await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('dark'));
      await waitFor(() => expect(screen.getByTestId('gadgets')).toHaveTextContent('0'));
    });
  });
});