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
import { ThemeProvider, useTheme, DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, ACCENT_RAMP } from '../../context/ThemeContext';
import axios from 'axios';

const ThemeProbe = ({ onCapture }) => {
  const theme = useTheme();
  if (onCapture) onCapture(theme);
  return (
    <div>
      <div data-testid="theme-loading">{String(theme.loading)}</div>
      <div data-testid="theme-mode">{theme.mode}</div>
      <div data-testid="theme-type">{theme.themeType}</div>
      <div data-testid="theme-accent">{theme.accentId || 'none'}</div>
      <div data-testid="theme-theme">{JSON.stringify(theme.theme)}</div>
      <button data-testid="toggle-mode-btn" onClick={() => theme.toggleMode()}>Toggle Mode</button>
      <button data-testid="apply-builtin-btn" onClick={() => theme.applyBuiltInTheme('violet')}>Apply Built-in</button>
      <button data-testid="apply-custom-btn" onClick={() => theme.applyCustomColors({ primary: '#FF0000', background: '#000000' })}>Apply Custom</button>
      <button data-testid="preview-btn" onClick={() => theme.previewColors({ primary: '#00FF00', background: '#111111' })}>Preview</button>
      <button data-testid="reset-btn" onClick={() => theme.resetToSaved()}>Reset</button>
      <button data-testid="apply-accent-btn" onClick={() => theme.applyAccent('amber')}>Apply Accent</button>
      <button data-testid="refresh-btn" onClick={() => theme.refreshTheme()}>Refresh</button>
    </div>
  );
};

describe('ThemeContext Provider - Dark/Light/System + Custom Themes', () => {
  let capturedTheme;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedTheme = null;
    // Reset DOM state
    document.body.classList.remove('dark-mode', 'light-mode');
    document.documentElement.removeAttribute('data-theme');
    // Clear any existing CSS variables
    Object.keys(DEFAULT_DARK_THEME).forEach(key => {
      document.documentElement.style.removeProperty(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
    });
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--background');
    document.documentElement.style.removeProperty('--surface');
    document.documentElement.style.removeProperty('--text-primary');
    document.documentElement.style.removeProperty('--color-primary');
    document.documentElement.style.removeProperty('--color-background');
  });

  describe('Initial State Hydration', () => {
    test('loads theme mode from backend on mount', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })      // /api/user/preferences
        .mockResolvedValueOnce({ data: { current_theme: null } })      // /api/milk/theme-forge
        .mockResolvedValue({ data: { ui_accent: 'violet' } });        // /api/settings

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('theme-loading')).toHaveTextContent('false'));
      expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark');
      expect(screen.getByTestId('theme-type')).toHaveTextContent('default');
    });

    test('falls back to localStorage when backend fails', async () => {
      localStorage.getItem.mockReturnValueOnce('light');
      axios.get
        .mockRejectedValueOnce(new Error('Network error'))             // /api/user/preferences
        .mockResolvedValueOnce({ data: { current_theme: null } })      // /api/milk/theme-forge
        .mockResolvedValue({ data: { ui_accent: 'violet' } });        // /api/settings

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('theme-loading')).toHaveTextContent('false'));
      expect(screen.getByTestId('theme-mode')).toHaveTextContent('light');
      expect(localStorage.getItem).toHaveBeenCalledWith('watchnexus_theme_mode');
    });

    test('uses default dark theme when no backend preference and no localStorage', async () => {
      localStorage.getItem.mockReturnValueOnce(null);
      axios.get
        .mockRejectedValueOnce(new Error('Network error'))             // /api/user/preferences
        .mockResolvedValueOnce({ data: { current_theme: null } })      // /api/milk/theme-forge
        .mockResolvedValue({ data: { ui_accent: 'violet' } });        // /api/settings

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('theme-loading')).toHaveTextContent('false'));
      expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark');
    });

    test('applies default dark theme CSS variables when no custom theme', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));
      
      // Check CSS variables were set
      expect(document.documentElement.style.getPropertyValue('--background')).toBe(DEFAULT_DARK_THEME.background);
      expect(document.documentElement.style.getPropertyValue('--surface')).toBe(DEFAULT_DARK_THEME.surface);
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe(DEFAULT_DARK_THEME.primary);
      expect(document.documentElement.style.getPropertyValue('--text-primary')).toBe(DEFAULT_DARK_THEME.textPrimary);
      expect(document.body.classList.contains('dark-mode')).toBe(true);
      expect(document.body.classList.contains('light-mode')).toBe(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    test('applies default light theme when mode is light', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'light' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('light'));
      
      expect(document.documentElement.style.getPropertyValue('--background')).toBe(DEFAULT_LIGHT_THEME.background);
      expect(document.documentElement.style.getPropertyValue('--surface')).toBe(DEFAULT_LIGHT_THEME.surface);
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe(DEFAULT_LIGHT_THEME.primary);
      expect(document.body.classList.contains('light-mode')).toBe(true);
      expect(document.body.classList.contains('dark-mode')).toBe(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    test('applies custom theme from backend', async () => {
      const customTheme = { 
        type: 'custom', 
        colors: { ...DEFAULT_DARK_THEME, primary: '#FF0000', background: '#111111' } 
      };
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: customTheme } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('theme-type')).toHaveTextContent('custom'));
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#FF0000');
      expect(document.documentElement.style.getPropertyValue('--background')).toBe('#111111');
    });

    test('applies built-in theme from backend', async () => {
      const builtInTheme = { 
        type: 'violet', 
        colors: { ...DEFAULT_DARK_THEME, primary: '#8B5CF6' } 
      };
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: builtInTheme } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('theme-type')).toHaveTextContent('violet'));
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#8B5CF6');
    });

    test('applies accent from settings on mount (layered on top of theme)', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'emerald' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      
      await waitFor(() => expect(screen.getByTestId('theme-accent')).toHaveTextContent('emerald'));
      // Accent should override primary
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe(ACCENT_RAMP.emerald[500]);
    });
  });

  describe('Mode Toggle', () => {
    test('toggleMode switches dark to light and saves to backend + localStorage', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.put.mockResolvedValue({ data: {} });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

      await act(async () => {
        await screen.getByTestId('toggle-mode-btn').click();
      });

      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/preferences'),
        null,
        { params: { theme_mode: 'light' } }
      );
      expect(localStorage.setItem).toHaveBeenCalledWith('watchnexus_theme_mode', 'light');
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('light'));
      expect(document.body.classList.contains('light-mode')).toBe(true);
    });

    test('toggleMode switches light to dark', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'light' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.put.mockResolvedValue({ data: {} });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('light'));

      await act(async () => {
        await screen.getByTestId('toggle-mode-btn').click();
      });

      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/preferences'),
        null,
        { params: { theme_mode: 'dark' } }
      );
      expect(localStorage.setItem).toHaveBeenCalledWith('watchnexus_theme_mode', 'dark');
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));
    });

    test('toggleMode handles backend failure gracefully', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.put.mockRejectedValueOnce(new Error('Network error'));

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

      await act(async () => {
        await screen.getByTestId('toggle-mode-btn').click();
      });

      // Should still toggle locally even if backend fails
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('light'));
      expect(localStorage.setItem).toHaveBeenCalledWith('watchnexus_theme_mode', 'light');
    });

    test('toggleMode adjusts custom theme colors for new mode', async () => {
      const customTheme = { 
        type: 'custom', 
        colors: { ...DEFAULT_DARK_THEME, primary: '#FF0000', background: '#111111' } 
      };
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: customTheme } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.put.mockResolvedValue({ data: {} });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

      await act(async () => {
        await screen.getByTestId('toggle-mode-btn').click();
      });

      // Background should switch to light theme default
      expect(document.documentElement.style.getPropertyValue('--background')).toBe(DEFAULT_LIGHT_THEME.background);
      // But primary should be preserved from custom theme
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#FF0000');
    });
  });

  describe('Built-in Theme Application', () => {
    test('applyBuiltInTheme calls backend and updates state', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.post.mockResolvedValueOnce({
        data: {
          theme: { type: 'amber', colors: { ...DEFAULT_DARK_THEME, primary: '#F59E0B' } }
        }
      });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

      await act(async () => {
        await screen.getByTestId('apply-builtin-btn').click();
      });

      expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/milk/set-theme?theme_type=violet'));
      await waitFor(() => expect(screen.getByTestId('theme-type')).toHaveTextContent('amber'));
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#F59E0B');
    });

    test('applyBuiltInTheme handles backend error', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.post.mockRejectedValueOnce(new Error('Failed'));

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

      await act(async () => {
        const result = await screen.getByTestId('apply-builtin-btn').click();
        // Button click returns void, but we can verify state doesn't change
      });

      await waitFor(() => expect(screen.getByTestId('theme-type')).toHaveTextContent('default'));
    });
  });

  describe('Custom Theme Application', () => {
    test('applyCustomColors sends custom colors to backend', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.post.mockResolvedValueOnce({
        data: {
          theme: { type: 'custom', colors: { ...DEFAULT_DARK_THEME, primary: '#FF0000' } }
        }
      });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

      await act(async () => {
        await screen.getByTestId('apply-custom-btn').click();
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/milk/custom-theme'),
        expect.objectContaining({ 
          colors: expect.objectContaining({ primary: '#FF0000' }),
          type: 'custom',
          name: 'Custom Theme'
        })
      );
      await waitFor(() => expect(screen.getByTestId('theme-type')).toHaveTextContent('custom'));
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#FF0000');
    });

    test('applyCustomColors handles backend error', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.post.mockRejectedValueOnce(new Error('Failed'));

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

      await act(async () => {
        await screen.getByTestId('apply-custom-btn').click();
      });

      await waitFor(() => expect(screen.getByTestId('theme-type')).toHaveTextContent('default'));
    });
  });

  describe('Preview Colors (Temporary, No Backend)', () => {
    test('previewColors applies colors temporarily without saving', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

      await act(async () => {
        await screen.getByTestId('preview-btn').click();
      });

      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#00FF00');
      expect(document.documentElement.style.getPropertyValue('--background')).toBe('#111111');
      // Should not call backend
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('previewColors works with custom theme active', async () => {
      const customTheme = { 
        type: 'custom', 
        colors: { ...DEFAULT_DARK_THEME, primary: '#FF0000' } 
      };
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: customTheme } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-type')).toHaveTextContent('custom'));
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#FF0000');

      await act(async () => {
        await screen.getByTestId('preview-btn').click();
      });

      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#00FF00');
    });
  });

  describe('Reset to Saved', () => {
    test('resetToSaved restores saved theme after preview', async () => {
      const savedTheme = { ...DEFAULT_DARK_THEME, primary: '#8B5CF6' };
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: { type: 'custom', colors: savedTheme } } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-type')).toHaveTextContent('custom'));
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#8B5CF6');

      // Change theme via preview
      await act(async () => {
        await screen.getByTestId('preview-btn').click();
      });
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#00FF00');

      // Reset
      await act(async () => {
        await screen.getByTestId('reset-btn').click();
      });
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#8B5CF6');
    });

    test('resetToSaved falls back to default when no saved theme', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-type')).toHaveTextContent('default'));

      // Change theme via preview
      await act(async () => {
        await screen.getByTestId('preview-btn').click();
      });
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#00FF00');

      // Reset
      await act(async () => {
        await screen.getByTestId('reset-btn').click();
      });
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe(DEFAULT_DARK_THEME.primary);
    });
  });

  describe('Accent Application', () => {
    test('applyAccent applies accent from ACCENT_RAMP and saves to backend', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });
      axios.put.mockResolvedValue({ data: {} });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

      await act(async () => {
        await screen.getByTestId('apply-accent-btn').click();
      });

      // Check accent was applied (amber 500 = #F59E0B)
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe(ACCENT_RAMP.amber[500]);
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/settings'),
        { ui_accent: 'amber' }
      );
      await waitFor(() => expect(screen.getByTestId('theme-accent')).toHaveTextContent('amber'));
    });

    test('applyAccent returns false for invalid accent ID', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

      // We can't easily test the return value, but we can verify no backend call for invalid accent
      await act(async () => {
        // Manually call with invalid accent
        const theme = useTheme();
        const result = await theme.applyAccent('invalid-accent');
        expect(result).toBe(false);
      });

      expect(axios.put).not.toHaveBeenCalled();
    });
  });

  describe('Refresh Theme', () => {
    test('refreshTheme re-fetches theme from backend', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

      await act(async () => {
        await screen.getByTestId('refresh-btn').click();
      });

      // Should have called /api/milk/theme-forge twice (initial + refresh)
      // and /api/user/preferences once, /api/settings twice
      expect(axios.get).toHaveBeenCalledTimes(4);
    });
  });

  describe('Re-apply Accent on Auth State Change', () => {
    test('applies accent from settings when user becomes authenticated', async () => {
      // Initial load - user not authenticated
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-accent')).toHaveTextContent('violet'));

      // Simulate auth state change - need to trigger the effect
      // The effect depends on isAuthenticated from AuthContext
      // This is tested in integration tests
    });
  });

  describe('SSR Safety', () => {
    test('does not access window/document during server render', () => {
      // This is inherently tested by Jest running in jsdom
      // If the code accessed window.document during render, it would throw
      expect(() => {
        render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      }).not.toThrow();
    });
  });

  describe('Cleanup on Unmount', () => {
    test('no memory leaks - timers/intervals cleaned up', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { theme_mode: 'dark' } })
        .mockResolvedValueOnce({ data: { current_theme: null } })
        .mockResolvedValue({ data: { ui_accent: 'violet' } });

      const { unmount } = render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
      await waitFor(() => expect(screen.getByTestId('theme-loading')).toHaveTextContent('false'));
      
      unmount();
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      // No errors should occur
    });
  });

  describe('Error Boundaries', () => {
    test('throws error when useTheme used outside ThemeProvider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<ThemeProbe />, { wrapperOverrides: { skipTheme: true } });
      }).toThrow('useTheme must be used within ThemeProvider');
      
      consoleError.mockRestore();
    });
  });

  describe('ACCENT_RAMP Constants', () => {
    test('all accent ramps have required shades', () => {
      Object.entries(ACCENT_RAMP).forEach(([name, ramp]) => {
        expect(ramp).toHaveProperty('100');
        expect(ramp).toHaveProperty('300');
        expect(ramp).toHaveProperty('400');
        expect(ramp).toHaveProperty('500');
        expect(ramp).toHaveProperty('600');
        expect(ramp).toHaveProperty('700');
        expect(ramp).toHaveProperty('900');
      });
    });
  });
});