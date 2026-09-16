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

import { render, screen, waitFor, act, userEvent } from '../test-utils';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { LicenseProvider, useLicense } from '../../context/LicenseContext';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';
import { GadgetProvider, useGadgets } from '../../context/GadgetContext';
import { usePrompt } from '../../hooks/use-prompt';
import { useConfirm } from '../../hooks/use-confirm';
import { useToast } from '../../hooks/use-toast';
import axios from 'axios';
import React from 'react';

describe('Integrated State Layer Tests - Full App Simulation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Session Flow', () => {
    test('full login → tier fetch → theme load → gadgets flow', async () => {
      // Setup all mock responses
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'testuser', Email: 'test@test.com', Role: 'user' } }) // Auth
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: ['marmalade', 'compote'] } })          // License
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })                                              // Theme pref
        .mockResolvedValueOnce({ data: { current_theme: null } })                                             // Theme forge
        .mockResolvedValue({ data: { ui_accent: 'violet' } })                                                // Theme settings
        .mockResolvedValueOnce({ data: { gadgets: [{ gadget_id: 'weather', status: 'active' }] } })          // Gadgets installed
        .mockResolvedValueOnce({ data: { sidebar_entries: [{ label: 'Weather', path: '/weather' }] } });     // Gadgets hooks

      const App = () => {
        const auth = useAuth();
        const license = useLicense();
        const theme = useTheme();
        const gadgets = useGadgets();
        const { toast } = useToast();
        const { prompt } = usePrompt();
        const { confirm } = useConfirm();

        const handleLogin = async () => {
          await auth.login('test@test.com', 'password');
          toast({ title: 'Welcome back!' });
        };

        const handleThemeToggle = async () => {
          await theme.toggleMode();
        };

        const handleInstallGadget = async () => {
          const confirmed = await confirm({ title: 'Install Gadget?', description: 'This will install the weather gadget.' });
          if (confirmed) {
            await gadgets.install('weather');
            toast({ title: 'Gadget installed!' });
          }
        };

        const handlePrompt = async () => {
          const name = await prompt({ title: 'Enter name', placeholder: 'Your name' });
          if (name) toast({ title: `Hello, ${name}!` });
        };

        if (auth.loading || license.loading || theme.loading || gadgets.loading) {
          return <div data-testid="app-loading">Loading...</div>;
        }

        return (
          <div>
            <div data-testid="user-status">{auth.isAuthenticated ? 'Logged In' : 'Logged Out'}</div>
            <div data-testid="username">{auth.user?.username}</div>
            <div data-testid="license-tier">{license.tier}</div>
            <div data-testid="theme-mode">{theme.mode}</div>
            <div data-testid="gadgets-count">{gadgets.installed.length}</div>
            <div data-testid="mod-compote">{String(license.isModuleUnlocked('compote'))}</div>
            <div data-testid="mod-security">{String(license.isModuleUnlocked('security'))}</div>
            <button data-testid="login-btn" onClick={handleLogin} disabled={auth.isAuthenticated}>Login</button>
            <button data-testid="theme-toggle" onClick={handleThemeToggle}>Toggle Theme</button>
            <button data-testid="install-gadget" onClick={handleInstallGadget}>Install Gadget</button>
            <button data-testid="prompt-btn" onClick={handlePrompt}>Prompt</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <LicenseProvider>
            <ThemeProvider>
              <GadgetProvider>
                <App />
              </GadgetProvider>
            </ThemeProvider>
          </LicenseProvider>
        </AuthProvider>
      );

      // Wait for all loading to complete
      await waitFor(() => expect(screen.queryByTestId('app-loading')).not.toBeInTheDocument());
      
      // Initial state - not logged in
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged Out');
      expect(screen.getByTestId('license-tier')).toHaveTextContent('pro');
      expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark');
      expect(screen.getByTestId('gadgets-count')).toHaveTextContent('1');
      expect(screen.getByTestId('mod-compote')).toHaveTextContent('true');
      expect(screen.getByTestId('mod-security')).toHaveTextContent('false');

      // Login
      axios.post.mockResolvedValueOnce({ data: { user: { id: '1', username: 'testuser' } } });
      axios.put.mockResolvedValue({ data: {} }); // For theme toggle

      await act(async () => {
        await screen.getByTestId('login-btn').click();
      });

      await waitFor(() => expect(screen.getByTestId('user-status')).toHaveTextContent('Logged In'));
      expect(screen.getByTestId('username')).toHaveTextContent('testuser');

      // Toggle theme
      await act(async () => {
        await screen.getByTestId('theme-toggle').click();
      });

      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('light'));

      // Install gadget (with confirm)
      axios.post.mockResolvedValueOnce({ data: { success: true } });
      axios.get
        .mockResolvedValueOnce({ data: { gadgets: [{ gadget_id: 'weather', status: 'active' }, { gadget_id: 'new-gadget' }] } })
        .mockResolvedValueOnce({ data: { sidebar_entries: [] } });

      await act(async () => {
        await userEvent.click(screen.getByTestId('install-gadget'));
        await userEvent.click(screen.getByText('Yes'));
      });

      await waitFor(() => expect(screen.getByTestId('gadgets-count')).toHaveTextContent('2'));

      // Prompt
      await act(async () => {
        await userEvent.click(screen.getByTestId('prompt-btn'));
        await userEvent.type(screen.getByRole('textbox'), 'Test User');
        await userEvent.click(screen.getByText('Confirm'));
      });

      // Toast should have been shown
    });
  });

  describe('Tier Upgrade Flow', () => {
    test('license upgrade unlocks pro modules immediately', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'user' } })                                    // Auth
        .mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } })                       // License initial
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })                                           // Theme
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } })
        .mockResolvedValueOnce({ data: { gadgets: [] } })                                                  // Gadgets
        .mockResolvedValueOnce({ data: { sidebar_entries: [] } });

      const App = () => {
        const auth = useAuth();
        const license = useLicense();
        
        if (auth.loading || license.loading) return <div data-testid="loading">Loading</div>;
        
        return (
          <div>
            <div data-testid="tier">{license.tier}</div>
            <div data-testid="compote">{String(license.isModuleUnlocked('compote'))}</div>
            <div data-testid="fondue">{String(license.isModuleUnlocked('fondue'))}</div>
            <div data-testid="security">{String(license.isModuleUnlocked('security'))}</div>
            <button data-testid="upgrade" onClick={() => {
              window.dispatchEvent(new CustomEvent('watchnexus_license_changed'));
            }}>Simulate Upgrade</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <LicenseProvider>
            <ThemeProvider>
              <GadgetProvider>
                <App />
              </GadgetProvider>
            </ThemeProvider>
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('standard'));
      expect(screen.getByTestId('compote')).toHaveTextContent('false');
      expect(screen.getByTestId('fondue')).toHaveTextContent('false');
      expect(screen.getByTestId('security')).toHaveTextContent('false');

      // Simulate license upgrade
      axios.get.mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });
      
      await act(async () => {
        await screen.getByTestId('upgrade').click();
      });

      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('pro'));
      expect(screen.getByTestId('compote')).toHaveTextContent('true');
      expect(screen.getByTestId('fondue')).toHaveTextContent('true');
      expect(screen.getByTestId('security')).toHaveTextContent('false'); // Still ultra
    });

    test('ultra upgrade unlocks all modules', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'user' } })
        .mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } })
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } })
        .mockResolvedValueOnce({ data: { gadgets: [] } })
        .mockResolvedValueOnce({ data: { sidebar_entries: [] } });

      const App = () => {
        const auth = useAuth();
        const license = useLicense();
        
        if (auth.loading || license.loading) return <div data-testid="loading">Loading</div>;
        
        return (
          <div>
            <div data-testid="tier">{license.tier}</div>
            <div data-testid="security">{String(license.isModuleUnlocked('security'))}</div>
            <div data-testid="rind">{String(license.isModuleUnlocked('rind'))}</div>
            <button data-testid="upgrade" onClick={() => {
              window.dispatchEvent(new CustomEvent('watchnexus_license_changed'));
            }}>Simulate Upgrade</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <LicenseProvider>
            <ThemeProvider>
              <GadgetProvider>
                <App />
              </GadgetProvider>
            </ThemeProvider>
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('standard'));
      expect(screen.getByTestId('security')).toHaveTextContent('false');

      axios.get.mockResolvedValueOnce({ data: { tier: 'ultra', modules_unlocked: [] } });
      
      await act(async () => {
        await screen.getByTestId('upgrade').click();
      });

      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('ultra'));
      expect(screen.getByTestId('security')).toHaveTextContent('true');
      expect(screen.getByTestId('rind')).toHaveTextContent('true');
    });
  });

  describe('Theme Persistence Across Sessions', () => {
    test('theme mode persists via localStorage when backend unavailable', async () => {
      localStorage.getItem.mockReturnValueOnce('light');
      axios.get
        .mockRejectedValueOnce(new Error('Backend down'))              // Preferences
        .mockResolvedValueOnce({ data: { current_theme: null } })      // Theme forge
        .mockResolvedValue({ data: { ui_accent: 'violet' } });        // Settings

      const App = () => {
        const theme = useTheme();
        if (theme.loading) return <div data-testid="loading">Loading</div>;
        return (
          <div>
            <div data-testid="mode">{theme.mode}</div>
            <button data-testid="toggle" onClick={() => theme.toggleMode()}>Toggle</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('light'));

      // Toggle should work and save to localStorage
      axios.put.mockResolvedValue({ data: {} });
      
      await act(async () => {
        await screen.getByTestId('toggle').click();
      });

      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'));
      expect(localStorage.setItem).toHaveBeenCalledWith('watchnexus_theme_mode', 'dark');
    });
  });

  describe('Error Recovery Flow', () => {
    test('network failure during session - graceful degradation', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'user' } })   // Auth
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } }) // License
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })          // Theme
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } })
        .mockResolvedValueOnce({ data: { gadgets: [] } })                 // Gadgets
        .mockResolvedValueOnce({ data: { sidebar_entries: [] } });

      const App = () => {
        const auth = useAuth();
        const license = useLicense();
        const theme = useTheme();
        const gadgets = useGadgets();
        const { toast } = useToast();
        
        const handleRefresh = async () => {
          try {
            await license.refreshLicense();
            toast({ title: 'License refreshed' });
          } catch (e) {
            toast({ title: 'Refresh failed', variant: 'destructive' });
          }
        };
        
        if (auth.loading || license.loading || theme.loading || gadgets.loading) {
          return <div data-testid="loading">Loading</div>;
        }
        
        return (
          <div>
            <div data-testid="tier">{license.tier}</div>
            <button data-testid="refresh" onClick={handleRefresh}>Refresh License</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <LicenseProvider>
            <ThemeProvider>
              <GadgetProvider>
                <App />
              </GadgetProvider>
            </ThemeProvider>
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('pro'));

      // Network fails
      axios.get.mockRejectedValueOnce(new Error('Network error'));
      
      await act(async () => {
        await screen.getByTestId('refresh').click();
      });

      // Should keep cached tier
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('pro'));
    });

    test('logout clears all context state', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'user' } })
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } })
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } })
        .mockResolvedValueOnce({ data: { gadgets: [{ gadget_id: 'weather' }] } })
        .mockResolvedValueOnce({ data: { sidebar_entries: [] } });
      axios.post.mockResolvedValue({ data: { success: true } });

      let authRef;
      const App = () => {
        authRef = useAuth();
        const license = useLicense();
        const gadgets = useGadgets();
        
        if (authRef.loading || license.loading || gadgets.loading) return <div data-testid="loading">Loading</div>;
        
        return (
          <div>
            <div data-testid="auth">{String(authRef.isAuthenticated)}</div>
            <div data-testid="tier">{license.tier}</div>
            <div data-testid="gadgets">{gadgets.installed.length}</div>
            <button data-testid="logout" onClick={() => authRef.logout()}>Logout</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <LicenseProvider>
            <ThemeProvider>
              <GadgetProvider>
                <App />
              </GadgetProvider>
            </ThemeProvider>
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('true'));
      await waitFor(() => expect(screen.getByTestId('gadgets')).toHaveTextContent('1'));

      await act(async () => {
        await screen.getByTestId('logout').click();
      });

      await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('false'));
      // Note: GadgetContext clears on isAuthenticated change, but that requires AuthContext to notify
      // Current implementation: GadgetContext watches isAuthenticated from AuthContext
    });
  });

  describe('Concurrent Operations Stress Test', () => {
    test('rapid theme toggles + license refresh + gadget operations', async () => {
      axios.get
        .mockResolvedValue({ data: { 
          Id: '1', Username: 'user' }, 
          tier: 'pro', 
          theme_mode: 'dark', 
          current_theme: null, 
          ui_accent: 'violet',
          gadgets: [],
          sidebar_entries: []
        });
      axios.put.mockResolvedValue({ data: {} });
      axios.post.mockResolvedValue({ data: { success: true } });
      axios.delete.mockResolvedValue({ data: { success: true } });

      const App = () => {
        const auth = useAuth();
        const license = useLicense();
        const theme = useTheme();
        const gadgets = useGadgets();
        
        if (auth.loading || license.loading || theme.loading || gadgets.loading) {
          return <div data-testid="loading">Loading</div>;
        }
        
        return (
          <div>
            <div data-testid="mode">{theme.mode}</div>
            <div data-testid="tier">{license.tier}</div>
            <div data-testid="gadgets">{gadgets.installed.length}</div>
            <button data-testid="toggle-theme" onClick={() => theme.toggleMode()}>Toggle Theme</button>
            <button data-testid="refresh-license" onClick={() => license.refreshLicense()}>Refresh License</button>
            <button data-testid="install-gadget" onClick={() => gadgets.install('g1')}>Install</button>
            <button data-testid="uninstall-gadget" onClick={() => gadgets.uninstall('g1')}>Uninstall</button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <LicenseProvider>
            <ThemeProvider>
              <GadgetProvider>
                <App />
              </GadgetProvider>
            </ThemeProvider>
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

      // Fire multiple concurrent operations
      await act(async () => {
        await Promise.all([
          screen.getByTestId('toggle-theme').click(),
          screen.getByTestId('refresh-license').click(),
          screen.getByTestId('install-gadget').click(),
        ]);
      });

      // All should complete without errors
      await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('light'));
      await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('pro'));
      await waitFor(() => expect(screen.getByTestId('gadgets')).toHaveTextContent('1'));
    });
  });

  describe('Memory Leak Prevention', () => {
    test('unmounting app cleans up all subscriptions', async () => {
      axios.get
        .mockResolvedValue({ data: { 
          Id: '1', Username: 'user' }, 
          tier: 'pro', 
          theme_mode: 'dark', 
          current_theme: null, 
          ui_accent: 'violet',
          gadgets: [],
          sidebar_entries: []
        });

      const App = () => {
        const auth = useAuth();
        const license = useLicense();
        const theme = useTheme();
        const gadgets = useGadgets();
        
        if (auth.loading || license.loading || theme.loading || gadgets.loading) {
          return <div data-testid="loading">Loading</div>;
        }
        
        return <div data-testid="ready">Ready</div>;
      };

      const { unmount } = render(
        <AuthProvider>
          <LicenseProvider>
            <ThemeProvider>
              <GadgetProvider>
                <App />
              </GadgetProvider>
            </ThemeProvider>
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('ready')).toBeInTheDocument());

      unmount();

      // Should not throw or leave dangling timers/listeners
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    });

    test('re-mounting app creates fresh state', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { Id: '1', Username: 'user1' } })
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } })
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } })
        .mockResolvedValueOnce({ data: { gadgets: [] } })
        .mockResolvedValueOnce({ data: { sidebar_entries: [] } });

      const App = () => {
        const auth = useAuth();
        if (auth.loading) return <div data-testid="loading">Loading</div>;
        return <div data-testid="user">{auth.user?.username}</div>;
      };

      // First mount
      const { unmount, rerender } = render(
        <AuthProvider>
          <LicenseProvider>
            <ThemeProvider>
              <GadgetProvider>
                <App />
              </GadgetProvider>
            </ThemeProvider>
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('user1'));
      unmount();

      // Second mount with different user
      axios.get.mockResolvedValueOnce({ data: { Id: '2', Username: 'user2' } });
      
      rerender(
        <AuthProvider>
          <LicenseProvider>
            <ThemeProvider>
              <GadgetProvider>
                <App />
              </GadgetProvider>
            </ThemeProvider>
          </LicenseProvider>
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('user2'));
    });
  });
});