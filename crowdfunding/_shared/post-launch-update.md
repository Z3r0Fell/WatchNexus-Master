# Post-Launch Update Templates

> Drop-in copy for the "we made it / we didn't" announcement, the
> monthly transparency report, and the v1.0.1 release reveal.
> Use these on every platform.

## Day 30 — "We made it" (campaign successful)

```
# 🎉 We did it.

WatchNexus is officially funded.

**Final tally:**
- $XX,XXX raised across Kickstarter, Indiegogo, Open Collective,
  GitHub Sponsors, Patreon, and Buy Me a Coffee
- XXX total backers
- XX% over base goal
- Stretch goals unlocked: [list]

**What happens next:**

**This week:**
- BackerKit survey opens for licence-tier confirmation and email
  collection
- The first transparency post goes up on Open Collective with the
  exact incoming and outgoing dollar amounts
- SSL.com EV code-signing certificate ordered (identity verification
  takes 5-10 business days)
- Apple Developer Program subscription activated

**Next month:**
- All licence keys issued via BackerKit
- v1.0.1 ships with the first round of post-launch bug fixes
- $300+ backers' names land in the in-app credits screen

**Months 2-6:**
- v1.1 development cadence kicks off
- Stretch goal deliverables work begins (macOS, mobile, hosted sync,
  endowment, depending on what funded)

**Thank you.** Honestly. Solo dev crowdfunding is terrifying. You
made the difference between a project I'd have shelved and a
product I get to keep working on for the next phase of its life.

— Auz
```

## Day 30 — "We didn't make it" (campaign unsuccessful — Kickstarter all-or-nothing failed)

```
# We didn't hit the Kickstarter goal.

**Final tally:**
- Kickstarter: $XX,XXX (XX% of goal — fell short, no charges
  collected per Kickstarter's all-or-nothing rule)
- Indiegogo: $X,XXX (will continue collecting via InDemand)
- Other platforms: $XXX

**What happens next:**

This is not the end. Here's how the project continues:

1. **The Indiegogo InDemand campaign keeps running** indefinitely.
   Pledge there if you wanted to back on Kickstarter — Indiegogo's
   flexible-funding model means every dollar gets through.
2. **Open Collective stays open.** Monthly contributions there
   directly fund WatchNexus operations.
3. **GitHub Sponsors stays open**, and GitHub's matching-fund
   program is still active for the next [XX] days.
4. **The v1.0 RTP release ships regardless.** Linux + Docker
   installers go up on GitHub releases this week (unsigned but
   functional). Windows installers will follow once we hit the
   $2,500 mark on Indiegogo (covers the EV cert minimum).

**No refunds needed for Kickstarter backers** — Kickstarter doesn't
charge cards on failed all-or-nothing campaigns.

**For everyone who pledged on other platforms**, your rewards still
apply. Licence keys for $15+ backers will be issued by end of next
week.

We didn't hit the moonshot, but we got far enough to keep going.
Thank you for that.

— Auz
```

## First monthly transparency report (Month 1 post-funding)

```
# WatchNexus — Month 1 Transparency Report

**Period:** [Launch close date] to [+30 days]

## Money in

| Source | Amount (USD) |
|---|---|
| Kickstarter (collected, net of fees + failed pledges) | $X,XXX |
| Indiegogo (collected, net of fees) | $X,XXX |
| Open Collective (gross — fees applied at withdrawal) | $X,XXX |
| GitHub Sponsors (no fees during 12-month waiver) | $X,XXX |
| Patreon | $XXX |
| Buy Me a Coffee | $XXX |
| **Total received** | **$XX,XXX** |

## Money out

| Item | Amount | Receipt |
|---|---|---|
| SSL.com EV Windows code-signing cert | $400 | [link to OC expense] |
| Apple Developer Program | $99 | [link to OC expense] |
| Hetzner CX22 (licences server) — month 1 | $7 | [link] |
| Hetzner CPX21 (releases CDN) — month 1 | $12 | [link] |
| Cloudflare Pro | $20 | [link] |
| Postmark email | $15 | [link] |
| Backblaze B2 backups | $5 | [link] |
| **Total spent** | **$XXX** | (all receipts visible at opencollective.com/watchnexus) |

## Money in escrow (committed but not yet spent)

| Bucket | Amount |
|---|---|
| Developer runway (months 2-3) | $6,000 |
| Trademark filing (pending lawyer review) | $380 |
| Microsoft Partner Center | $120 |
| Reserve | $XXX |
| **Total in escrow** | **$X,XXX** |

## Deliverables shipped this month

- ✅ v1.0.1 signed releases live on GitHub
- ✅ Windows installer is now SmartScreen-recognised (no warnings on
  install)
- ✅ Licence keys delivered to all $15+ backers
- ✅ Discord server live with [X] members
- ✅ Demo at https://demo.watchnexus.ca is up and responsive

## Deliverables on deck for next month

- v1.0.1 (week 2-3 next month) — bug fixes from the first wave of
  paying users
- $300+ backer names baked into the in-app credits screen
- Calendly slots open for $500+ backers' deployment calls
- Trademark application filed with CIPO

## Backer stats

- Total backers: XXX
- Standard licences issued: XXX
- Pro licences issued: XXX
- Ultra licences issued: XXX
- Named-in-credits backers: XX
- Discord members: XXX

## Next transparency report

[date — first of next month]

See the full ledger at opencollective.com/watchnexus.

— Auz
```

## v1.0.1 release announcement

```
# WatchNexus v1.0.1 is live

**Released:** [date], [time] ET

This is the first patch release post-funding. Highlights:

## Fixes
- [Issue #XX] Fixed Strudel HandBrake job hanging on certain Blu-ray
  ISOs (thanks to backer @username for the report)
- [Issue #XX] Resolved a race condition in Bastion 2FA enrolment that
  caused some users to be locked out on first 2FA setup
- [Issue #XX] Fixed Roux smart-collection refresh skipping movies with
  apostrophes in their titles

## New things
- ✅ **Named-in-credits screen now active.** Settings → About →
  Credits shows all $300+ backers. Thank you, all of you.
- ✅ Improved licence-server response time (cached server-side
  responses for repeated activations)
- ✅ Added a "Refresh tier" button to Settings → Licence (handy if
  you upgrade between tiers)

## Stretch goal progress
- macOS native build ($25K stretch): **in progress** — Apple
  Developer onboarding complete, build pipeline in CI today
- Mobile companion apps ($40K stretch): not yet funded, but the
  design mockups are at [link]

## Coming in v1.0.2 (~3 weeks)
- Crash-reporting opt-in (Sentry-backed)
- Backup-code regeneration for Bastion 2FA
- Tray-icon refresh on Windows
- Hardware-transcoding profile picker UI in Strudel

## How to update

| Platform | Command |
|---|---|
| Linux (apt) | `sudo apt update && sudo apt upgrade watchnexus` |
| Linux (dnf) | `sudo dnf update watchnexus` |
| Arch | `sudo pacman -Syu watchnexus` |
| Docker | `docker pull watchnexus/watchnexus:1.0.1` |
| Windows | In-app: Settings → Updates → Check now |

Full release notes at https://watchnexus.ca/releases/v1.0.1.

— Auz
```

## Always-on Discord "what's new" template

```
**[date]** — Just shipped:
- 🐛 fix: [short description]
- ✨ feat: [short description]
- 📚 docs: [short description]

Working on:
- [next item], targeting [date]

Question for the channel: [open question if applicable]
```

Pin one of these per week in the `#announcements` channel.

## Anti-mistakes

1. **Never skip a monthly transparency report.** Even if nothing
   eventful happened. A "month was quiet, here's the ledger anyway"
   post is better than silence.
2. **Don't conflate stretch goals with promises in v1.0.** If macOS
   didn't fund, don't put it on the v1.1 roadmap as a "best effort"
   — that's a path to disappointing the funded-stretch backers.
3. **Don't reply to bad-faith backers.** One backer with regret will
   sometimes accuse you of bait-and-switch. Direct them to the
   public ledger. Don't argue.
