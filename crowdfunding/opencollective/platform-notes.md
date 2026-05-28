# Open Collective Platform Notes

## Fiscal host choice

Auz needs a fiscal host because solo Canadian developers can't take
direct funding under "WatchNexus" as a legal entity (you'd need to
incorporate first). Two options:

### Option A — Open Source Collective (recommended)

- US 501(c)(6) non-profit
- 10% fiscal-host fee
- Handles all back-office work: receipts, expense reimbursement,
  contributor records, year-end summary
- **Caveat:** funds are held in US dollars; Auz withdraws to Canadian
  bank via Wise.com (≤1% currency conversion)

### Option B — Open Collective Europe

- Belgian non-profit
- 5–8% fiscal-host fee (lower than OSC)
- More complex onboarding (you need to demonstrate the project is
  open-source-friendly — WatchNexus's source-available model meets
  their bar)
- Funds in EUR; conversion via Wise

**Recommendation:** start with OSC (faster onboarding, established
homelab-software precedent — Jellyfin used to fiscal-host through
OSC).

## Fees

- Fiscal-host fee: 10% (OSC) or 5–8% (OCE)
- Stripe processing: 2.9% + $0.30/transaction
- Effective total: ~13% (OSC) or ~10–11% (OCE)

This is the highest fee structure of any platform, but you're
buying **all the back-office machinery** (tax forms, expense
receipts, audit log) at a single rate.

## Onboarding timeline

- Apply to OSC fiscal-host: 3-day review
- Get approved → create the WatchNexus collective: same day
- First contributor can pledge: same day
- First payout to Auz: monthly cycle (15th of each month)

## Public ledger discipline

Open Collective's value proposition is the **public ledger**. To
maintain that:

1. **Every expense over $100 gets its own expense submission**
   with receipt attached.
2. **Expenses under $100 get batched** into a single monthly
   "operational expenses" submission with all receipts attached.
3. **Each expense has a 1-line explanation** of which campaign-
   stated bucket it falls into (signing, hosting, runway, etc.).

This level of transparency is the trust anchor for the whole
project. Skipping it defeats the entire purpose of being on OC.

## Cross-platform reconciliation

Every backer from Kickstarter / Indiegogo / Patreon / GitHub
Sponsors / BMC is added to the OC "Contributors" section as a
**non-financial contributor** with their cumulative pledge total
across all platforms. This requires manual reconciliation in a
spreadsheet, but it's worth doing — it's the only way to give every
backer credit.

Suggested cadence: reconcile once a quarter (post-Kickstarter
close, then quarterly).

## Withdraw mechanics

- OC funds sit in a US fiscal-host account
- Auz submits an "expense reimbursement" with a 1-line memo: "Monthly
  developer runway payment"
- OC approves (Auz is the only admin so this auto-approves)
- Payout via Wise.com to Auz's Canadian bank
- Wise converts USD → CAD at mid-market rate ± 0.4%
- Funds land in 1–2 business days

## What NOT to put on OC

- ❌ Anti-piracy talking points — OC's audience leans
  open-source / FLOSS-aligned; over-emphasising piracy avoidance
  reads as defensive
- ❌ Hard licensing language — OC backers know what source-available
  means; restating it three times reads like you're trying to hide
  something
- ❌ Stretch goal flame ladders — OC isn't a launch-event platform;
  treat it as the ongoing operations channel
