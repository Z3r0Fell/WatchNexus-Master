# Buy Me a Coffee Platform Notes

## Onboarding

1. Create BMC account under handle `watchnexus` (no real name required
   for the public-facing profile — Stripe verification still needs it
   internally)
2. Verify email
3. Connect Stripe Canada account
4. Complete W-8BEN during Stripe onboarding (filed automatically)

Onboarding takes ~10 minutes total. Fastest platform to set up.

## Fee structure

- BMC platform fee: 5%
- Stripe processing: 2.9% + $0.30/transaction
- Effective fee on a $5 tip: ~8.2%
- Effective fee on a $75 tip: ~5.4%

## Payouts

- Funds available immediately after each transaction
- Weekly or monthly auto-payouts (Auz's choice — pick weekly for cash
  flow visibility)
- USD → CAD via Stripe Canada at mid-market rate

## Memberships

BMC's "memberships" feature mirrors Patreon. Use sparingly:
- Set up **only the $5/mo and $15/mo tiers**
- Higher tiers ($35+, $100+, $500+) go on Patreon — BMC's UX for high-
  value backers is weaker

## Payment methods

BMC supports:
- ✅ Credit / debit card
- ✅ Apple Pay
- ✅ Google Pay
- ✅ PayPal (in some regions)
- ❌ Crypto (don't enable — operational overhead, no benefit)

Apple Pay + Google Pay are the differentiators. A backer who would
balk at "enter card details" on Kickstarter taps "Pay with Apple Pay"
on BMC and is done in 8 seconds.

## Webhooks

BMC offers two webhook types:
- **Supporter webhook**: fires on every one-off coffee purchase
- **Membership webhook**: fires on every monthly membership charge

Point both at `https://licenses.watchnexus.ca/api/cellar/issue` and
the licence server handles tier mapping based on the amount field.

## Tax handling

- BMC payouts arrive as Stripe transfers — no 1099 needed
- Auz reports total annual BMC income on Canadian T1 line 13700
- Receipts auto-saved in BMC's transaction history; PDF export
  available for accountant

## Promotion strategy

BMC is the **conversion footer link** on every other platform:
- Kickstarter sidebar: "Can't pledge through Kickstarter?
  [Buy me a coffee instead]"
- Patreon page: "One-off support? [BMC link]"
- GitHub README: "Like the project? [Buy me a coffee]"
- Every WatchNexus app page: small "☕" icon in the footer linking
  to BMC

## Public messages

BMC's strength is **public thank-you messages**. Every coffee
purchase prompts the backer to leave a public message visible on the
BMC page.

Tactics:
- **Pin the most recent 5** above the fold
- **Reply to every message** within 24h (the backer gets notified;
  encourages future tips)
- **Highlight notable messages** in monthly Patreon / OC updates

## Pre-built coffee buttons

Configure on the BMC dashboard:

| Button label | Price | Quantity supported |
|---|---|---|
| ☕ One coffee | $5 | Yes (let backer buy 1-N) |
| 🥯 Coffee + bagel | $15 | Yes |
| 🥪 Lunch | $35 | Yes |
| 🍰 Cake | $75 | No (single-tap only) |
| 🥳 Throw a party | $300 | No (single-tap only) |

The "Yes / No" column controls whether the backer can buy multiples
of that button in one transaction. Allow multiples on low-value
items; restrict high-value items to one per transaction (prevents
typos).

## Cross-platform reconciliation

Every coffee purchase logged in the Open Collective ledger as a
non-financial contributor with cumulative pledge total.

## What NOT to do on BMC

- ❌ Long-form dev updates (those live on Patreon / OC)
- ❌ Hard-pitch the v1.0 campaign (BMC backers respond to "easy
  thanks" framing; campaign-style copy reads as needy)
- ❌ Add gimmicky tiers ("Buy me a yacht $50,000") — BMC is for
  micro-tips; high-value tiers go on Kickstarter / Patreon

## Always-on cadence

- **Weekly** thank-you post on BMC profile recognising recent coffees
- **Monthly** "what your coffees funded this month" post linking to
  the OC ledger
- **Per-release** post when a new WatchNexus version ships
