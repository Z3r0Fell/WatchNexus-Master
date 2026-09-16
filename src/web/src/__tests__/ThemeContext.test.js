import { render, screen, waitFor, act } from './test-utils';
import { ThemeProvider, useTheme, DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, ACCENT_RAMP } from '../context/ThemeContext';
import axios from 'axios';

const Probe = () => {;
  const { theme, themeType, mode, loading, toggleMode, applyBuiltInTheme, applyCustomColors, previewColors, resetToSaved, accentId, applyAccent, refreshTheme } = useTheme();
  if (loading) return <div data-testid="theme-loading">loading</div>;
  return (;
    <div>;
      <div data-testid="theme-mode">{mode}</div>;
      <div data-testid="theme-type">{themeType}</div>;
      <div data-testid="theme-accent">{accentId || 'none'}</div>;
      <button data-testid="toggle-mode-btn" onClick={toggleMode}>Toggle Mode</button>;
      <button data-testid="apply-builtin-btn" onClick={() => applyBuiltInTheme('dark')}>Apply Built-in</button>;
      <button data-testid="apply-custom-btn" onClick={() => applyCustomColors({ primary: '#FF0000' })}>Apply Custom</button>;
      <button data-testid="preview-btn" onClick={() => previewColors({ primary: '#00FF00' })}>Preview</button>;
      <button data-testid="reset-btn" onClick={resetToSaved}>Reset</button>;
      <button data-testid="apply-accent-btn" onClick={() => applyAccent('amber')}>Apply Accent</button>;
      <button data-testid="refresh-btn" onClick={refreshTheme}>Refresh</button>;
    </div>;
  );
};

describe('ThemeContext', () => {;
  afterEach(() => {;
    jest.clearAllMocks();
    // Reset document.body classes;
    document.body.classList.remove('dark-mode', 'light-mode');
    document.documentElement.removeAttribute('data-theme');
  });

  test('loads theme mode from backend on mount', async () => {;
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'dark' } }) // /api/user/preferences;
      .mockResolvedValueOnce({ data: { current_theme: null } }); // /api/milk/theme-forge;
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } }); // /api/settings;

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));
  });

  test('falls back to localStorage when backend fails', async () => {;
    localStorage.getItem.mockReturnValueOnce('light');
    axios.get;
      .mockRejectedValueOnce(new Error('Network error')) // /api/user/preferences;
      .mockResolvedValueOnce({ data: { current_theme: null } }); // /api/milk/theme-forge;
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('light'));
  });

  test('applies default dark theme when no custom theme', async () => {;
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'dark' } });
      .mockResolvedValueOnce({ data: { current_theme: null } });
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));
    ;
    // Check that CSS variables were set;
    expect(document.documentElement.style.getPropertyValue('--background')).toBe(DEFAULT_DARK_THEME.background);
    expect(document.body.classList.contains('dark-mode')).toBe(true);
  });

  test('applies default light theme when mode is light', async () => {;
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'light' } });
      .mockResolvedValueOnce({ data: { current_theme: null } });
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('light'));
    ;
    expect(document.documentElement.style.getPropertyValue('--background')).toBe(DEFAULT_LIGHT_THEME.background);
    expect(document.body.classList.contains('light-mode')).toBe(true);
  });

  test('applies custom theme from backend', async () => {;
    const customTheme = { ;
      type: 'custom', ;
      colors: { ...DEFAULT_DARK_THEME, primary: '#FF0000' } ;
    };
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'dark' } });
      .mockResolvedValueOnce({ data: { current_theme: customTheme } });
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-type')).toHaveTextContent('custom'));
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#FF0000');
  });

  test('toggles mode and saves to backend and localStorage', async () => {;
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'dark' } });
      .mockResolvedValueOnce({ data: { current_theme: null } });
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } });
    axios.put.mockResolvedValue({ data: {} });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

    await act(async () => {;
      await screen.getByTestId('toggle-mode-btn').click();
    });

    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/api/user/preferences'), null, { params: { theme_mode: 'light' } });
    expect(localStorage.setItem).toHaveBeenCalledWith('watchnexus_theme_mode', 'light');
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('light'));
  });

  test('applyBuiltInTheme calls backend and updates state', async () => {;
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'dark' } });
      .mockResolvedValueOnce({ data: { current_theme: null } });
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } });
    axios.post.mockResolvedValueOnce({ ;
      data: { ;
        theme: { type: 'violet', colors: { ...DEFAULT_DARK_THEME, primary: '#8B5CF6' } } ;
      } ;
    });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

    await act(async () => {;
      await screen.getByTestId('apply-builtin-btn').click();
    });

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/milk/set-theme?theme_type=dark'));
    await waitFor(() => expect(screen.getByTestId('theme-type')).toHaveTextContent('dark'));
  });

  test('applyCustomColors sends custom colors to backend', async () => {;
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'dark' } });
      .mockResolvedValueOnce({ data: { current_theme: null } });
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } });
    axios.post.mockResolvedValueOnce({ ;
      data: { ;
        theme: { type: 'custom', colors: { ...DEFAULT_DARK_THEME, primary: '#FF0000' } } ;
      } ;
    });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

    await act(async () => {;
      await screen.getByTestId('apply-custom-btn').click();
    });

    expect(axios.post).toHaveBeenCalledWith(;
      expect.stringContaining('/api/milk/custom-theme'),;
      expect.objectContaining({ colors: expect.objectContaining({ primary: '#FF0000' }) });
    );
  });

  test('previewColors applies colors temporarily without saving', async () => {;
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'dark' } });
      .mockResolvedValueOnce({ data: { current_theme: null } });
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

    await act(async () => {;
      await screen.getByTestId('preview-btn').click();
    });

    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#00FF00');
    // Should not call backend;
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('resetToSaved restores saved theme', async () => {;
    const savedTheme = { ...DEFAULT_DARK_THEME, primary: '#8B5CF6' };
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'dark' } });
      .mockResolvedValueOnce({ data: { current_theme: { type: 'custom', colors: savedTheme } } });
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

    // Change theme via preview;
    await act(async () => {;
      await screen.getByTestId('preview-btn').click();
    });
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#00FF00');

    // Reset;
    await act(async () => {;
      await screen.getByTestId('reset-btn').click();
    });
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#8B5CF6');
  });

  test('applyAccent applies accent from ACCENT_RAMP', async () => {;
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'dark' } });
      .mockResolvedValueOnce({ data: { current_theme: null } });
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } });
    axios.put.mockResolvedValue({ data: {} });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

    await act(async () => {;
      await screen.getByTestId('apply-accent-btn').click();
    });

    // Check accent was applied (amber 500 = #F59E0B);
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(ACCENT_RAMP.amber[500]);
    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/api/settings'), { ui_accent: 'amber' });
    await waitFor(() => expect(screen.getByTestId('theme-accent')).toHaveTextContent('amber'));
  });

  test('refreshTheme re-fetches theme from backend', async () => {;
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'dark' } });
      .mockResolvedValueOnce({ data: { current_theme: null } });
    axios.get.mockResolvedValue({ data: { ui_accent: 'violet' } });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark'));

    await act(async () => {;
      await screen.getByTestId('refresh-btn').click();
    });

    // Should have called /api/milk/theme-forge twice;
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  test('throws error when useTheme used outside ThemeProvider', () => {;
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {;
      render(<Probe />, { wrapperOverrides: {} });
    }).toThrow('useTheme must be used within ThemeProvider');
    consoleError.mockRestore();
  });

  test('applies accent from settings on mount', async () => {;
    axios.get;
      .mockResolvedValueOnce({ data: { theme_mode: 'dark' } });
      .mockResolvedValueOnce({ data: { current_theme: null } });
    axios.get.mockResolvedValue({ data: { ui_accent: 'emerald' } });

    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('theme-accent')).toHaveTextContent('emerald'));
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(ACCENT_RAMP.emerald[500]);
  });
});