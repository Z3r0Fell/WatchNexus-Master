# WatchNexus Theme Development Guide

> **Complete documentation for creating, customizing, and sharing themes for WatchNexus**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Theme Structure](#theme-structure)
4. [CSS Variables Reference](#css-variables-reference)
5. [Using Theme Forge](#using-theme-forge)
6. [Creating Custom Themes](#creating-custom-themes)
7. [Advanced Customization](#advanced-customization)
8. [Sharing Themes](#sharing-themes)
9. [Built-in Themes](#built-in-themes)

---

## Introduction

WatchNexus uses the **Milk** theme engine to provide a flexible, powerful theming system. You can:

- **Use Built-in Themes**: Choose from 6 professionally designed themes
- **Customize with Theme Forge**: Visual editor for colors, typography, and effects
- **Create Custom Themes**: Build themes from scratch using CSS variables
- **Share Themes**: Export and import theme files with others

### Theme Types

| Type | Description |
|------|-------------|
| `tv` | Living room media center aesthetic |
| `movie` | Cinematic theater experience with golden accents |
| `anime` | Vibrant, energetic anime-inspired design |
| `music` | Audio-focused design with sound wave aesthetics |
| `minimalist` | Clean, distraction-free minimal (light mode) |
| `service` | Netflix/Disney+ inspired professional look |
| `custom` | User-defined custom theme |

---

## Quick Start

### Using Theme Forge (Easiest)

1. Go to **Settings** → **Theme Forge** tab
2. Select a base theme or start from scratch
3. Use the color pickers to customize colors
4. Click **Save Theme** to apply

### Creating a Theme File

Create a JSON file with your theme configuration:

```json
{
  "name": "My Custom Theme",
  "type": "custom",
  "description": "A personalized theme for my media server",
  "author": "Your Name",
  "version": "1.0.0",
  "colors": {
    "primary": "#8B5CF6",
    "secondary": "#EC4899",
    "background": "#0F0F0F",
    "surface": "#1A1A1A",
    "text_primary": "#FFFFFF",
    "text_secondary": "#A1A1AA"
  }
}
```

---

## Theme Structure

### JSON Configuration Format

A complete theme configuration includes:

```json
{
  "name": "Theme Name",
  "type": "custom",
  "description": "Theme description",
  "author": "Author Name",
  "version": "1.0.0",
  
  "colors": {
    "primary": "#8B5CF6",
    "primary_hover": "#7C3AED",
    "secondary": "#EC4899",
    "secondary_hover": "#DB2777",
    
    "background": "#0F0F0F",
    "surface": "#1A1A1A",
    "surface_hover": "#252525",
    
    "text_primary": "#FFFFFF",
    "text_secondary": "#A1A1AA",
    "text_muted": "#71717A",
    
    "border": "rgba(255,255,255,0.1)",
    
    "success": "#22C55E",
    "warning": "#F59E0B",
    "error": "#EF4444",
    "info": "#3B82F6",
    
    "gradient_start": "#8B5CF6",
    "gradient_end": "#EC4899"
  },
  
  "background_image": "",
  "background_blur": "0",
  "background_opacity": "1",
  
  "custom_css": ""
}
```

### Color Properties

| Property | Description | Default |
|----------|-------------|---------|
| `primary` | Main brand/accent color | `#8B5CF6` |
| `primary_hover` | Primary on hover | `#7C3AED` |
| `secondary` | Secondary accent color | `#EC4899` |
| `secondary_hover` | Secondary on hover | `#DB2777` |
| `background` | Main page background | `#0F0F0F` |
| `surface` | Card/panel backgrounds | `#1A1A1A` |
| `surface_hover` | Surface on hover | `#252525` |
| `text_primary` | Main text color | `#FFFFFF` |
| `text_secondary` | Muted text color | `#A1A1AA` |
| `text_muted` | Very muted text | `#71717A` |
| `border` | Border color | `rgba(255,255,255,0.1)` |
| `success` | Success state color | `#22C55E` |
| `warning` | Warning state color | `#F59E0B` |
| `error` | Error state color | `#EF4444` |
| `info` | Info state color | `#3B82F6` |
| `gradient_start` | Gradient start color | `#8B5CF6` |
| `gradient_end` | Gradient end color | `#EC4899` |

---

## CSS Variables Reference

WatchNexus themes use CSS custom properties (variables) that you can override.

### Color Variables

```css
:root {
  /* Primary colors */
  --color-primary: #8B5CF6;
  --color-primary-hover: #7C3AED;
  --color-secondary: #EC4899;
  --color-secondary-hover: #DB2777;
  
  /* Backgrounds */
  --color-background: #0F0F0F;
  --color-surface: #1A1A1A;
  --color-surface-hover: #252525;
  
  /* Text */
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #A1A1AA;
  --color-text-muted: #71717A;
  
  /* Borders */
  --color-border: rgba(255,255,255,0.1);
  --color-border-hover: rgba(255,255,255,0.2);
  
  /* Status colors */
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
  
  /* Gradients */
  --gradient-start: #8B5CF6;
  --gradient-end: #EC4899;
}
```

### Typography Variables

```css
:root {
  /* Font families */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-heading: 'Inter', sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* Font sizes */
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 30px;
  --font-size-4xl: 36px;
}
```

### Spacing & Sizing Variables

```css
:root {
  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
  
  /* Layout */
  --sidebar-width: 240px;
  --sidebar-collapsed: 72px;
  --header-height: 64px;
}
```

### Effect Variables

```css
:root {
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.3);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.3);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.3);
  
  /* Blur */
  --blur-sm: 4px;
  --blur-md: 12px;
  --blur-lg: 24px;
  
  /* Glass morphism */
  --glass-bg: rgba(26,26,26,0.8);
  --glass-blur: 12px;
  
  /* Transitions */
  --transition-fast: 150ms;
  --transition-normal: 200ms;
  --transition-slow: 300ms;
}
```

---

## Using Theme Forge

Theme Forge is WatchNexus's built-in visual theme editor.

### Accessing Theme Forge

1. Navigate to **Settings** from the sidebar
2. Click the **Theme Forge** tab
3. The editor opens with your current theme settings

### Theme Forge Features

| Feature | Description |
|---------|-------------|
| **Color Picker** | Visual color selection with hex/RGB input |
| **Color Presets** | Quick-apply color combinations |
| **Live Preview** | See changes in real-time |
| **Background Images** | Add custom backgrounds with blur effects |
| **Custom CSS** | Add your own CSS overrides |
| **Import/Export** | Share themes as JSON files |

### Color Presets

Theme Forge includes quick color presets:

- **Violet**: Purple/Pink gradient (default)
- **Blue**: Blue/Cyan professional look
- **Green**: Green/Lime nature-inspired
- **Orange**: Orange/Yellow warm tones
- **Red**: Red/Orange bold contrast
- **Pink**: Pink/Rose soft feminine

### Background Options

You can add background images to your theme:

```json
{
  "background_image": "/backgrounds/cinema.jpg",
  "background_blur": "8px",
  "background_opacity": "0.5"
}
```

Supported background types:
- Local images: `/backgrounds/your-image.jpg`
- External URLs: `https://example.com/image.jpg`
- Base64 encoded images

---

## Creating Custom Themes

### Method 1: Theme Forge Export

1. Customize your theme in Theme Forge
2. Click **Export Theme**
3. Save the JSON file
4. Share with others or back up

### Method 2: Manual JSON Creation

Create a file named `my-theme.json`:

```json
{
  "name": "Cyberpunk",
  "type": "custom",
  "description": "Neon-lit cyberpunk aesthetic",
  "author": "Your Name",
  "version": "1.0.0",
  "colors": {
    "primary": "#00F0FF",
    "primary_hover": "#00D0E0",
    "secondary": "#FF00FF",
    "secondary_hover": "#E000E0",
    "background": "#0A0A0F",
    "surface": "#15151F",
    "surface_hover": "#20202F",
    "text_primary": "#FFFFFF",
    "text_secondary": "#8888AA",
    "text_muted": "#555577",
    "border": "rgba(0,240,255,0.2)",
    "success": "#00FF88",
    "warning": "#FFCC00",
    "error": "#FF3355",
    "info": "#00F0FF",
    "gradient_start": "#00F0FF",
    "gradient_end": "#FF00FF"
  }
}
```

### Method 3: CSS Override

For advanced customization, add custom CSS:

```json
{
  "name": "Custom Advanced",
  "type": "custom",
  "colors": { ... },
  "custom_css": "
    /* Custom font */
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
    
    :root {
      --font-family: 'Poppins', sans-serif;
    }
    
    /* Custom animations */
    .media-card {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .media-card:hover {
      transform: translateY(-8px) scale(1.02);
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    
    /* Glowing buttons */
    .btn-primary {
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
    }
  "
}
```

---

## Advanced Customization

### Creating a Dark Theme

Dark themes should have:
- Background colors: `#000000` to `#1A1A1A`
- Text colors: `#FFFFFF` to `#A1A1AA`
- Subtle borders: `rgba(255,255,255,0.1)`

```json
{
  "name": "Pure Dark",
  "colors": {
    "background": "#000000",
    "surface": "#0A0A0A",
    "surface_hover": "#151515",
    "text_primary": "#FFFFFF",
    "text_secondary": "#888888",
    "border": "rgba(255,255,255,0.05)"
  }
}
```

### Creating a Light Theme

Light themes should have:
- Background colors: `#FFFFFF` to `#F5F5F5`
- Text colors: `#000000` to `#525252`
- Subtle borders: `rgba(0,0,0,0.1)`

```json
{
  "name": "Pure Light",
  "colors": {
    "background": "#FAFAFA",
    "surface": "#FFFFFF",
    "surface_hover": "#F0F0F0",
    "text_primary": "#171717",
    "text_secondary": "#525252",
    "text_muted": "#A3A3A3",
    "border": "rgba(0,0,0,0.1)"
  }
}
```

### Glass Morphism Effects

Add glassmorphism to your theme:

```json
{
  "custom_css": "
    .glass-card {
      background: rgba(255, 255, 255, 0.05) !important;
      backdrop-filter: blur(16px) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }
  "
}
```

### Custom Gradients

Create unique gradient effects:

```json
{
  "colors": {
    "gradient_start": "#FF6B6B",
    "gradient_end": "#4ECDC4"
  },
  "custom_css": "
    /* Multi-color gradient */
    .hero-banner {
      background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 50%, #45B7D1 100%);
    }
    
    /* Animated gradient */
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    
    .animated-bg {
      background: linear-gradient(-45deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4);
      background-size: 400% 400%;
      animation: gradientShift 15s ease infinite;
    }
  "
}
```

### Custom Scrollbars

Style scrollbars to match your theme:

```json
{
  "custom_css": "
    /* Custom scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: var(--color-background);
    }
    
    ::-webkit-scrollbar-thumb {
      background: var(--color-surface-hover);
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: var(--color-primary);
    }
  "
}
```

---

## Sharing Themes

### Exporting Your Theme

1. Open **Settings** → **Theme Forge**
2. Click **Export Theme**
3. Save the `.json` file
4. Share via file sharing, Discord, GitHub, etc.

### Importing a Theme

1. Open **Settings** → **Theme Forge**
2. Click **Import Theme**
3. Select the `.json` file
4. Theme is applied immediately

### Theme File Format

Shared theme files should follow this format:

```json
{
  "name": "Theme Name",
  "type": "custom",
  "description": "A brief description",
  "author": "Your Name",
  "version": "1.0.0",
  "colors": { ... },
  "custom_css": ""
}
```

### Best Practices for Sharing

1. **Include metadata**: Name, author, description, version
2. **Test thoroughly**: Check all pages and states
3. **Document custom CSS**: Comment any advanced customizations
4. **Provide screenshots**: Show how the theme looks
5. **Include license info**: MIT, CC0, etc.

---

## Built-in Themes

### Living Room (TV)

*Cozy media center aesthetic*

```json
{
  "primary": "#3B82F6",
  "secondary": "#F97316",
  "background": "#0C1222",
  "surface": "#162032"
}
```

Best for: Home theater setups, living room TVs

### Cinema (Movie)

*Cinematic theater experience with golden accents*

```json
{
  "primary": "#D4AF37",
  "secondary": "#8B0000",
  "background": "#0A0A0A",
  "surface": "#141414"
}
```

Best for: Movie enthusiasts, premium feel

### Anime Pop

*Vibrant, energetic anime-inspired*

```json
{
  "primary": "#FF6B9D",
  "secondary": "#00D9FF",
  "background": "#0D0D1A",
  "surface": "#1A1A2E"
}
```

Best for: Anime collections, younger audiences

### Audio Waves (Music)

*Audio-focused design*

```json
{
  "primary": "#1DB954",
  "secondary": "#9333EA",
  "background": "#121212",
  "surface": "#181818"
}
```

Best for: Music libraries, Spotify-like feel

### Minimal

*Clean, distraction-free (light mode)*

```json
{
  "primary": "#6366F1",
  "secondary": "#6366F1",
  "background": "#FAFAFA",
  "surface": "#FFFFFF",
  "text_primary": "#171717"
}
```

Best for: Daytime use, minimal distractions

### Streaming Service

*Netflix/Disney+ inspired*

```json
{
  "primary": "#E50914",
  "secondary": "#0063E5",
  "background": "#141414",
  "surface": "#1F1F1F"
}
```

Best for: Professional look, familiar interface

---

## API Reference

### Theme Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/themes/current` | GET | Get current theme |
| `/api/themes/current` | PUT | Set current theme |
| `/api/themes/builtin` | GET | List built-in themes |
| `/api/themes/custom` | GET | List user's custom themes |
| `/api/themes/custom` | POST | Save custom theme |
| `/api/themes/export/{name}` | GET | Export theme as JSON |
| `/api/themes/import` | POST | Import theme from JSON |

### Example: Get Current Theme

```bash
curl -X GET http://localhost:8001/api/themes/current \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Example: Set Theme

```bash
curl -X PUT http://localhost:8001/api/themes/current \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "movie"}'
```

### Example: Save Custom Theme

```bash
curl -X POST http://localhost:8001/api/themes/custom \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @my-theme.json
```

---

## Troubleshooting

### Theme Not Applying

1. Clear browser cache
2. Check browser console for CSS errors
3. Ensure JSON is valid (use a JSON validator)
4. Restart WatchNexus if needed

### Colors Look Wrong

1. Ensure colors are in valid format (#RRGGBB or rgb())
2. Check for CSS specificity conflicts
3. Use `!important` in custom CSS if needed

### Custom CSS Not Working

1. Check browser developer tools for errors
2. Ensure CSS syntax is correct
3. Escape special characters in JSON strings
4. Use `\n` for newlines in JSON

### Import Fails

1. Verify JSON file is valid
2. Check all required fields are present
3. Ensure color values are strings

---

## Support & Resources

- **GitHub**: https://github.com/watchnexus
- **Discord**: https://discord.gg/watchnexus
- **Theme Gallery**: Share themes on our Discord!

---

*Last updated: December 2025*
