# WatchNexus Development

Quick setup for local development.

## Setup

```bash
# backend
cd src/server
python3 -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# frontend (different terminal)
cd src/web
yarn install
yarn start
```

Backend runs on :8001, frontend on :3000. Frontend proxies API calls to backend.

## Project layout

```
src/
├── server/              # FastAPI backend
│   ├── server.py       # main app, ~5800 lines
│   ├── database.py     # sqlite wrapper
│   ├── marmalade_*.py  # media library stuff
│   ├── compote.py      # indexer/tracker integration
│   ├── fondue.py       # download management
│   ├── relish.py       # iptv
│   ├── garnish.py      # subtitles
│   └── gelatin.py      # transcoding
│
└── web/                # React frontend
    ├── electron/       # desktop app wrapper
    ├── src/
    │   ├── pages/     # route components
    │   ├── components/# ui components
    │   └── services/  # api clients
    └── package.json
```

## Backend env vars

Create `src/server/.env`:

```
JWT_SECRET=dev-secret
TMDB_API_KEY=optional
```

## Database

SQLite, stored at `src/server/watchnexus.db`. Delete it to reset.

## Key modules

| Module | Does |
|--------|------|
| `marmalade_server.py` | Library scanning, metadata |
| `compote.py` | Indexer integration |
| `fondue.py` | qBittorrent integration |
| `relish.py` | IPTV/M3U handling |
| `garnish.py` | Subtitle search |
| `gelatin.py` | FFmpeg transcoding |
| `zest.py` | Torrent search |

## Testing APIs

```bash
# health check
curl localhost:8001/api/health

# login
curl -X POST localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password"}'

# use the token
curl localhost:8001/api/libraries \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Electron (desktop app)

```bash
cd src/web
yarn electron:dev    # dev mode, uses localhost backend
yarn electron:build  # build installer
```

## Frontend stack

- React 19
- Radix UI primitives
- Tailwind CSS
- Framer Motion for animations
- Axios for HTTP

## Common issues

**Backend won't start:** Check Python version (`python3 --version`, need 3.10+). Reinstall deps.

**Frontend issues:** Delete `node_modules` and `yarn.lock`, run `yarn install` again.

**DB errors:** Delete `watchnexus.db` and restart backend.
