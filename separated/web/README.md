# WatchNexus Web

The web frontend for WatchNexus - a modern React-based media interface.

## Tech Stack
- **Framework**: React 18
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State**: React Context
- **Routing**: React Router
- **Build**: Create React App (CRACO)

## Features
- Responsive design (mobile-friendly)
- Dark/Light themes (Theme Forge)
- Media browsing and playback
- User profiles and quick login
- Download queue management
- Settings and configuration
- Library management

## Quick Start

```bash
# Install dependencies
yarn install

# Create environment file
cp .env.example .env

# Set backend URL in .env
# REACT_APP_BACKEND_URL=http://localhost:8001

# Start development server
yarn start
```

## Building for Production

```bash
yarn build
```

Output will be in `build/` directory.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| REACT_APP_BACKEND_URL | Backend API URL | http://localhost:8001 |
| WDS_SOCKET_PORT | WebSocket port for dev | 443 |

## License

GPL-2.0
