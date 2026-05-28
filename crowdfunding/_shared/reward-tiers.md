# Reward Tier Ladder — License Ladder

> Used identically on Kickstarter, Indiegogo, Open Collective, Patreon,
> and Buy Me a Coffee (with platform-specific perk wording). Numbers in
> USD; convert at platform-default for non-USD checkouts.

## Early-bird tier (first 100 backers per slot, ends day 7)

| Pledge | Tier      | What you get |
|--------|-----------|--------------|
| **$10** | Standard  | One Standard licence (lifetime) — $5 off retail. Backer-only Discord channel. |
| **$25** | Pro       | One Pro licence (lifetime) — $10 off retail. All Standard perks. |
| **$50** | Ultra     | One Ultra licence (lifetime) — $25 off retail. All Pro perks + early access to v1.1 release candidates. |

Slots: 100 / 100 / 100 (300 early-bird licences total).

## Standard reward ladder

| Pledge | Tier reward |
|--------|-------------|
| **$5** "Coffee" | Public thank-you on the WatchNexus website credits page + Discord supporter role. No licence. |
| **$15** | One **Standard** licence (lifetime) |
| **$35** | One **Pro** licence (lifetime) |
| **$75** | One **Ultra** licence (lifetime) |
| **$120** | Two **Pro** licences (gift-friendly bundle) |
| **$200** | Two **Ultra** licences (one for you, one for a friend) |

## Power-user tier

| Pledge | Reward |
|--------|--------|
| **$300** | Ultra licence + **named in the in-app credits screen** + Discord "Founder" role |
| **$500** | Ultra licence + named credits + **1-hour 1:1 deployment call** with Auz over Discord/Jitsi (NAS picking, hardware-transcoding setup, *arr stack walkthrough) |
| **$1,000** | All above + **lifetime updates including paid major versions** ("Founder's Plan") |
| **$2,500** "Patron" | Founder's Plan × 5 (give 4 to your homelab friends) + your logo on the WatchNexus homepage "Patrons" strip for 12 months |
| **$5,000** "Lab Sponsor" | Patron tier + **dedicated module commission**: I'll build one community-requested module of your choice and ship it in v1.2 with you credited as the patron |

## Swag (added once Printify/Redbubble shop opens — see `swag-plan.md`)

Swag is **not** in the v1.0 campaign rewards because Auz hasn't
finalised the merch store yet (you mentioned being stuck on Printify).
A post-funding stretch reward unlocks at $25K:

> *"All backers at $35+ get a 20% discount code for the WatchNexus
> merch store when it opens in Q2."*

This lets the campaign avoid logistics risk (no fulfilment, no shipping
quotes, no customs) while still teasing physical swag for later.

## Cross-platform notes

- **Kickstarter / Indiegogo**: use these tiers exactly. Add-ons (extra
  licences) configured via Kickstarter Pledge Manager → BackerKit.
- **Open Collective**: reward tiers become "monthly contributor"
  amounts ($5/mo, $15/mo, $35/mo, $75/mo). Lifetime licence applied
  after 3 months at the tier.
- **GitHub Sponsors**: same monthly ladder; lifetime licence after
  1 month at any paid tier.
- **Patreon**: same monthly ladder; lifetime licence unlocks at month 3.
- **Buy Me a Coffee**: one-off tips at $5 / $15 / $35 / $75 trigger an
  automated email with the corresponding licence key.

## Licence key fulfilment

Pledge confirmed →
- (Kickstarter/Indiegogo) BackerKit survey collects pledger email and
  preferred tier.
- (OC/GHS/Patreon/BMC) Webhook from platform → WatchNexus licence
  server issues a key and emails the backer.

Keys are bound to the **backer's email** and can be re-issued up to
3 times if the user loses access (handled by `/api/cellar/reissue`).
