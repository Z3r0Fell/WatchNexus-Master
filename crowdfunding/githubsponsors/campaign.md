# GitHub Sponsors — WatchNexus

> Always-on. Soft-launches alongside Kickstarter as the "developer
> audience" funding path. GitHub Sponsors is uniquely tuned to the
> homelab / DevOps demographic — half the WatchNexus prospects
> already have GitHub accounts.

## Page basics

| Field | Value |
|---|---|
| **Sponsorable account** | @watchnexus (organisation) or @auz-larocque (personal) |
| **Tagline** | "I build WatchNexus — a unified, self-hosted media server in C# + React." |
| **Country** | Canada (Stripe Canada handles the payout) |
| **Tax form** | W-8BEN required (you'll fill this in during onboarding) |
| **Profile photo** | WatchNexus brand mark |
| **Cover image** | The dashboard screenshot with the tagline overlaid |

## Why GitHub Sponsors alongside other platforms?

Three reasons:

1. **GitHub matches sponsorships** for the first 12 months — GitHub
   contributes an additional dollar for every dollar sponsored, up
   to certain caps. Free uplift.
2. **Sponsorship is invisible in the donator's public profile by
   default** — appeals to corporate users (your DevOps backers'
   employers) who can sponsor without their employers seeing.
3. **The audience is already on GitHub.** They cloned the repo. They
   starred it. Asking them to pledge in the same place they consume
   the code reduces friction enormously.

## Sponsor tiers (use these exactly)

### One-time sponsorships

| Tier | Amount | What sponsors get |
|---|---|---|
| ☕ Coffee | $5 | Public thanks on watchnexus.ca/credits |
| 💚 Standard supporter | $15 | One Standard licence (lifetime) |
| 💎 Pro supporter | $35 | One Pro licence (lifetime) |
| 🏆 Ultra supporter | $75 | One Ultra licence (lifetime) |
| 🥇 Founder | $300 | Ultra licence + named in app credits + Discord founder role |
| 🚀 Sustaining sponsor | $500 | Founder perks + 1-hour deployment call |
| 💼 Lab sponsor | $5,000 | All above + a custom commissioned module in v1.2 |

### Monthly sponsorships

| Tier | Monthly amount | What sponsors get |
|---|---|---|
| ☕ Coffee monthly | $5/mo | Discord supporter role; after 1 month at this tier, receive Standard licence |
| 💚 Standard monthly | $5/mo | (Same as Coffee — provided in case you want it labelled "Standard") |
| 💎 Pro monthly | $15/mo | After 1 month, receive Pro licence |
| 🏆 Ultra monthly | $35/mo | After 1 month, receive Ultra licence |
| 🥇 Founder monthly | $100/mo | Ultra licence immediately + named credits + monthly maintainer call invitation |

**Note on the 1-month wait**: One month at $5 = $5, which equals the
"Coffee" tier exactly. Faster issuance than Open Collective's 3-month
wait, because GitHub Sponsors has a 6%–10% take-rate for the first
year (GitHub pays the fees during the first 12 months of
"Sponsorship Acceleration Program" eligibility) — Auz needs less
buffer for fee-coverage.

## Page README copy (`.github/FUNDING.yml` + the sponsorable profile)

```
# Hi, I'm Auz. I build WatchNexus.

WatchNexus is a self-hosted media server that replaces Jellyfin, the
*arr stack, Jellyseerr, and a handful of other tools with a single
.NET 10 + React 18 application. 73 modules across three licence
tiers. Native installers for Windows, Fedora, Debian, Arch, Docker.
Source-available on GitHub; commercial-friendly licence model.

I work on it solo, from Toronto, Canada.

**What does sponsoring me do?**

- Funds the code-signing certificates (Windows EV, Apple Developer)
  that make WatchNexus installable on Windows and macOS without your
  OS treating it as malware.
- Pays for the licence server (`licenses.watchnexus.ca`) and CDN.
- Keeps me writing code instead of taking a side job.

**What does sponsoring me get you?**

Lifetime WatchNexus licences (Standard, Pro, or Ultra depending on
tier). Founder badge in the app credits. Direct line on Discord.

**Transparency**

Every dollar I receive — including through GitHub Sponsors — is
logged at [opencollective.com/watchnexus](https://opencollective.com/watchnexus).
GitHub Sponsors funds flow through the same public ledger.

If you'd rather back via:
- Kickstarter campaign: [link]
- Indiegogo: [link]
- Open Collective (transparent ledger): [link]
- Patreon: [link]
- One-off coffee: [Buy Me a Coffee link]

All paths lead to the same product and the same accountability.

Thank you for considering it. Either way, you can use WatchNexus
free under the Standard tier's evaluation mode (30 days, no licence
key required).
```

## `.github/FUNDING.yml` (lives in the repo)

```yaml
github: [auz-larocque]
patreon: watchnexus
open_collective: watchnexus
ko_fi: # don't use — Buy Me a Coffee covers this
tidelift: # don't use — incompatible with proprietary client tiers
custom:
  - "https://watchnexus.ca/donate"
  - "https://www.buymeacoffee.com/watchnexus"
```

This file lights up the "Sponsor" button on the GitHub repo page
and gives users every option.

## GitHub-Sponsors-specific perks (not available on other platforms)

To incentivise sponsorship on GitHub specifically:

> **GitHub-only**: All paid GitHub Sponsors at $15+/month for 6+
> months earn the **"Code Contributor" badge** in the WatchNexus app,
> with a direct link to their GitHub profile from the in-app credits
> screen. This is the *only* tier that links to an external profile;
> all other named-in-credits backers are listed as plain text.

This converts well with the developer audience.

## Operational mechanics

### Fee structure

- GitHub Sponsors: 0% for the first 12 months (GitHub absorbs fees)
- After 12 months: ~6% platform + 2.9% + $0.30 Stripe = ~9%
- Effective fee for the first year: ~3%
- Effective fee after year 1: ~9%

### Webhook integration

Hook GitHub Sponsors → WatchNexus licence server:
```
POST https://licenses.watchnexus.ca/api/cellar/issue
Sponsor event: tier=pro, amount=$15, user=@nickname
```

GitHub Sponsors webhooks include sponsor amount and tier ID, so the
licence server can issue the right tier automatically.

### Tax handling for Canadian creator

- GitHub Sponsors pays in USD via Stripe Canada.
- Funds arrive monthly.
- Auz reports as self-employment income on Canadian T1.
- W-8BEN is filed once during onboarding; tells the IRS Auz is a
  non-US person and reduces US withholding to 0%.

## Launch sequence

| Day | Action |
|---|---|
| T-30 | Apply to be a GitHub-sponsorable account (3-day review) |
| T-21 | Set up sponsor tiers; complete W-8BEN |
| T-14 | Page goes live, unlisted (you can view it but it doesn't appear in GitHub search yet) |
| T-7 | Add the FUNDING.yml to the repo so the Sponsor button appears |
| Day 0 (Kickstarter launch) | Promote the GitHub Sponsors page on the campaign sidebar |
| Day 30 (post-Kickstarter) | First monthly sponsorship cohort hits the 1-month threshold; licence keys issue |
