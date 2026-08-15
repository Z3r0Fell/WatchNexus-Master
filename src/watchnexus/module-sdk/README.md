# WatchNexus Module SDK

Build your own WatchNexus module as a .NET 10 class library.

## Quick Start

1. Copy the `template/` directory to your module name (e.g. `MyModule/`)
2. Update `module.json` with your module's metadata
3. Implement `IWatchNexusModule` in your `Module.cs`
4. Build: `dotnet build`

## Deploy

Copy your module directory into `modules/` next to the WatchNexus binaries:

```
modules/
  MyModule/
    module.json
    WatchNexus.Module.MyModule.dll
    frontend/
      MyPage.jsx
```

WatchNexus auto-discovers and loads modules on startup.

## Module Manifest (`module.json`)

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | PascalCase module name (e.g. `MyModule`) |
| `display_name` | Yes | Human-readable name shown in UI |
| `version` | Yes | Semver module version |
| `description` | Yes | Short description of the module |
| `codename` | Yes | Lowercase slug used in URLs (e.g. `my-module`) |
| `author` | Yes | Your name or org |
| `tier` | Yes | `standard`, `pro`, or `ultra` |
| `dependencies` | No | Array of core module codenames this depends on |
| `api_route_prefix` | Yes | URL prefix (e.g. `my-module`) |
| `api_routes` | Yes | Array of route paths under the prefix |
| `frontend_pages` | No | Array of React page components to register |
| `type` | No | `controller` (default) or `desktop` |

## Tier Enforcement

Modules are gated by the FortressFilter based on the `tier` field:

- `standard` — available to all users
- `pro` — requires Pro or Ultra license
- `ultra` — requires Ultra license

## Frontend Pages

Declare React pages in `frontend_pages`. WatchNexus will serve them from the module's `frontend/` directory.

## Dependencies

Declare module dependencies in the `dependencies` array. The core will load dependencies first.
