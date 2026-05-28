# Kickstarter Campaign — WatchNexus v1.0

> Flagship campaign. All-or-nothing funding. 30 days.
> Real-name required: **Auz Larocque**.
> Country: Canada (Kickstarter supports CAD/USD; bill in USD).

## Project basics

| Field | Value |
|---|---|
| **Project title** | WatchNexus — One Server for Every Movie, Show, and Library You Own |
| **Subtitle** | A unified, self-hosted media server replacing Jellyfin + the *arr stack with a single, signed, three-tier app |
| **Category** | Technology → Software |
| **Subcategory** | Apps |
| **Funding goal** | **$15,000 USD** |
| **Duration** | 30 days |
| **Currency display** | USD |
| **Project location** | Toronto, Ontario, Canada |
| **Creator name (public)** | Auz Larocque |
| **Creator handle** | @watchnexus |

## Campaign hero copy

### Headline (60-character limit, used in social previews)
> "One server. Every library. No more streaming-app shuffle."

### Short pitch (the part above the fold)

```
Your media is scattered across eight self-hosted services that
barely talk to each other — and four streaming subscriptions that
cancel the shows you actually wanted to watch.

WatchNexus is one application that replaces all of it.

73 modules. Three licence tiers. Native installers for Windows,
Fedora, Debian, Arch, and Docker. The code is done. This campaign
funds the code-signing certificates that turn a working app into a
legitimate piece of software your computer trusts on day one.

Pledge a tier, install the build, own it forever.
```

## Sections (in the order Kickstarter renders them)

### 1. About this project

```
**TL;DR — what is WatchNexus?**

One server. Replaces Jellyfin, Sonarr, Radarr, Jellyseerr,
qBittorrent's web UI, Tdarr, Tautulli, and a stack of other tools
with a single application that ships as a native installer for
Windows, Fedora, Debian, Arch, and Docker.

73 modules. Three licence tiers (Standard / Pro / Ultra). One
database. One settings tree. No daisy-chained Docker compose
files.

**Why I'm asking for $15,000**

The code is done. WatchNexus v1.0.0 is committed and tagged on
GitHub. The Linux + Docker installers ship signed (PGP, day one).

But for Windows and macOS users to install WatchNexus *without
their operating system warning them that the app might be
malware*, the binaries have to be cryptographically signed by an
authority that those operating systems already trust.

That trust costs money:

- **Windows EV code-signing certificate**: $400/yr (SSL.com)
- **Apple Developer Program** (for macOS notarisation): $99/yr
- **Microsoft Partner Center**: $120 one-time
- **Hardware security module** (Yubikey, for signing-key
  protection): $55
- **Trademark filing** (Canada IPO, to protect the name): $380
- **Licence-server hosting + transactional email + backups**:
  $1,200/yr
- **Platform + payment fees** (Kickstarter 5% + Stripe ~5%):
  $1,500
- **Developer runway** for 3 months of focused v1.1 polish:
  $9,000

The rest is buffer — refund float, accountant prep, support
tooling. Full line-item breakdown in `_shared/budget.md` and at
opencollective.com/watchnexus (public ledger, every dollar in
and out logged).

**What you're really backing**

Not the existence of the product. WatchNexus exists. You can
clone the repo today and build it from source.

What you're backing is the **legitimacy** that turns a personal
project into a sustainable software product:
- Windows and macOS users install without warnings.
- The trademark protects "WatchNexus" from being squatted.
- The licence server runs reliably on professional hosting for
  12 months minimum.
- I get 3 months where I can fix bugs and polish v1.1 without
  taking a side job.

**What WatchNexus replaces in your homelab**

| What you run today | What WatchNexus replaces it with |
|---|---|
| Jellyfin / Emby / Plex | Playback module + tier-locked transcoding |
| Sonarr / Radarr | Fondue / Saffron (Pro tier) |
| Jellyseerr / Overseerr | Parfait + Menu (Ultra tier) |
| qBittorrent web UI | Churro (Pro tier) |
| Tdarr | Strudel + hardware transcoding (Ultra tier) |
| Tautulli | Analytics (Pro tier) |
| Komga / Calibre-Web | Biscotti (Pro tier) |
| Audiobookshelf | Treacle (Pro tier) |
| RetroArch web UI | Pretzel (Ultra tier) |
| WireGuard config UI | Tunnel + Bastion (Ultra tier) |

**What WatchNexus does NOT do**

It does not pirate anything for you. There is no built-in
indexer that scrapes public torrent sites. You bring your own
download client credentials, your own *arr-style indexer
subscriptions, and your own media. WatchNexus is for self-
hosters who already know how to source their library — it just
gives you a saner place to manage it.

**Who I am**

I'm Auz Larocque. Self-taught software developer in Toronto,
Ontario, Canada. WatchNexus is my first commercial software
release and my first crowdfunding campaign. I'm a solo dev with
no team, no agency, and no marketing budget — every dollar in
this campaign goes to the line items above.

I've been homelabbing since 2018. WatchNexus is the tool I wish
had existed when I was setting up my stack the first time.
```

### 2. Risks and challenges

> Copy from `_shared/risks.md` — verbatim.

### 3. Rewards section

> Use the ladder from `_shared/reward-tiers.md`. Kickstarter has a
> separate UI for rewards, so transcribe each tier into its own
> reward card with the exact pledge amount, description, estimated
> delivery date (set to **2 months after campaign close** for
> licence keys, **4 months after** for "named in credits", **6
> months after** for "1-hour deployment call" and "commissioned
> module"), and shipping (USD $0, digital delivery worldwide).

### 4. Stretch goals

> Copy from `_shared/stretch-goals.md` — render as 4 tiles in the
> page body with the dollar amounts as section headers.

### 5. Updates schedule

Promise — and keep — one update per week minimum:
- Week 1: "What's happened in the first 7 days" — backer count, %
  funded, press hits.
- Week 2: "Mid-campaign deep dive" — pick one technical topic
  (e.g., the Fortress Protocol) and explain it.
- Week 3: "What's coming after we fund" — talk through v1.1 roadmap
  in detail.
- Week 4 (campaign close week): "Final push" — what crosses the
  finish line, what stretch goals are unlocked.

Post-campaign updates flip to monthly:
- Month 1: "Where the money went so far" — public ledger snapshot.
- Month 2: "v1.0.1 shipped" — release notes + named-in-credits
  reveal.
- Months 3–6: monthly progress reports until v1.1 ships.

### 6. FAQ (Kickstarter sidebar)

**Q: Do I get my licence forever, or just one year?**
A: Forever. Pay once, own forever. There's no subscription. Major
versions (e.g., v2.0) are also included for all Kickstarter
backers — that's a Kickstarter-only perk.

**Q: Can I upgrade my tier later?**
A: Yes. Standard → Pro is $30 after campaign, Pro → Ultra is $50.
Backers get a 30% discount on upgrades for the first year
post-campaign.

**Q: What if I want a refund?**
A: Within 14 days of receiving your licence key, full refund minus
platform fees. Email refunds@watchnexus.ca.

**Q: Can I run WatchNexus on a Raspberry Pi?**
A: The backend runs on arm64 (tested on a Pi 4 4GB and Pi 5
8GB). Hardware transcoding is unavailable on Pi — you'll want a
small mini-PC for anything beyond direct-play.

**Q: What about macOS?**
A: macOS native is the $25K stretch goal. The reason it's a stretch
and not in base — Apple Developer is included at $99 (already in
the base budget), but the *labour* of building a universal binary +
notarisation pipeline + native AppKit tray icon is 6 weeks of work
that the base $9K runway doesn't cover.

**Q: Is WatchNexus open source?**
A: The licence-server source is open (AGPLv3). The client backend
+ frontend are **source-available** under a proprietary licence —
you can read the code, audit it, and even compile it yourself, but
you need a paid licence key to unlock the tier-locked modules at
runtime. This is the "fair-code" model Sentry / Plausible / Cal.com
use.

**Q: Why three tiers and not one price?**
A: A homelab beginner doesn't need Strudel's MakeMKV rip pipeline.
A power user doesn't want to pay the same as the beginner. Three
tiers means the entry point is $15 and the people who want
everything pay $75 — same software, different unlock surface.

**Q: How do you stop a user from cracking the tier-locking?**
A: I don't, fully. Fortress Protocol verifies the binary hasn't
been tampered with, and the licence server is the source of truth
for tier — but a determined attacker could patch around it.
That's true of every commercial software product, ever. The
licence is enforced socially (don't be a jerk) and technically just
enough that casual circumvention isn't trivial. The actual cost of
my work goes to honest users; the dishonest ones aren't my market.

**Q: Will WatchNexus work without an internet connection?**
A: Yes, after first-launch activation. The licence server is
contacted once during activation and re-validated weekly (24-hour
grace period if offline). All media playback, transcoding, and
library management is fully local.

**Q: Telemetry?**
A: None by default. There's an opt-in crash-reporting toggle
(Sentry-backed) that defaults to OFF. No analytics, no usage
tracking, no "phone home" beyond licence verification.

### 7. Backer FAQ (live updates section)

Edit during the campaign as questions come in. Pin top 5 most
common.

## Campaign visuals (Kickstarter requires these)

| Asset | Spec | Source |
|---|---|---|
| Project image (above-the-fold) | 1024×576 PNG | Crop the WatchNexus dashboard screenshot with the wordmark overlaid in the bottom-right |
| Project video | mp4, ≤5 min, ≥1080p | Record per `_shared/video-script.md` Option A |
| Reward thumbnails | 200×200 PNG each | Use the brand mark with tier-coloured corners (green = Standard, blue = Pro, gold = Ultra) |
| Stretch goal tiles | 1024×400 PNG each | Use the dashboard with the new feature highlighted; one per goal |
| Risk-section header | 1024×400 PNG | Use the Fortress integrity-check screenshot |
| Bio image | 800×800 PNG | Headshot or stylised avatar — your call |

## Backer comms playbook

- **Reply within 4 hours** during business days. Within 24 hours
  on weekends.
- **Pin good questions** with answers in the FAQ section.
- **Don't argue with bad-faith comments.** Post one link to the
  GitHub repo as proof, then stop.
- **Thank every $300+ backer publicly** in the daily update.

## Post-campaign timeline (Kickstarter showed me this works)

| Day | Action |
|---|---|
| Day 30 (close) | "We made it" update within 2 hours |
| Day 33 | BackerKit survey opens |
| Day 47 | BackerKit survey closes; licence keys begin issuing |
| Day 60 | All licence keys issued; v1.0.1 shipped |
| Day 75 | Named-in-credits reveal in v1.0.2 |
| Day 90 | First deployment-call slots open via Calendly |
| Day 120 | v1.1 alpha for $300+ backers |
| Day 180 | v1.1 final release; campaign retrospective post |
