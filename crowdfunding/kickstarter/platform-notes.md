# Kickstarter-Specific Notes

## Account setup

1. Create a Kickstarter account under **Auz Larocque** (real name,
   matches your government ID for Stripe verification).
2. Add a profile photo and bio referencing WatchNexus + GitHub.
3. Verify your identity (Stripe-powered KYC; takes 1–3 days).
4. Connect a Canadian bank account for payout (Canadian creators must
   use a CAD bank account; Kickstarter handles the USD → CAD
   conversion at campaign close).

## Project review

Kickstarter reviews every Technology / Apps project before allowing
launch. Review takes **3–5 business days**. Submit no later than
**T-14** (two weeks before intended launch day).

Common review hold-up: they ask for proof the team can deliver.
Pre-empt by linking the GitHub repo and the demo URL in the project
description.

## Fee structure (already in the budget)

- Kickstarter: 5% of pledged total
- Stripe: 3.0–5.0% + $0.30/transaction (Canada rate)
- Worst-case combined: 10.0% → $1,500 on the $15K goal

## Canadian creator tax handling

- Kickstarter payouts arrive **net of platform fees** but **gross of
  tax**.
- Auz will need to report the funded amount as self-employment income
  on the Canadian T1 (line 13700 Business income).
- GST/HST: above $30,000 in 4 consecutive quarters Auz must register
  for GST/HST. Below that, no GST collection required.
- Accountant prep budgeted at $300 in `_shared/budget.md`.

## Day-one Kickstarter mechanics

- Pledges are **authorised** (not charged) on pledge day.
- At campaign close, if goal is met, all pledges are **collected**
  over 14 days.
- About 8–12% of pledges fail collection (declined cards). Plan for
  $15K goal → $13.5–13.8K actually collected.

## Buffer for failed pledges

The $15K budget already covers this — line items can absorb a 10%
collection shortfall without missing any deliverable except possibly
the "Trademark filing" ($380), which slips to month 4 instead of
month 1 if collection runs light.

## Anti-shenanigan: pledge-bombing

A few weeks before close, an aggrieved competitor or troll may pledge
a large amount with no intention of paying, to artificially inflate
your % funded and then cancel pre-close, dropping you back below goal.

Kickstarter is generally good at flagging these, but watch for:
- A single backer at >$2,000 with a brand-new Kickstarter account.
- A cluster of $500 pledges from the same IP block.

Report to Kickstarter Trust & Safety immediately if you see this.

## Updates strategy specifically tuned to Kickstarter algorithm

- Post **every Tuesday and Friday at 10:00 ET** during the campaign.
  Tues/Fri at 10am is when the Kickstarter "Recommended" algorithm
  re-evaluates project momentum.
- Keep updates **under 250 words**. Long updates have lower open
  rates.
- **Tag at least one image** in every update — the algorithm rewards
  visual updates.

## What to do if you over-deliver early

If WatchNexus hits 100% in the first 48 hours (entirely possible if
r/selfhosted picks it up), do NOT relax. The "1000% funded" projects
all had stretch goals teed up before launch. Yours are ready in
`_shared/stretch-goals.md`.

## Kickstarter-only perk to highlight

Lifetime updates including paid major versions, for all
Kickstarter-tier backers. This is intentionally NOT available on
Indiegogo or any other platform — it gives Kickstarter the strongest
"why pledge here" angle.

Phrase it on the campaign page as:

> "Kickstarter-exclusive: every backer at $15 or higher gets free
> upgrades to all future paid major versions of WatchNexus, forever.
> When v2.0 ships in 2027 and other users have to pay for it, you
> don't. This is our way of saying thank you for being early."
