# Contributing to WatchNexus

Thanks for your interest in improving WatchNexus!

## Project layout

- `src/watchnexus/core/` — C#/.NET 10 REST API (controllers, services, auth)
- `src/web/` — React 18 frontend (CRA + craco, Tailwind, shadcn/ui)
- `backend/` — FastAPI reverse proxy used only in the preview/dev container
- `build/` — installer packaging scripts

## Development

```bash
# Backend
dotnet build src/watchnexus/core/WatchNexus.Core.csproj

# Frontend
cd src/web && yarn install && yarn start

# Python E2E tests
cd backend && python -m pytest tests/
```

## Pull requests

1. Branch from `main`.
2. Keep changes focused; match existing code style and conventions.
3. Run the build (0 errors) and the E2E suite before opening a PR.
4. Never commit secrets — `.env`, `appsettings.Production.json`, and key
   material are git-ignored for a reason.
5. Backend routes must be prefixed with `/api`. Auth changes must preserve the
   httpOnly cookie + CSRF flow.

## Commit messages

Use clear, imperative subject lines (e.g. `Add CSRF middleware`,
`Fix library scan count`). Reference issues where applicable.
