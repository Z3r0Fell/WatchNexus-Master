# WatchNexus - Separated Repositories

This folder contains all WatchNexus components separated for individual Git repositories.

## Repository Structure

```
separated/
├── server/              → watchnexus-server
├── web/                 → watchnexus-web  
├── clients/
│   ├── ruby-androidtv/  → watchnexus-ruby
│   ├── sapphire-android/→ watchnexus-sapphire
│   ├── ember-firestick/ → watchnexus-ember
│   ├── diamond-kodi/    → watchnexus-diamond
│   └── tanzanite-roku/  → watchnexus-tanzanite
├── tools/
│   ├── beacon-tray/     → watchnexus-beacon
│   └── tiramisu-updater/→ watchnexus-tiramisu
├── releases/            → watchnexus-releases
├── website/             → watchnexus-website
└── docs/                → watchnexus-docs
```

## Suggested Repository Names

| Folder | Repo Name | Description |
|--------|-----------|-------------|
| `server/` | `watchnexus-server` | Backend API (FastAPI/Python) |
| `web/` | `watchnexus-web` | Frontend (React) |
| `clients/ruby-androidtv/` | `watchnexus-ruby` | Android TV client |
| `clients/sapphire-android/` | `watchnexus-sapphire` | Android mobile client |
| `clients/ember-firestick/` | `watchnexus-ember` | Fire TV client |
| `clients/diamond-kodi/` | `watchnexus-diamond` | Kodi addon |
| `clients/tanzanite-roku/` | `watchnexus-tanzanite` | Roku channel |
| `tools/beacon-tray/` | `watchnexus-beacon` | System tray app |
| `tools/tiramisu-updater/` | `watchnexus-tiramisu` | Auto-updater |
| `releases/` | `watchnexus-releases` | Pre-built packages |
| `website/` | `watchnexus-website` | Marketing site |
| `docs/` | `watchnexus-docs` | Documentation |

## Creating Repositories

For each folder, create a new Git repository:

```bash
cd separated/server
git init
git add .
git commit -m "Initial commit - WatchNexus Server v2.5.3"
git remote add origin https://github.com/watchnexus/watchnexus-server.git
git push -u origin main
```

## Version Info

- **Server Version:** 2.5.3
- **Client Version:** 1.0.0
- **Date:** February 2026

## License

All components are licensed under GPL-2.0.
