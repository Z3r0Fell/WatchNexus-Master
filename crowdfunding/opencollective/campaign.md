# Open Collective Page — WatchNexus

> Always-on. Soft-launches **with** Kickstarter on day 1, stays live
> forever as the official transparent funding ledger. Open Collective
> supports fiscal hosting — for Auz as a solo dev in Canada, the
> "Open Collective Europe" or "Open Source Collective" fiscal host is
> the right choice (handles invoicing, payouts, and tax forms).

## Page basics

| Field | Value |
|---|---|
| **Collective name** | WatchNexus |
| **Slug** | `watchnexus` (URL: `opencollective.com/watchnexus`) |
| **Tagline** | Transparent funding ledger for WatchNexus — self-hosted media server replacing the *arr stack |
| **Currency** | USD |
| **Goal** | $15,000 USD (matches Kickstarter) |
| **Fiscal host** | Open Source Collective (501(c)(6), 10% fiscal-host fee — covers all back-office work) |
| **Country** | Canada (Auz) / United States (fiscal host) |
| **Creator handle** | watchnexus |

## Why Open Collective alongside Kickstarter?

Open Collective serves a **different purpose** — it's not a
crowdfunding platform, it's a transparent expense ledger. Every
dollar received and every dollar spent is publicly viewable.

For a single-developer software project, this is the trust anchor.
Kickstarter / Indiegogo / Patreon backers can be pointed at
`opencollective.com/watchnexus` as proof their money was spent on
what was promised.

## Page content

### About (the page hero copy)

```
**WatchNexus is a self-hosted media server built and maintained by a
solo developer in Ontario, Canada.**

This Open Collective page exists for one reason: **transparency**.
Every dollar that funds WatchNexus — whether it comes from
Kickstarter, Indiegogo, Patreon, GitHub Sponsors, Buy Me a Coffee,
or directly here — is logged in this collective's public ledger.
Every dollar spent has a receipt attached.

Pledge here if you'd like to support WatchNexus ongoing with a
monthly contribution, or as a one-off donation. You'll get the same
reward tiers as the Kickstarter campaign — Standard licence ($15
or $5/mo for 3 months), Pro ($35 or $15/mo for 3 months), Ultra
($75 or $35/mo for 3 months).
```

### "Our team" section

Single member:
- **Auz Larocque** (admin) — Sole maintainer

### "Contributors" section

This is auto-populated as backers pledge. Display the GitHub avatars
of every contributor with their pledge total.

### "Tiers" (recurring contribution tiers)

| Tier name | Amount | Frequency | Description |
|---|---|---|---|
| **Coffee Supporter** | $5 | Monthly | Public credits page on watchnexus.ca + Discord supporter role |
| **Standard Backer** | $5 | Monthly | After 3 months at this tier, receive a Standard licence (lifetime). Same perks as Coffee Supporter. |
| **Pro Backer** | $15 | Monthly | After 3 months at this tier, receive a Pro licence. Includes Standard perks + Discord "Backer" role. |
| **Ultra Backer** | $35 | Monthly | After 3 months at this tier, receive an Ultra licence. Includes Pro perks + early access to v1.1 release candidates. |
| **Founder** | $100 | Monthly | Founder-tier Discord role + Ultra licence (immediate, no waiting period) + named in app credits + invite to monthly maintainer call. |

### "Expenses" tab (this is the magic)

Every expense WatchNexus spends gets posted here as an expense
request, with the receipt attached. Sample expenses for the first
month:

| Date | Description | Amount | Receipt |
|---|---|---|---|
| [post-funding] | SSL.com EV Windows code-signing certificate | $400 | PDF invoice from SSL.com |
| [post-funding] | Apple Developer Program 1-year subscription | $99 | Receipt from Apple |
| [post-funding] | Hetzner CX22 (licences.watchnexus.ca) — Q1 hosting | $21 | Invoice from Hetzner |
| [post-funding] | Cloudflare Pro (rate-limit + DDoS) — annual | $240 | Invoice from Cloudflare |
| [post-funding] | Postmark transactional email — 6 months | $90 | Invoice from Postmark |

Every expense over $100 is publicly itemised. Smaller expenses are
batched into a monthly summary expense.

### "Updates" tab

Monthly "where we are" post:
- Month 1 (post-funding): "Where the money went so far" — itemised
  spend summary, screenshots of signing certs working, link to the
  v1.0.1 signed releases.
- Months 2–12: monthly progress reports tied to dev runway
  milestones.

### "Conversations" tab

Backer chat. Used for product-feedback discussions that are too
detailed for Discord or GitHub Issues. Pinned topic: "Roadmap
voting" (when stretch goals fund the per-$10K module commission
mechanic kicks in here).

## Operational mechanics

### Fee structure (transparent, in the budget)

- Open Source Collective fiscal-host fee: 10% of incoming funds
- Stripe payment processing: 2.9% + $0.30/transaction
- Total: ~13% (highest of any platform)

This is **intentional**. The 10% fiscal-host fee covers tax-form
generation, expense-receipt management, audit trails, and legal
indemnity — all of which Auz would otherwise have to set up as a
sole proprietor in Canada at much higher cost.

### Cross-platform reconciliation

Every backer from Kickstarter / Indiegogo / Patreon / GitHub
Sponsors / Buy Me a Coffee is logged in the Open Collective
"Contributors" section as a non-financial contributor with their
total pledge amount across all platforms.

This is the "single source of truth" view. A backer who pledged
$50 on Kickstarter, $35 on Patreon, and bought a $9 coffee on BMC
shows up here as a $94 cumulative contributor.

### Licence-key issuance

When a recurring contributor hits 3 months at $5/mo (Standard), a
webhook fires:
```
POST https://licenses.watchnexus.ca/api/cellar/issue
{
  "email": "{contributor email}",
  "tier": "standard",
  "source": "opencollective",
  "external_id": "oc-{contributor_id}"
}
```

The licence server issues a key, emails it, and logs the event in
the OC public ledger.

If the contributor downgrades or cancels, the key remains valid —
they earned it.

### Why this works for solo devs

Open Collective handles the parts that paralyze solo founders:
- Quarterly tax-form generation (CRA T4A-NR for international
  contributors)
- Receipt collection for expense reimbursement
- Public audit trail that satisfies "where did my money go" before
  the question is even asked

For ~13% all-in fees, Auz outsources all of that to a US 501(c)(6)
non-profit that exists specifically to run fiscal hosting for
open-source projects.

## Open Collective vs other platforms

Open Collective is **always-on**. Kickstarter / Indiegogo are
campaign-event windows. Patreon / GitHub Sponsors / BMC are
recurring/tip jars.

Open Collective is the **shared ledger** all of them point at. When
a Kickstarter backer says "how do I know you spent the money on
what you promised?", the answer is one URL.

## Launch sequence

| Day | Action |
|---|---|
| T-7 | Apply to Open Source Collective fiscal host (3-day review) |
| T-3 | Page goes live with the placeholder hero copy |
| T-1 | Hero copy updated to reflect the launching Kickstarter |
| Day 0 (Kickstarter launch) | OC page promoted in Kickstarter sidebar + every press release |
| Day 30 | First "thank you" post-funding update with itemised spend so far |
| Month 1+ | Monthly expense summary + roadmap update |
