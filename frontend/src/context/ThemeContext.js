import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

const ThemeContext = createContext();

// Default theme values
const DEFAULT_THEME = {
  primary: '#8B5CF6',
  primaryHover: '#7C3AED',
  secondary: '#EC4899',
  secondaryHover: '#DB2777',
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceHover: '#252525',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  border: 'rgba(255,255,255,0.1)',
  borderHover: 'rgba(255,255,255,0.2)',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  gradientStart: '#8B5CF6',
  gradientEnd: '#EC4899',
};

// Apply theme to CSS variables
const applyThemeToDOM = (colors) => {
  const root = document.documentElement;
  
  // Convert camelCase keys to CSS var format
  const cssVars = {
    '--color-primary': colors.primary || DEFAULT_THEME.primary,
    '--color-primary-hover': colors.primary_hover || colors.primaryHover || DEFAULT_THEME.primaryHover,
    '--color-secondary': colors.secondary || DEFAULT_THEME.secondary,
    '--color-secondary-hover': colors.secondary_hover || colors.secondaryHover || DEFAULT_THEME.secondaryHover,
    '--color-background': colors.background || DEFAULT_THEME.background,
    '--color-surface': colors.surface || DEFAULT_THEME.surface,
    '--color-surface-hover': colors.surface_hover || colors.surfaceHover || DEFAULT_THEME.surfaceHover,
    '--color-text-primary': colors.text_primary || colors.textPrimary || DEFAULT_THEME.textPrimary,
    '--color-text-secondary': colors.text_secondary || colors.textSecondary || DEFAULT_THEME.textSecondary,
    '--color-text-muted': colors.text_muted || colors.textMuted || DEFAULT_THEME.textMuted,
    '--color-border': colors.border || DEFAULT_THEME.border,
    '--color-border-hover': colors.border_hover || colors.borderHover || DEFAULT_THEME.borderHover,
    '--color-success': colors.success || DEFAULT_THEME.success,
    '--color-warning': colors.warning || DEFAULT_THEME.warning,
    '--color-error': colors.error || DEFAULT_THEME.error,
    '--color-info': colors.info || DEFAULT_THEME.info,
    '--gradient-start': colors.gradient_start || colors.gradientStart || DEFAULT_THEME.gradientStart,
    '--gradient-end': colors.gradient_end || colors.gradientEnd || DEFAULT_THEME.gradientEnd,
  };
  
  // Apply to :root
  Object.entries(cssVars).forEach(([key, value]) => {
    if (value) {
      root.style.setProperty(key, value);
    }
  });
  
  // Also update body background
  document.body.style.backgroundColor = colors.background || DEFAULT_THEME.background;
  document.body.style.color = colors.text_primary || colors.textPrimary || DEFAULT_THEME.textPrimary;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(null);
  const [themeType, setThemeType] = useState('default');
  const [loading, setLoading] = useState(true);

  // Fetch current theme from backend
  const fetchTheme = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/milk/theme-forge`);
      const data = res.data;
      
      if (data.current_theme) {
        setTheme(data.current_theme);
        setThemeType(data.current_theme.type || 'custom');
        
        if (data.current_theme.colors) {
          applyThemeToDOM(data.current_theme.colors);
        }
      }
    } catch (err) {
      console.log('Using default theme');
      applyThemeToDOM(DEFAULT_THEME);
    } finally {
      setLoading(false);
    }
  }, []);

  // Apply a built-in theme
  const applyBuiltInTheme = useCallback(async (type) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/milk/set-theme?theme_type=${type}`);
      if (res.data) {
        setTheme(res.data);
        setThemeType(type);
        if (res.data.colors) {
          applyThemeToDOM(res.data.colors);
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to apply theme:', err);
      return false;
    }
  }, []);

  // Apply custom colors
  const applyCustomColors = useCallback(async (colors) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/milk/custom-theme`, {
        name: 'Custom Theme',
        type: 'custom',
        colors
      });
      if (res.data) {
        setTheme({ ...res.data, colors });
        setThemeType('custom');
        applyThemeToDOM(colors);
      }
      return true;
    } catch (err) {
      console.error('Failed to apply custom theme:', err);
      return false;
    }
  }, []);

  // Preview colors without saving
  const previewColors = useCallback((colors) => {
    applyThemeToDOM(colors);
  }, []);

  // Reset to saved theme
  const resetToSaved = useCallback(() => {
    if (theme?.colors) {
      applyThemeToDOM(theme.colors);
    } else {
      applyThemeToDOM(DEFAULT_THEME);
    }
  }, [theme]);

  useEffect(() => {
    fetchTheme();
  }, [fetchTheme]);

  return (
    <ThemeContext.Provider value={{
      theme,
      themeType,
      loading,
      applyBuiltInTheme,
      applyCustomColors,
      previewColors,
      resetToSaved,
      refreshTheme: fetchTheme,
      DEFAULT_THEME
    }}>
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
