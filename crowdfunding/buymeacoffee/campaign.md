# Buy Me a Coffee — WatchNexus

> The lowest-friction support option. Always-on. Soft-launches with
> Kickstarter on day 1. Buy Me a Coffee (BMC) is **not** intended to
> raise the $15K target alone — it's the "this is too cheap to think
> about" tip jar.

## Page basics

| Field | Value |
|---|---|
| **Username** | `watchnexus` (URL: `buymeacoffee.com/watchnexus`) |
| **Display name** | WatchNexus (no real name required) |
| **Tagline** | "I built the self-hosted media server that replaces your *arr stack. Buy me a coffee?" |
| **Profile image** | WatchNexus brand mark |
| **Country** | Canada |
| **Currency** | USD |
| **Payout** | Stripe (Canadian bank account) |

## Why Buy Me a Coffee at all?

BMC fills three niches the other platforms don't:

1. **No account required.** Backers can tip without making a BMC
   account. Reduces friction from "I want to give you $5" to "done"
   to under 30 seconds.
2. **Lowest fees** of the recurring/tip platforms (5% platform fee
   + Stripe). No 10–13% taken off the top like Open Collective.
3. **Membership feature** competes with Patreon for monthly support
   at lower take-rate. Some users prefer BMC's UX.

## Page content

### Hero copy

```
☕ **Hi! I'm Auz. I built WatchNexus.**

WatchNexus is a self-hosted media server that replaces Jellyfin
+ the *arr stack + Jellyseerr + a stack of other homelab tools
with one application. I work on it solo from Toronto.

If WatchNexus saved you a Saturday troubleshooting your Docker
compose file, consider buying me a coffee. Or four.

**☕ One coffee** ($5) — a public thank you on watchnexus.ca

**☕☕☕ Three coffees** ($15) — Standard licence delivered to your
email (lifetime)

**🍰 A small cake** ($35) — Pro licence delivered to your email
(lifetime)

**🎂 A real cake** ($75) — Ultra licence delivered to your email
(lifetime)

**🥳 Throw a party** ($300) — Ultra licence + your name in the
WatchNexus app credits + a Discord Founder role

No account required to tip. Apple Pay / Google Pay / card all work.

If you'd rather support monthly, my Patreon is at
[patreon.com/watchnexus] and GitHub Sponsors at
[github.com/sponsors/auz-larocque].
```

### Custom pricing buttons

BMC allows custom-priced "coffees". Pre-configure these:

| Button | Price | What it triggers |
|---|---|---|
| ☕ One coffee | $5 | Email auto-thanks; added to watchnexus.ca/credits |
| ☕☕☕ Three coffees | $15 | Webhook → licence server → Standard licence emailed |
| 🍰 Cake | $35 | Webhook → Pro licence emailed |
| 🎂 Real cake | $75 | Webhook → Ultra licence emailed |
| 🥳 Throw a party | $300 | Ultra licence + manual queue for next named-credits drop |

### Memberships (BMC's recurring-tier feature)

BMC memberships are essentially Patreon-lite. Set up two tiers
that mirror the Patreon offering:

| Membership | Monthly | Equivalent |
|---|---|---|
| ☕ Coffee Subscriber | $5/mo | Mirrors Patreon "Casual Supporter" |
| 🛠 Pro Subscriber | $15/mo | Mirrors Patreon "Pro Member" |

**Don't** offer the higher-tier subscriptions (Ultra, Founder,
Patron) on BMC. Push those to Patreon — BMC's higher-tier UX is
weaker.

## BMC-specific perks

BMC's strength is **public thank-you messages**. Every coffee
purchase generates a public message that appears on the BMC page.
Lean into this:

- Pin the **most recent 5 coffees** prominently.
- Periodically post "thank-you" replies to coffees that include a
  good question.
- Once a month, post a public "what I built thanks to your coffees"
  update.

## Operational mechanics

### Fee structure

- BMC platform fee: 5% of incoming funds
- Stripe processing: 2.9% + $0.30/transaction
- Effective total: ~8.2% on a $15 coffee

### Webhook integration

Hook BMC → WatchNexus licence server:
```
BMC supports "Membership webhook" and "Supporter webhook" out of
the box. Point both at:
POST https://licenses.watchnexus.ca/api/cellar/issue
```

The licence server inspects the amount field, maps to a tier, and
emails the licence key.

### Tax handling

- BMC pays out USD via Stripe Canada to Auz's Canadian bank
- W-8BEN filed during onboarding
- Report as self-employment income on Canadian T1

## Cross-platform notes

- BMC backers are logged in the Open Collective ledger as
  non-financial contributors.
- Anyone tipping over $300 on BMC is manually escalated to the
  "named in credits" queue (BMC doesn't have a great UX for
  high-value tippers, so this is hand-processed).

## What NOT to use BMC for

- ❌ The main funding goal narrative — keep that on Kickstarter +
  Indiegogo.
- ❌ Long-form dev updates — those live on Patreon and the OC ledger.
- ❌ "Lab Sponsor" or "Patron" tier pledges over $500 — push to
  Kickstarter / Patreon where the UX handles high-value backers
  better.

## Launch sequence

| Day | Action |
|---|---|
| T-3 (pre-Kickstarter) | BMC page goes live with hero copy |
| Day 0 (Kickstarter launch) | BMC link added to Kickstarter sidebar + every press release |
| Always-on | Once a week, post a "thanks to recent coffees" message |
