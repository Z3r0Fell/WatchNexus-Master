# Campaign Video Script (60 seconds)

> One script, two voiceover options. Re-use for Kickstarter, Indiegogo,
> Patreon page header. Total runtime ~60 seconds at 165 wpm.

## Option A — Personal / "Solo dev" tone

```
[0:00 — close-up on a TV remote being put down, screen
shows Netflix's "Are you still watching?" prompt]

VO: "Streaming used to be simple. One subscription,
one library, one place to find what you wanted to watch."

[0:05 — cut to a montage of streaming app icons —
Netflix, Disney+, Max, Paramount+, Apple TV+]

VO: "Now it's six apps, four hundred dollars a year,
and the show you want is on whichever service you just
cancelled."

[0:14 — cut to the WatchNexus dashboard. The screen
fills with libraries, a single search bar, posters from
across services.]

VO: "WatchNexus is what happens when you decide
you're done playing that game. One server. One
library. Every movie, show, album, book, and game you
already own — finally in one place."

[0:25 — cut to Strudel rip pipeline showing an MKV
import progressing, then to a Jellyfin-style player on
a TV.]

VO: "It rips your discs. It transcodes for your
devices. It downloads — legally, from sources you
choose — and stays out of your way while it works."

[0:36 — cut to tier-matrix graphic: Standard / Pro /
Ultra side-by-side, prices visible.]

VO: "Three tiers. Pay once, own it forever. No
subscriptions, no ads, no usage analytics, no AI
training on your library."

[0:45 — close-up on the developer's hands typing on a
mechanical keyboard. Screen shows the v1.0.0 commit
landing on GitHub.]

VO: "I'm Auz. I built WatchNexus because nobody else
was going to. Version 1.0 is ready. I need help
shipping it the right way — properly signed, properly
hosted, properly supported."

[0:55 — back to dashboard. WatchNexus logo overlay
with campaign URL.]

VO: "Back the launch. Skip the streaming-app shuffle.
WatchNexus, one library forever."

[0:60 — fade to black, campaign URL persists]
```

## Option B — Technical / "Show HN" tone

```
[0:00 — terminal window, npm install scrolling]

VO: "Self-hosting your media stack used to mean
running eight separate services that barely talked to
each other."

[0:08 — quick cuts: Jellyfin UI, Radarr UI, Sonarr UI,
Jellyseerr UI, Tautulli UI, qBittorrent UI, Tdarr UI.]

VO: "Jellyfin for playback. Radarr and Sonarr for
movies and TV. Jellyseerr for requests. Tautulli for
analytics. qBittorrent. Tdarr. Eight dashboards. Eight
config files. Eight things to break on update day."

[0:20 — single cut: WatchNexus dashboard, everything
unified under one nav.]

VO: "WatchNexus replaces all of them with one server.
.NET 10 backend. React frontend. SQLite. Seventy-three
fully wired modules under three licence tiers."

[0:30 — code editor showing the open-source backend
code; integrity-check passing in terminal.]

VO: "The Fortress Protocol cryptographically verifies
the binary at startup. The licence server is the only
external dependency, and it's open source. Self-host
the activation server too if you want to."

[0:42 — montage of installers: Windows .exe,
Fedora .rpm, Debian .deb, Arch .pkg.tar.zst, Docker
pull.]

VO: "Native installers for Windows, Fedora, Debian,
Arch, and Docker. Tray icons on Windows and Linux.
Hardware transcoding via NVENC, QSV, VAAPI, and AMF."

[0:52 — final card: pricing, campaign URL.]

VO: "Version one-point-zero is code complete. Help me
sign it, ship it, and keep the lights on at the
licence server."

[0:60 — black]
```

## Production notes

- **Don't lipsync.** Voiceover over screen recording. Saves you a
  studio session and looks more professional.
- **Voiceover services:** ElevenLabs Starter ($5/mo) → voice "Charlie"
  for Option A, "Brian" for Option B.
- **Music:** Epidemic Sound "Late Night Drive" or "We Were Young" cuts
  work for both options. Or freePD.com if you want $0 cost.
- **Resolution:** export at 1920×1080 H.264 mp4. Most platforms
  re-encode anyway, but giving them a clean source helps.

## Kickstarter-specific edits

Kickstarter rewards the first 3 seconds heavily — the auto-play
preview cuts at 3s. **Open Option A with the WatchNexus dashboard
shot instead of the TV remote** so the brand is visible in the
preview. Move the remote shot to position 0:08.

## Indiegogo-specific edits

Indiegogo viewers skew tech-curious; Option B converts better here.
Use Option A as the secondary "About the team" video on the campaign
page sidebar.
