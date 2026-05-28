# WatchNexus — Crowdfunding Campaigns

> **Target:** USD $15,000
> **Use of funds:** Code-signing certificates, OS-store legitimacy fees, and
> dev-runway to ship the v1.0.0 RTP cleanly across every platform.
> **Status:** v1.0.0 RTP code-complete; campaigns fund legitimacy + stretch.

This directory holds **fully drafted, platform-tailored campaigns**.
Each subfolder contains everything you need to launch on that platform
(story copy, FAQ, reward sheet, budget breakdown, video script, press
one-pager, post-launch update template).

## Platform map

| Folder              | Site                           | Funding model            | Real name required? | Launch order |
|---------------------|--------------------------------|--------------------------|---------------------|--------------|
| `kickstarter/`      | https://kickstarter.com        | All-or-nothing, 30 days  | **Yes** (Auz Larocque) | 1st — flagship |
| `indiegogo/`        | https://indiegogo.com          | Flexible, 30 days        | **Yes** (Auz Larocque) | 2nd — overlap last 15 days |
| `opencollective/`   | https://opencollective.com     | Continuous, transparent  | Optional            | Always-on, soft launch with Kickstarter |
| `githubsponsors/`   | https://github.com/sponsors    | Recurring monthly + one-off | Yes for IRS/tax    | Always-on, dev-audience |
| `patreon/`          | https://patreon.com            | Recurring monthly        | Yes                 | 3rd — post-Kickstarter for evangelists |
| `buymeacoffee/`     | https://buymeacoffee.com       | One-off tips + memberships | Optional (handle OK) | Always-on, low-pressure tip jar |

## Shared assets

The `_shared/` folder holds files referenced by every platform (budget,
risk register, key reward-tier ladder, stretch goals, brand kit pointers,
DM templates).

## Operational workflow

1. **Two weeks before launch** — open Kickstarter draft, fill from
   `kickstarter/campaign.md`, upload assets from `_shared/brand-kit.md`.
2. **One week before** — launch Open Collective + GitHub Sponsors +
   Buy Me a Coffee as "always-on" pages so traffic from Kickstarter has
   a fallback if the all-or-nothing campaign doesn't fund.
3. **Day 0** — Kickstarter goes live. Post the launch announcement (see
   `_shared/press-release.md`) to r/selfhosted, r/HomeServer, Hacker
   News (Show HN), Lemmy `self-hosted@lemmy.world`, Mastodon
   `#selfhosted` tag, and the Jellyfin/Plex subs (carefully — see
   community-rules.md per-platform).
4. **Day 15** — open Indiegogo InDemand at $15K to capture late
   adopters who missed the all-or-nothing window.
5. **Day 30** — Kickstarter closes. Drop "what happens next"
   announcement from `_shared/post-launch-update.md`.
6. **Day 30+** — Patreon goes live for ongoing support, swap
   stretch-goal tiles into roadmap, ship v1.0.1 with named-in-credits
   patch.

## Reward consistency

The license-ladder rewards are identical across every platform
(`_shared/reward-tiers.md`) so cross-pollination is friction-free —
a backer who clicked through from Kickstarter to Open Collective
gets the same tiers and pricing.

## Stretch goals (apply across all platforms)

See `_shared/stretch-goals.md` — $25K / $40K / $60K / $90K targets
with concrete deliverables.
