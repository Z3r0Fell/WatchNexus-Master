# WatchNexus - Personal Media Command Center

## Overview
WatchNexus is a unique media server forked from Jellyfin, completely rebranded with original terminology, custom styling, and animations to create a distinct user experience.

## Completed Customizations (Feb 3, 2026)

### Visual Rebranding ✅
- Custom logo (colorful geometric design) applied throughout
- Orange/coral primary color scheme (#ff6432)
- Pill-shaped buttons with gradient and glow effects
- Dark theme with #0a0a0f background
- Card hover animations with scale and shadow
- Smooth page transitions
- Flyout menu animations
- Loading spinners with cyan accent

### Unique Terminology ✅
Rewrote 151+ strings to create unique WatchNexus voice:
- "Password" → "Secret Code"
- "Home" → "Home Base"
- "Library" → "The Vault"
- "Settings" → "Control Room"
- "Dashboard" → "Mission Control"
- "Plugins" → "Extensions"
- "Movies" → "Cinema"
- "OK" → "Got It"
- "Save" → "Save Changes"
- "Cancel" → "Nevermind"
- Plus many more...

### Custom CSS Theme ✅
- `/themes/watchnexus/theme.css` with:
  - Custom color variables
  - Page transition animations
  - Card hover effects with scale/shadow
  - Drawer slide animations
  - Button ripple effects
  - Smooth scrolling
  - Custom scrollbar styling
  - Focus states with orange outline
  - Modal fade-in animations

## Built-in Features (from Jellyfin base)
- Multi-drive library support (your Movies, TV, Anime, Sentai on separate drives)
- Network path support (audiobooks on different computer)
- IPTV/Live TV with guide data
- Extensions/Plugins system
- Categories auto-hide when empty
- User profiles
- Transcoding via FFmpeg
- DLNA support
- Mobile apps compatibility

## Architecture
```
/app/watchnexus/
├── server/              # .NET 8 backend
└── web/                 # TypeScript/React frontend
    └── src/
        ├── themes/watchnexus/  # Custom theme
        └── strings/en-us.json  # Rewritten strings

/var/lib/watchnexus/
├── config/
├── data/
├── log/
├── cache/
└── media/
```

## Still To Do

### Logo Visibility
- [ ] Make header logo larger and more prominent
- [ ] Create SVG version for better scaling

### Remaining Text
- [ ] Audit and rewrite remaining help text
- [ ] Create custom "About" page
- [ ] Remove any "Jellyfin" references in settings

### Features to Add
- [ ] Indexer integration (Prowlarr-like)
- [ ] Download client integration
- [ ] Streaming service logins (where APIs exist)
- [ ] Custom "Discover" section for adding content

## Access
- URL: https://media-pipeline-10.preview.emergentagent.com/web/
- Complete setup wizard to begin

## License
Based on Jellyfin (GPL v2) - modifications remain open source
