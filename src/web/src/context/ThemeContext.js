import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

// Default theme values
const DEFAULT_DARK_THEME = {
  primary: '#8B5CF6',
  primaryHover: '#7C3AED',
  secondary: '#EC4899',
  secondaryHover: '#DB2777',
  background: '#0A0A0A',
  surface: '#121212',
  surfaceHighlight: '#1E1E1E',
  textPrimary: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#71717A',
  border: '#27272A',
  borderHover: '#3F3F46',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  accent: '#EC4899',
};

const DEFAULT_LIGHT_THEME = {
  primary: '#7C3AED',
  primaryHover: '#6D28D9',
  secondary: '#DB2777',
  secondaryHover: '#BE185D',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceHighlight: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderHover: '#D1D5DB',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
  accent: '#DB2777',
};

// OOBE accent choices → full Tailwind-compatible color ramps. The id a user
// picks in the first-run wizard (persisted as `ui_accent`) drives the --ac-*
// variables, which the remapped violet-*/purple-* Tailwind classes consume —
// so the chosen accent carries across the entire dashboard.
export const ACCENT_RAMP = {
  violet:  { 100: '#EDE9FE', 300: '#C4B5FD', 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9', 900: '#4C1D95' },
  amber:   { 100: '#FEF3C7', 300: '#FCD34D', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309', 900: '#78350F' },
  crimson: { 100: '#FFE4E6', 300: '#FDA4AF', 400: '#FB7185', 500: '#F43F5E', 600: '#E11D48', 700: '#BE123C', 900: '#881337' },
  emerald: { 100: '#D1FAE5', 300: '#6EE7B7', 400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857', 900: '#064E3B' },
  sky:     { 100: '#E0F2FE', 300: '#7DD3FC', 400: '#38BDF8', 500: '#0EA5E9', 600: '#0284C7', 700: '#0369A1', 900: '#0C4A6E' },
  rose:    { 100: '#FCE7F3', 300: '#F9A8D4', 400: '#F472B6', 500: '#EC4899', 600: '#DB2777', 700: '#BE185D', 900: '#831843' },
};

// Apply ONLY the accent variables on top of the active theme.
const applyAccentToDOM = (accentId) => {
  const r = ACCENT_RAMP[accentId];
  if (!r) return false;
  const root = document.documentElement;
  Object.entries(r).forEach(([shade, hex]) => root.style.setProperty(`--ac-${shade}`, hex));
  root.style.setProperty('--primary', r[500]);
  root.style.setProperty('--primary-hover', r[600]);
  root.style.setProperty('--secondary', r[600]);
  root.style.setProperty('--accent', r[500]);
  root.style.setProperty('--color-primary', r[500]);
  root.style.setProperty('--color-secondary', r[600]);
  root.style.setProperty('--ring', r[500]);
  root.style.setProperty('--toggle-bg-checked', r[500]);
  root.style.setProperty('--wn-accent', r[500]);
  return true;
};

// Apply theme to CSS variables - now synced with index.css variable names
const applyThemeToDOM = (colors, mode = 'dark') => {
  const root = document.documentElement;
  
  // Set data-theme attribute for CSS selectors
  root.setAttribute('data-theme', mode);
  
  // Core CSS variables that match index.css
  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--surface', colors.surface);
  root.style.setProperty('--surface-highlight', colors.surfaceHighlight || colors.surface_highlight || '#1E1E1E');
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-foreground', mode === 'dark' ? '#FFFFFF' : '#FFFFFF');
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--accent', colors.accent || colors.secondary);
  root.style.setProperty('--text-primary', colors.textPrimary || colors.text_primary);
  root.style.setProperty('--text-secondary', colors.textSecondary || colors.text_secondary);
  root.style.setProperty('--border-color', colors.border);
  root.style.setProperty('--success', colors.success);
  root.style.setProperty('--warning', colors.warning);
  root.style.setProperty('--error', colors.error);
  
  // Additional theme variables for components
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-secondary', colors.secondary);
  root.style.setProperty('--color-background', colors.background);
  root.style.setProperty('--color-surface', colors.surface);
  root.style.setProperty('--color-text-primary', colors.textPrimary || colors.text_primary);
  root.style.setProperty('--color-text-secondary', colors.textSecondary || colors.text_secondary);
  root.style.setProperty('--color-border', colors.border);
  
  // Toggle-specific variables for better visibility
  const toggleBg = mode === 'dark' ? '#3F3F46' : '#D1D5DB';
  const toggleBgChecked = colors.primary;
  root.style.setProperty('--toggle-bg', toggleBg);
  root.style.setProperty('--toggle-bg-checked', toggleBgChecked);
  root.style.setProperty('--toggle-thumb', '#FFFFFF');
  
  // Update body
  document.body.style.backgroundColor = colors.background;
  document.body.style.color = colors.textPrimary || colors.text_primary;
  
  // Add/remove light mode class
  if (mode === 'light') {
    document.body.classList.add('light-mode');
    document.body.classList.remove('dark-mode');
  } else {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(null);
  const [themeType, setThemeType] = useState('default');
  const [mode, setMode] = useState('dark'); // Default, will be updated from backend
  const [loading, setLoading] = useState(true);
  const [modeLoaded, setModeLoaded] = useState(false);
  const [accentId, setAccentId] = useState(null);
  const { isAuthenticated } = useAuth();

  // Read the user's OOBE accent choice (ui_accent setting) and apply it.
  // Only used as the default accent when no full custom theme is active.
  const applyAccentFromSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/settings`);
      const id = res.data?.ui_accent;
      if (id && applyAccentToDOM(id)) setAccentId(id);
    } catch { /* not logged in / no setting — keep theme defaults */ }
  }, []);

  // Set a new accent live and persist it to the backend.
  const applyAccent = useCallback(async (id) => {
    if (!applyAccentToDOM(id)) return false;
    setAccentId(id);
    try { await axios.put(`${BACKEND_URL}/api/settings`, { ui_accent: id }); } catch { /* */ }
    return true;
  }, []);

  // Load theme mode from backend on mount
  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        // Cookie auth: the httpOnly wn_token is sent automatically.
        const response = await axios.get(`${BACKEND_URL}/api/user/preferences`);
        if (response.data.theme_mode) {
          setMode(response.data.theme_mode);
        } else {
          const saved = localStorage.getItem('watchnexus_theme_mode');
          if (saved) setMode(saved);
        }
      } catch (error) {
        // Fall back to localStorage
        const saved = localStorage.getItem('watchnexus_theme_mode');
        if (saved) setMode(saved);
      } finally {
        setModeLoaded(true);
      }
    };
    loadThemeMode();
  }, []);

  // Fetch current theme from backend
  const fetchTheme = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/milk/theme-forge`);
      const data = res.data;
      
      if (data.current_theme) {
        setTheme(data.current_theme);
        setThemeType(data.current_theme.type || 'custom');
        if (data.current_theme.colors) {
          applyThemeToDOM(data.current_theme.colors, mode);
        }
      } else {
        applyThemeToDOM(mode === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME, mode);
      }
    } catch (err) {
      console.log('Using default theme');
      applyThemeToDOM(mode === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME, mode);
    }
    // Always layer the user's chosen OOBE accent on top of whatever theme loaded.
    await applyAccentFromSettings();
    setLoading(false);
  }, [mode, applyAccentFromSettings]);

  // Toggle between light and dark mode
  const toggleMode = useCallback(async () => {
    const newMode = mode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
    
    // Save to backend (cookie auth)
    try {
      await axios.put(`${BACKEND_URL}/api/user/preferences`, null, {
        params: { theme_mode: newMode }
      });
    } catch (error) {
      console.error('Failed to save theme mode:', error);
    }
    
    // Also save to localStorage for backwards compatibility
    localStorage.setItem('watchnexus_theme_mode', newMode);
    
    // Apply current theme colors with new mode
    if (theme?.colors) {
      // Adjust colors for mode
      const adjustedColors = {
        ...theme.colors,
        background: newMode === 'dark' ? (theme.colors.background || DEFAULT_DARK_THEME.background) : DEFAULT_LIGHT_THEME.background,
        surface: newMode === 'dark' ? (theme.colors.surface || DEFAULT_DARK_THEME.surface) : DEFAULT_LIGHT_THEME.surface,
        textPrimary: newMode === 'dark' ? '#F3F4F6' : '#111827',
        textSecondary: newMode === 'dark' ? '#9CA3AF' : '#4B5563',
        border: newMode === 'dark' ? '#27272A' : '#E5E7EB',
      };
      applyThemeToDOM(adjustedColors, newMode);
    } else {
      applyThemeToDOM(newMode === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME, newMode);
    }
  }, [mode, theme]);

  // Apply a built-in theme
  const applyBuiltInTheme = useCallback(async (type) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/milk/set-theme?theme_type=${type}`);
      if (res.data && res.data.theme) {
        setTheme(res.data.theme);
        setThemeType(type);
        if (res.data.theme.colors) {
          applyThemeToDOM(res.data.theme.colors, mode);
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to apply theme:', err);
      return false;
    }
  }, [mode]);

  // Apply custom colors
  const applyCustomColors = useCallback(async (colors) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/milk/custom-theme`, {
        name: 'Custom Theme',
        type: 'custom',
        colors
      });
      if (res.data && res.data.theme) {
        setTheme({ ...res.data.theme, colors });
        setThemeType('custom');
        applyThemeToDOM(colors, mode);
      }
      return true;
    } catch (err) {
      console.error('Failed to apply custom theme:', err);
      return false;
    }
  }, [mode]);

  // Preview colors without saving
  const previewColors = useCallback((colors) => {
    applyThemeToDOM(colors, mode);
  }, [mode]);

  // Reset to saved theme
  const resetToSaved = useCallback(() => {
    if (theme?.colors) {
      applyThemeToDOM(theme.colors, mode);
    } else {
      applyThemeToDOM(mode === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME, mode);
    }
  }, [theme, mode]);

  useEffect(() => {
    // Only fetch theme after mode is loaded from backend
    if (modeLoaded) {
      fetchTheme();
    }
  }, [fetchTheme, modeLoaded]);

  // ui_accent is a per-user setting — (re)apply it once the user is authenticated.
  useEffect(() => {
    if (isAuthenticated) applyAccentFromSettings();
  }, [isAuthenticated, applyAccentFromSettings]);

  const value = useMemo(() => ({
    theme,
    themeType,
    mode,
    loading,
    toggleMode,
    applyBuiltInTheme,
    applyCustomColors,
    previewColors,
    resetToSaved,
    refreshTheme: fetchTheme,
    accentId,
    applyAccent,
    DEFAULT_DARK_THEME,
    DEFAULT_LIGHT_THEME
  }), [theme, themeType, mode, loading, toggleMode, applyBuiltInTheme, applyCustomColors, previewColors, resetToSaved, fetchTheme, accentId, applyAccent]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
