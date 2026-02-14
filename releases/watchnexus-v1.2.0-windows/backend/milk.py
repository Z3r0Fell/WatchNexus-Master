"""
Milk - WatchNexus Theme Engine
🥛 Smooth, creamy visual customization

Theme Forge: Create and customize themes for WatchNexus

Built-in Themes:
1. TV - Living room media center aesthetic
2. Movie - Cinematic theater experience
3. Anime - Vibrant Japanese animation style
4. Music - Audio-focused visual design
5. Minimalist - Clean, distraction-free
6. Service - Streaming service inspired (Netflix/Disney+)
7. Custom - User-defined with Juice color picker
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum

logger = logging.getLogger(__name__)


class ThemeType(Enum):
    """Built-in theme types."""
    TV = "tv"
    MOVIE = "movie"
    ANIME = "anime"
    MUSIC = "music"
    MINIMALIST = "minimalist"
    SERVICE = "service"
    CUSTOM = "custom"


@dataclass
class ColorPalette:
    """Color palette definition."""
    primary: str = "#8B5CF6"         # Main brand color
    primary_hover: str = "#7C3AED"
    secondary: str = "#EC4899"       # Accent color
    secondary_hover: str = "#DB2777"
    
    background: str = "#0F0F0F"      # Main background
    surface: str = "#1A1A1A"         # Card/surface background
    surface_hover: str = "#252525"
    
    text_primary: str = "#FFFFFF"    # Main text
    text_secondary: str = "#A1A1AA"  # Muted text
    text_muted: str = "#71717A"      # Very muted text
    
    border: str = "rgba(255,255,255,0.1)"
    border_hover: str = "rgba(255,255,255,0.2)"
    
    success: str = "#22C55E"
    warning: str = "#F59E0B"
    error: str = "#EF4444"
    info: str = "#3B82F6"
    
    # Gradients
    gradient_start: str = "#8B5CF6"
    gradient_end: str = "#EC4899"
    
    def to_css_vars(self) -> Dict[str, str]:
        """Convert to CSS custom properties."""
        return {
            "--color-primary": self.primary,
            "--color-primary-hover": self.primary_hover,
            "--color-secondary": self.secondary,
            "--color-secondary-hover": self.secondary_hover,
            "--color-background": self.background,
            "--color-surface": self.surface,
            "--color-surface-hover": self.surface_hover,
            "--color-text-primary": self.text_primary,
            "--color-text-secondary": self.text_secondary,
            "--color-text-muted": self.text_muted,
            "--color-border": self.border,
            "--color-border-hover": self.border_hover,
            "--color-success": self.success,
            "--color-warning": self.warning,
            "--color-error": self.error,
            "--color-info": self.info,
            "--gradient-start": self.gradient_start,
            "--gradient-end": self.gradient_end,
        }


@dataclass
class Typography:
    """Typography settings."""
    font_family: str = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    font_family_heading: str = "'Inter', sans-serif"
    font_family_mono: str = "'JetBrains Mono', 'Fira Code', monospace"
    
    font_size_base: str = "16px"
    font_size_sm: str = "14px"
    font_size_xs: str = "12px"
    font_size_lg: str = "18px"
    font_size_xl: str = "20px"
    font_size_2xl: str = "24px"
    font_size_3xl: str = "30px"
    font_size_4xl: str = "36px"
    
    font_weight_normal: str = "400"
    font_weight_medium: str = "500"
    font_weight_semibold: str = "600"
    font_weight_bold: str = "700"
    
    line_height_normal: str = "1.5"
    line_height_tight: str = "1.25"
    line_height_loose: str = "1.75"
    
    letter_spacing_tight: str = "-0.025em"
    letter_spacing_normal: str = "0"
    letter_spacing_wide: str = "0.025em"
    
    def to_css_vars(self) -> Dict[str, str]:
        """Convert to CSS custom properties."""
        return {
            "--font-family": self.font_family,
            "--font-family-heading": self.font_family_heading,
            "--font-family-mono": self.font_family_mono,
            "--font-size-base": self.font_size_base,
            "--font-size-sm": self.font_size_sm,
            "--font-size-xs": self.font_size_xs,
            "--font-size-lg": self.font_size_lg,
            "--font-size-xl": self.font_size_xl,
            "--font-size-2xl": self.font_size_2xl,
            "--font-size-3xl": self.font_size_3xl,
            "--font-size-4xl": self.font_size_4xl,
        }


@dataclass
class Spacing:
    """Spacing and sizing settings."""
    border_radius_sm: str = "4px"
    border_radius_md: str = "8px"
    border_radius_lg: str = "12px"
    border_radius_xl: str = "16px"
    border_radius_2xl: str = "24px"
    border_radius_full: str = "9999px"
    
    spacing_unit: str = "4px"
    sidebar_width: str = "240px"
    sidebar_collapsed_width: str = "72px"
    header_height: str = "64px"
    
    def to_css_vars(self) -> Dict[str, str]:
        """Convert to CSS custom properties."""
        return {
            "--radius-sm": self.border_radius_sm,
            "--radius-md": self.border_radius_md,
            "--radius-lg": self.border_radius_lg,
            "--radius-xl": self.border_radius_xl,
            "--radius-2xl": self.border_radius_2xl,
            "--radius-full": self.border_radius_full,
            "--sidebar-width": self.sidebar_width,
            "--sidebar-collapsed": self.sidebar_collapsed_width,
            "--header-height": self.header_height,
        }


@dataclass
class Effects:
    """Visual effects settings."""
    shadow_sm: str = "0 1px 2px rgba(0,0,0,0.3)"
    shadow_md: str = "0 4px 6px rgba(0,0,0,0.3)"
    shadow_lg: str = "0 10px 15px rgba(0,0,0,0.3)"
    shadow_xl: str = "0 20px 25px rgba(0,0,0,0.3)"
    
    blur_sm: str = "4px"
    blur_md: str = "12px"
    blur_lg: str = "24px"
    
    glass_background: str = "rgba(26,26,26,0.8)"
    glass_blur: str = "12px"
    
    transition_fast: str = "150ms"
    transition_normal: str = "200ms"
    transition_slow: str = "300ms"
    
    animation_bounce: str = "cubic-bezier(0.68, -0.55, 0.265, 1.55)"
    animation_smooth: str = "cubic-bezier(0.4, 0, 0.2, 1)"
    
    def to_css_vars(self) -> Dict[str, str]:
        """Convert to CSS custom properties."""
        return {
            "--shadow-sm": self.shadow_sm,
            "--shadow-md": self.shadow_md,
            "--shadow-lg": self.shadow_lg,
            "--shadow-xl": self.shadow_xl,
            "--blur-sm": self.blur_sm,
            "--blur-md": self.blur_md,
            "--blur-lg": self.blur_lg,
            "--glass-bg": self.glass_background,
            "--glass-blur": self.glass_blur,
            "--transition-fast": self.transition_fast,
            "--transition-normal": self.transition_normal,
            "--transition-slow": self.transition_slow,
        }


@dataclass
class ThemeConfig:
    """Complete theme configuration."""
    name: str
    type: ThemeType
    description: str = ""
    author: str = "WatchNexus"
    version: str = "1.0.0"
    
    colors: ColorPalette = field(default_factory=ColorPalette)
    typography: Typography = field(default_factory=Typography)
    spacing: Spacing = field(default_factory=Spacing)
    effects: Effects = field(default_factory=Effects)
    
    # Background settings
    background_image: str = ""
    background_blur: str = "0"
    background_opacity: str = "1"
    
    # Custom CSS
    custom_css: str = ""
    
    def to_css(self) -> str:
        """Generate complete CSS for theme."""
        css_vars = {}
        css_vars.update(self.colors.to_css_vars())
        css_vars.update(self.typography.to_css_vars())
        css_vars.update(self.spacing.to_css_vars())
        css_vars.update(self.effects.to_css_vars())
        
        # Build :root declaration
        root_vars = "\n  ".join(f"{k}: {v};" for k, v in css_vars.items())
        
        css = f"""
/* Milk Theme: {self.name} */
/* Generated by WatchNexus Theme Forge */

:root {{
  {root_vars}
}}

/* Background */
body {{
  background-color: var(--color-background);
  color: var(--color-text-primary);
  font-family: var(--font-family);
}}

{f'''
body::before {{
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: url("{self.background_image}");
  background-size: cover;
  background-position: center;
  filter: blur({self.background_blur});
  opacity: {self.background_opacity};
  z-index: -1;
}}
''' if self.background_image else ''}

/* Glass morphism cards */
.glass-card {{
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}}

/* Buttons */
.btn-primary {{
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  color: white;
  border-radius: var(--radius-lg);
  transition: all var(--transition-normal);
}}

.btn-primary:hover {{
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}}

/* Custom overrides */
{self.custom_css}
"""
        return css
    
    def to_dict(self) -> dict:
        """Convert to dictionary for storage/API."""
        return {
            "name": self.name,
            "type": self.type.value,
            "description": self.description,
            "author": self.author,
            "version": self.version,
            "colors": {
                "primary": self.colors.primary,
                "primary_hover": self.colors.primary_hover,
                "secondary": self.colors.secondary,
                "secondary_hover": self.colors.secondary_hover,
                "background": self.colors.background,
                "surface": self.colors.surface,
                "surface_hover": self.colors.surface_hover,
                "text_primary": self.colors.text_primary,
                "text_secondary": self.colors.text_secondary,
                "text_muted": self.colors.text_muted,
                "border": self.colors.border,
                "success": self.colors.success,
                "warning": self.colors.warning,
                "error": self.colors.error,
                "info": self.colors.info,
                "gradient_start": self.colors.gradient_start,
                "gradient_end": self.colors.gradient_end,
            },
            "background_image": self.background_image,
            "background_blur": self.background_blur,
            "background_opacity": self.background_opacity,
            "custom_css": self.custom_css,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "ThemeConfig":
        """Create from dictionary."""
        colors = ColorPalette(
            primary=data.get("colors", {}).get("primary", "#8B5CF6"),
            primary_hover=data.get("colors", {}).get("primary_hover", "#7C3AED"),
            secondary=data.get("colors", {}).get("secondary", "#EC4899"),
            secondary_hover=data.get("colors", {}).get("secondary_hover", "#DB2777"),
            background=data.get("colors", {}).get("background", "#0F0F0F"),
            surface=data.get("colors", {}).get("surface", "#1A1A1A"),
            surface_hover=data.get("colors", {}).get("surface_hover", "#252525"),
            text_primary=data.get("colors", {}).get("text_primary", "#FFFFFF"),
            text_secondary=data.get("colors", {}).get("text_secondary", "#A1A1AA"),
            text_muted=data.get("colors", {}).get("text_muted", "#71717A"),
            border=data.get("colors", {}).get("border", "rgba(255,255,255,0.1)"),
            success=data.get("colors", {}).get("success", "#22C55E"),
            warning=data.get("colors", {}).get("warning", "#F59E0B"),
            error=data.get("colors", {}).get("error", "#EF4444"),
            info=data.get("colors", {}).get("info", "#3B82F6"),
            gradient_start=data.get("colors", {}).get("gradient_start", "#8B5CF6"),
            gradient_end=data.get("colors", {}).get("gradient_end", "#EC4899"),
        )
        
        return cls(
            name=data.get("name", "Custom"),
            type=ThemeType(data.get("type", "custom")),
            description=data.get("description", ""),
            author=data.get("author", "User"),
            version=data.get("version", "1.0.0"),
            colors=colors,
            background_image=data.get("background_image", ""),
            background_blur=data.get("background_blur", "0"),
            background_opacity=data.get("background_opacity", "1"),
            custom_css=data.get("custom_css", ""),
        )


# ============================================================
# Built-in Themes
# ============================================================

BUILT_IN_THEMES: Dict[ThemeType, ThemeConfig] = {
    ThemeType.TV: ThemeConfig(
        name="Living Room",
        type=ThemeType.TV,
        description="Cozy living room media center aesthetic",
        colors=ColorPalette(
            primary="#3B82F6",        # Blue
            primary_hover="#2563EB",
            secondary="#F97316",      # Orange
            secondary_hover="#EA580C",
            background="#0C1222",     # Dark blue-black
            surface="#162032",
            surface_hover="#1E2D47",
            gradient_start="#3B82F6",
            gradient_end="#8B5CF6",
        ),
    ),
    
    ThemeType.MOVIE: ThemeConfig(
        name="Cinema",
        type=ThemeType.MOVIE,
        description="Cinematic theater experience with golden accents",
        colors=ColorPalette(
            primary="#D4AF37",        # Gold
            primary_hover="#C5A028",
            secondary="#8B0000",      # Dark red
            secondary_hover="#6B0000",
            background="#0A0A0A",     # Near black
            surface="#141414",
            surface_hover="#1E1E1E",
            text_secondary="#C4B998",
            gradient_start="#D4AF37",
            gradient_end="#8B0000",
        ),
    ),
    
    ThemeType.ANIME: ThemeConfig(
        name="Anime Pop",
        type=ThemeType.ANIME,
        description="Vibrant, energetic anime-inspired theme",
        colors=ColorPalette(
            primary="#FF6B9D",        # Sakura pink
            primary_hover="#FF5287",
            secondary="#00D9FF",      # Cyan
            secondary_hover="#00B8D9",
            background="#0D0D1A",     # Deep purple-black
            surface="#1A1A2E",
            surface_hover="#252542",
            gradient_start="#FF6B9D",
            gradient_end="#00D9FF",
        ),
    ),
    
    ThemeType.MUSIC: ThemeConfig(
        name="Audio Waves",
        type=ThemeType.MUSIC,
        description="Audio-focused design with sound wave aesthetics",
        colors=ColorPalette(
            primary="#1DB954",        # Spotify green
            primary_hover="#1AA34A",
            secondary="#9333EA",      # Purple
            secondary_hover="#7E22CE",
            background="#121212",
            surface="#181818",
            surface_hover="#282828",
            gradient_start="#1DB954",
            gradient_end="#9333EA",
        ),
    ),
    
    ThemeType.MINIMALIST: ThemeConfig(
        name="Minimal",
        type=ThemeType.MINIMALIST,
        description="Clean, distraction-free minimal design",
        colors=ColorPalette(
            primary="#6366F1",        # Indigo
            primary_hover="#4F46E5",
            secondary="#6366F1",      # Same as primary
            secondary_hover="#4F46E5",
            background="#FAFAFA",     # Light mode!
            surface="#FFFFFF",
            surface_hover="#F5F5F5",
            text_primary="#171717",
            text_secondary="#525252",
            text_muted="#A3A3A3",
            border="rgba(0,0,0,0.1)",
            gradient_start="#6366F1",
            gradient_end="#8B5CF6",
        ),
    ),
    
    ThemeType.SERVICE: ThemeConfig(
        name="Streaming Service",
        type=ThemeType.SERVICE,
        description="Netflix/Disney+ inspired professional look",
        colors=ColorPalette(
            primary="#E50914",        # Netflix red
            primary_hover="#B81D24",
            secondary="#0063E5",      # Disney blue
            secondary_hover="#0050B8",
            background="#141414",
            surface="#1F1F1F",
            surface_hover="#2A2A2A",
            gradient_start="#E50914",
            gradient_end="#831010",
        ),
    ),
}


# ============================================================
# Theme Engine (Milk)
# ============================================================

class MilkEngine:
    """
    Milk - WatchNexus Theme Engine
    
    Manages themes, custom styles, and visual preferences.
    Integrates with Juice color picker for custom themes.
    """
    
    def __init__(self, themes_dir: str = None):
        self.themes_dir = Path(themes_dir or os.environ.get(
            "WATCHNEXUS_THEMES_DIR",
            "/var/lib/watchnexus/themes"
        ))
        self.themes_dir.mkdir(parents=True, exist_ok=True)
        
        self._current_theme: Optional[ThemeConfig] = None
        self._custom_themes: Dict[str, ThemeConfig] = {}
        self._settings_file = self.themes_dir / "theme_settings.json"
        
        # Load saved settings
        self._load_settings()
    
    def _load_settings(self):
        """Load theme settings from file."""
        if self._settings_file.exists():
            try:
                with open(self._settings_file, "r") as f:
                    data = json.load(f)
                
                # Load current theme
                if "current_theme" in data:
                    theme_type = data["current_theme"].get("type")
                    if theme_type == "custom":
                        self._current_theme = ThemeConfig.from_dict(data["current_theme"])
                    else:
                        self._current_theme = BUILT_IN_THEMES.get(ThemeType(theme_type))
                
                # Load custom themes
                for name, theme_data in data.get("custom_themes", {}).items():
                    self._custom_themes[name] = ThemeConfig.from_dict(theme_data)
                    
            except Exception as e:
                logger.error(f"Failed to load theme settings: {e}")
                self._current_theme = BUILT_IN_THEMES[ThemeType.TV]
        else:
            # Default to TV theme
            self._current_theme = BUILT_IN_THEMES[ThemeType.TV]
    
    def _save_settings(self):
        """Save theme settings to file."""
        try:
            data = {
                "current_theme": self._current_theme.to_dict() if self._current_theme else None,
                "custom_themes": {
                    name: theme.to_dict() 
                    for name, theme in self._custom_themes.items()
                }
            }
            
            with open(self._settings_file, "w") as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            logger.error(f"Failed to save theme settings: {e}")
    
    def get_current_theme(self) -> Optional[ThemeConfig]:
        """Get the current active theme."""
        return self._current_theme
    
    def get_current_css(self) -> str:
        """Get CSS for current theme."""
        if self._current_theme:
            return self._current_theme.to_css()
        return ""
    
    def set_theme(self, theme_type: ThemeType) -> ThemeConfig:
        """
        Set the active theme by type.
        
        Args:
            theme_type: Built-in theme type
        
        Returns:
            Active theme configuration
        """
        if theme_type in BUILT_IN_THEMES:
            self._current_theme = BUILT_IN_THEMES[theme_type]
        else:
            # Check custom themes
            for theme in self._custom_themes.values():
                if theme.type == theme_type:
                    self._current_theme = theme
                    break
        
        self._save_settings()
        return self._current_theme
    
    def set_custom_theme(self, config: ThemeConfig) -> ThemeConfig:
        """
        Set a custom theme configuration.
        
        Args:
            config: Custom theme configuration
        
        Returns:
            Active theme configuration
        """
        config.type = ThemeType.CUSTOM
        self._current_theme = config
        self._custom_themes[config.name] = config
        self._save_settings()
        return self._current_theme
    
    def get_built_in_themes(self) -> List[dict]:
        """Get list of built-in themes."""
        return [
            {
                "type": theme_type.value,
                "name": theme.name,
                "description": theme.description,
                "preview_colors": {
                    "primary": theme.colors.primary,
                    "secondary": theme.colors.secondary,
                    "background": theme.colors.background,
                }
            }
            for theme_type, theme in BUILT_IN_THEMES.items()
        ]
    
    def get_custom_themes(self) -> List[dict]:
        """Get list of user's custom themes."""
        return [theme.to_dict() for theme in self._custom_themes.values()]
    
    def delete_custom_theme(self, name: str) -> bool:
        """Delete a custom theme."""
        if name in self._custom_themes:
            del self._custom_themes[name]
            self._save_settings()
            return True
        return False
    
    def export_theme(self, name: str) -> Optional[str]:
        """Export a theme as JSON string."""
        theme = self._custom_themes.get(name)
        if theme:
            return json.dumps(theme.to_dict(), indent=2)
        return None
    
    def import_theme(self, json_data: str) -> Optional[ThemeConfig]:
        """Import a theme from JSON string."""
        try:
            data = json.loads(json_data)
            theme = ThemeConfig.from_dict(data)
            theme.type = ThemeType.CUSTOM
            self._custom_themes[theme.name] = theme
            self._save_settings()
            return theme
        except Exception as e:
            logger.error(f"Failed to import theme: {e}")
            return None
    
    def get_theme_forge_config(self) -> dict:
        """
        Get configuration for Theme Forge UI.
        Returns all settings needed to render the theme editor.
        """
        return {
            "current_theme": self._current_theme.to_dict() if self._current_theme else None,
            "built_in_themes": self.get_built_in_themes(),
            "custom_themes": self.get_custom_themes(),
            "color_presets": [
                {"name": "Violet", "primary": "#8B5CF6", "secondary": "#EC4899"},
                {"name": "Blue", "primary": "#3B82F6", "secondary": "#06B6D4"},
                {"name": "Green", "primary": "#22C55E", "secondary": "#84CC16"},
                {"name": "Orange", "primary": "#F97316", "secondary": "#FBBF24"},
                {"name": "Red", "primary": "#EF4444", "secondary": "#F97316"},
                {"name": "Pink", "primary": "#EC4899", "secondary": "#F472B6"},
            ],
            "background_presets": [
                {"name": "None", "url": "", "blur": "0"},
                {"name": "Gradient Dark", "url": "", "blur": "0"},
                {"name": "Cinema", "url": "/backgrounds/cinema.jpg", "blur": "8px"},
                {"name": "Abstract", "url": "/backgrounds/abstract.jpg", "blur": "12px"},
            ],
        }


# Singleton instance
_milk_engine: Optional[MilkEngine] = None


def get_milk_engine() -> MilkEngine:
    """Get or create the Milk theme engine instance."""
    global _milk_engine
    if _milk_engine is None:
        _milk_engine = MilkEngine()
    return _milk_engine
