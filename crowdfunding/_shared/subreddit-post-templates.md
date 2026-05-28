# Subreddit + Forum Post Templates

> One template per community. Do **not** copy-paste between subreddits —
> mod teams flag identical posts as spam. Each template is tuned to the
> subreddit's culture and rules.

## r/selfhosted (1.0M members)

**Title:** *"Show /r/selfhosted: WatchNexus v1.0 — I built a unified media server to replace my Jellyfin + Radarr + Sonarr + Jellyseerr + Tdarr stack. Code is open, crowdfund is for code-signing certs."*

```
Two years ago my Docker compose file had 11 services running just to
manage my media library. Today, after a lot of nights and weekends,
I've consolidated all of that into one application — WatchNexus.

It's .NET 10 + React 18, runs as a single service, ships native
installers for Windows, Fedora, Debian, Arch, and Docker, and has 73
modules across three licence tiers (Standard, Pro, Ultra). The whole
licensing system is open-source — you can self-host the activation
server if you don't trust mine.

What it replaces from my stack:
- Jellyfin (playback)
- Radarr / Sonarr (movie + TV automation)
- Jellyseerr (request UI)
- qBittorrent web UI (download management)
- Tdarr (transcoding pipeline)
- Tautulli (analytics)
- A jellyfin retro-game add-on
- An ebook reader (Komga)
- An audiobook server (Audiobookshelf)

What it doesn't do: any piracy-adjacent stuff. You bring your own
torrent client and your own *arr-style indexers. The Strudel module
rips your physical disc collection (MakeMKV-based). The download
clients integrate with what you already use.

The campaign on Kickstarter is funding code-signing certificates
(Windows EV + Apple Developer) so Windows and macOS users don't get
SmartScreen / Gatekeeper warnings on day-one installs. The Linux + 
Docker installers ship signed and ready regardless.

GitHub: [link]
Campaign: [link]
Demo (read-only): https://demo.watchnexus.ca

Happy to answer architecture questions — I lurk this sub daily.
```

**Posting timing:** Tuesday or Wednesday, 09:00 ET (peak r/selfhosted
traffic). Avoid Sundays (low-engagement). Avoid Fridays (gets buried by
the weekend).

**If mods request flair or verification, comply immediately.**

---

## r/HomeServer (380k members)

**Title:** *"After 2 years building a one-app replacement for my 11-service homelab media stack, my self-hosted media server is ready for v1.0. Crowdfund is for legitimacy, not the code."*

Slightly different audience — leans more hardware-conscious, fewer
*arr users. Lead with the **hardware-transcoding** angle:

```
If you've ever tried to get NVENC working on Jellyfin behind Docker
and a non-root user, you know the special pain. WatchNexus auto-
detects your hardware encoder (NVENC, Intel QSV, VAAPI, AMD AMF,
Apple VideoToolbox), generates the right ffmpeg command line, and
gives you a "watch this play" preview before you commit a transcode
job to disk.

That's one of 73 modules in the v1.0 release. The full stack:
playback, library management, *arr-style automation, hardware
transcoding, retro-game emulation, ebook + audiobook support, S3
backup, live TV DVR, cloud sync, and a built-in tray icon.

Single .NET 10 binary on the backend, React 18 frontend, SQLite on
disk. No daisy-chained Docker network configs. No mid-update
breakage. One product. Three licence tiers (Standard / Pro / Ultra).

The Kickstarter is funding the code-signing certificates that let
your Windows install go through SmartScreen on day one. The
software itself is done. Demo at https://demo.watchnexus.ca, source
on GitHub.
```

---

## r/HomeLab (1.2M members)

r/HomeLab is bigger and more hardware-oriented. They reward
benchmarks. Lead with concrete numbers:

```
v1.0 release of my media server WatchNexus. Three numbers that
matter on r/HomeLab:

1. **On a Ryzen 5600G with iGPU transcode** (Linux + VAAPI):
   WatchNexus pushed 4× concurrent 4K HEVC → 1080p H.264 transcodes
   at 38–42 fps each. Memory footprint at idle: 240 MB.
2. **On an N100 mini-PC** (Intel QSV): 6× concurrent 4K → 1080p
   transcodes, ffmpeg -hwaccel qsv. CPU load 60–70%, fan stayed
   quiet.
3. **Cold-start to dashboard** on the Ryzen box: 1.8 seconds. SQLite
   with 4,200 movies and 38,000 episodes indexed.

Stack is .NET 10 backend, React 18 frontend, one binary, one
database. Installers for Windows, Fedora, Debian, Arch, Docker.
Three licence tiers — the campaign covers Windows EV + Apple
notarisation so installs go through cleanly.

GitHub: [link]
Demo: https://demo.watchnexus.ca
Bench results spreadsheet: [link to public Google Sheet]
```

---

## Lemmy `!selfhosted@lemmy.world`

Lemmy users hate marketing copy. Keep it dry and technical:

```
WatchNexus v1.0 release. Single-binary .NET 10 backend + React 18
frontend. Replaces the Jellyfin + Sonarr/Radarr + Jellyseerr +
qBittorrent UI + Tdarr stack with one app. 73 modules, three licence
tiers, native installers for Windows / Fedora / Debian / Arch /
Docker.

Source: [link]
Demo: https://demo.watchnexus.ca

The crowdfund is on Kickstarter for the code-signing certs. The
code itself is done and the Linux + Docker installers ship signed
regardless of whether the campaign funds.

No "AI", no telemetry, no analytics, no subscription. Pay once for
the tier you want, own forever. Licence server is open-source —
self-host it if you'd rather.
```

---

## Hacker News (Show HN)

**Title:** *"Show HN: WatchNexus — a unified media server replacing Jellyfin + *arr stack"*

```
I built WatchNexus over the past two years to consolidate my homelab
media stack — Jellyfin, Sonarr, Radarr, Jellyseerr, qBittorrent's
web UI, Tdarr, Tautulli, and a handful of others — into a single
application. v1.0 is now code-complete.

Stack: .NET 10 backend, React 18 frontend, EF Core + SQLite, single
self-contained binary per OS. 73 modules across three licence tiers
(Standard / Pro / Ultra). Native installers for Windows EV-signed
(in flight), Fedora RPM, Debian DEB, Arch pkg.tar.zst, Docker. Tray
icon on Windows (NotifyIcon) and Linux (AppIndicator3).

Notable design choices:
- "Fortress Protocol" — startup-time SHA-256 integrity check against
  a signed manifest. Tampered binaries refuse to start.
- The licence server (`licenses.watchnexus.ca`) is open-source; you
  can run your own and re-point the activation URL.
- All third-party integrations (TMDB, qBittorrent, SABnzbd, MakeMKV)
  are swappable for alternatives via config — no vendor lock-in.

Demo (read-only, seeded): https://demo.watchnexus.ca
Code: https://github.com/[user]/watchnexus
Crowdfund (for the code-signing certs, not the code itself):
[Kickstarter link]

Happy to dive into any of the architecture in the comments —
specifically the hardware-transcoding profile detection, the
multi-tier physical-installer separation, or the licence server
design.
```

**Posting time:** Tuesday or Wednesday around 08:30 ET. Avoid Mondays
(weekend backlog floods the front page).

---

## Mastodon launch post (under 500 chars)

```
WatchNexus v1.0 is out 🚀

Self-hosted media server replacing Jellyfin + the *arr stack with
one binary. .NET 10 + React 18. 73 modules across Standard/Pro/Ultra
tiers. Native installers for Windows, Fedora, Debian, Arch, Docker.

Crowdfunding the code-signing certs on Kickstarter — Linux + Docker
ship signed regardless.

#selfhosted #homelab

Code: [link]
Demo: https://demo.watchnexus.ca
Campaign: [link]
```

---

## Bluesky launch post (300 chars)

Bluesky readers skim. Lead with the most surprising claim:

```
Spent 2 years building a single-app replacement for my Jellyfin +
*arr + Jellyseerr + Tdarr stack. v1.0 ships today.

73 modules. One binary. Three tiers.

Code: [link]
Campaign: [link] (for the Windows EV cert)
```

---

## X / Twitter launch post

Same content as Bluesky. Don't pin if you don't have to — engagement
on X dies in 4 hours regardless.
