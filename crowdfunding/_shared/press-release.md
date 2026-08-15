# Press Release / Launch-Day One-Pager

> Send to homelab newsletters (Self-Hosted Show, Awesome-Selfhosted
> maintainer list, r/selfhosted moderators for verification),
> friendly journalists at Phoronix, It's FOSS, Ars Technica's
> Sean Hollister, and Linux Magazine.

---

**FOR IMMEDIATE RELEASE**
**Embargoed until: [campaign launch date], 09:00 ET**

---

## Solo Canadian dev launches crowdfund for **WatchNexus**, a unified self-hosted media server that aims to replace Jellyfin, the *arr stack, and Jellyseerr with one app

**Toronto, ON — [launch date]**

[Auz Larocque](https://github.com/auzlarocque), an independent Canadian
software developer, today launched a $15,000 USD crowdfunding campaign
on Kickstarter to ship the public 1.0 release of **WatchNexus** — a
modular, tier-licensed media server that consolidates the functionality
of eight popular self-hosted tools into a single application.

WatchNexus is built on .NET 10 and React 18, comprises 73 modules
across three licence tiers (Standard, Pro, Ultra), and ships as
physical-tier installers for Windows, Fedora, Debian, Arch, and Docker.
Unlike the typical homelab stack, all modules communicate through one
backend, one database, and one settings tree — eliminating the
brittle, multi-config maintenance burden that drives self-hosters away
from the *arr ecosystem.

> "I got tired of running eight different services that all do part of
> the job. WatchNexus is what you'd get if Jellyfin, Sonarr, Radarr,
> Jellyseerr, qBittorrent's web UI, Tdarr, Tautulli, and a retro-game
> emulator all collapsed into one product with one auth layer and one
> licence." — Auz Larocque, founder and sole developer

**The campaign funds three things the project can't deliver from
sweat-equity alone:**

1. **Code-signing certificates** — SSL.com Windows EV ($400) and Apple
   Developer Program ($99/yr) so Windows and macOS users don't see
   "this app could harm your computer" warnings on day-one downloads.
2. **OS-store legitimacy fees** — Microsoft Partner Center, TrueNAS app
   catalogue submission, Canadian Intellectual Property Office
   trademark filing, hardware-rooted PGP signing for Linux releases.
3. **Three months of focused developer runway** to ship the v1.1
   polish pass, write proper end-user documentation, and respond to
   the first wave of paying-user feedback.

**The campaign sets no precedent of "fund or no product."** WatchNexus
v1.0.1 RTP is code-complete today; the unsigned Linux + Docker
installers ship on day one regardless of campaign outcome. The funding
specifically enables Windows / macOS legitimacy and turns a personal
project into a sustainably operated software product.

**Stretch goals at $25K, $40K, $60K, and $90K** unlock a native macOS
build, iOS + Android companion apps, a hosted cloud-sync service, and
a five-year endowment that funds signing renewals through the v2 cycle
respectively.

### About WatchNexus

WatchNexus aggregates personal media — movies, TV, anime, music,
podcasts, photos, ebooks, audiobooks, retro game ROMs, and live TV —
under a unified web UI with native tray-icon integration on Windows
and Linux. The application is built around the **Fortress Protocol**, a
cryptographic integrity-verification system that prevents tampered
binaries from launching, and connects to an open-source licence server
(`licenses.watchnexus.ca`) for tier-based feature unlocking.

The project intentionally targets self-hosters who already own or
otherwise legitimately access their media — there is no public-index
torrent searcher, no built-in subscription proxy, and no piracy-
adjacent functionality. All download integrations require backers to
configure their own credentials with their own download clients.

### About Auz Larocque

Auz is an Ontario-based self-taught developer working under the handle
**WatchNexus**. The project began in 2024 as a personal solve-it-once
homelab consolidation and grew into the 73-module v1.0 release over
~18 months of nights-and-weekends development. WatchNexus is Auz's
first crowdfunding campaign and first commercial software release.

### Campaign details

- **Platform:** Kickstarter (all-or-nothing), with Indiegogo InDemand
  rolling at day 15.
- **Goal:** $15,000 USD.
- **Duration:** 30 days.
- **Reward tiers:** $5 thank-you, $15 Standard licence, $35 Pro
  licence, $75 Ultra licence, $300 "named in credits", $500 "1-hour
  deployment call", up to $5,000 "commissioned module".
- **Recurring funding:** Open Collective, Patreon, and GitHub Sponsors
  open simultaneously for backers who prefer ongoing monthly support.

### Press kit + contact

- Campaign: [kickstarter.com URL — fill in]
- Source code: https://github.com/[user]/watchnexus
- Demo & screenshots: https://watchnexus.ca
- Press kit: https://watchnexus.ca/press
- Live demo (read-only): https://demo.watchnexus.ca
  *(spin up before launch — see `_shared/launch-checklist.md`)*

**Press contact:** Auz Larocque, `press@watchnexus.ca`
**For technical / engineering questions:** `dev@watchnexus.ca`
**For partnership / OEM enquiries:** `partners@watchnexus.ca`

---

###

**Note to editors:** WatchNexus uses no marketing buzzwords. Please do
not describe it as "AI-powered" — it isn't. It's plain old software
that runs on plain old servers.
