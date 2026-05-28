# Patreon Platform Notes

## Plan choice

Patreon has three plans:

| Plan | Platform fee | When to use |
|---|---|---|
| **Lite** | 5% | Default. Auz starts here. |
| **Pro** | 8% | Add when you hit ~50 monthly patrons. Adds analytics dashboards + member-management tools. |
| **Premium** | 12% | Skip — adds a built-in CRM you don't need as a solo dev. |

Start on Lite. Migrate to Pro at month 6 if backer count justifies.

## Onboarding

1. Create Patreon account as **Auz Larocque** (or "WatchNexus" if
   they allow handle-only — they do, for "creator" accounts)
2. Verify email + phone
3. Connect Stripe Canada
4. Complete W-8BEN (required for non-US creators)
5. Set up at least 3 tiers before going public

## Charge cadence

Patreon defaults to **charging on the 1st** of each month. There's
also a "per-creation" model where you charge when you post — **don't
use this**. Backers want predictable monthly support, and
per-creation creates incentive to over-post.

## Don't post too much

Patreon's biggest creator pitfall: over-promising posting cadence,
then under-delivering. Backers churn.

**Safe commitment:** 2 paid + 1 free post per month. Over-deliver,
never under-deliver.

## Free vs paid posts

- **Free posts** drive new backer acquisition. Use them for product
  updates, milestones hit, public Q&A, version-release announcements.
- **Paid posts** retain existing backers. Use them for architecture
  deep-dives, behind-the-scenes thinking, roadmap voting threads.

Hard line: **never** put product-critical information behind a paid
post. Release notes are always free. Bug fix announcements are always
free.

## Patreon-specific features

- **Polls**: paid-tier only. Use for v1.x feature voting.
- **Direct messages**: enable for $35+ tiers. Reply within 24h.
- **Discord integration**: connect via Patreon's official Discord
  bot. Backer roles auto-assign based on tier.
- **Email newsletters**: built-in. Use for the monthly retention
  email summarising the past month's posts.

## Tax handling

- Patreon issues 1099-K if US-resident with >$20K/yr or 200
  transactions
- For Canadian creators: Patreon doesn't issue a 1099 but provides a
  manual annual summary
- Report as self-employment income on Canadian T1
- GST/HST registration required once revenue exceeds $30K/4-quarters

## When to launch Patreon

**After** Kickstarter closes (day 30+). Patreon during Kickstarter
splits backer attention.

If you launch Patreon earlier than Kickstarter Day 30, you'll see
Patreon income cannibalise Kickstarter pledges (people pledge $5/mo
on Patreon instead of $15 on Kickstarter, costing you ~$135 in
year-1 Kickstarter LTV).

## Backer migration from Kickstarter → Patreon

Send a single "Kickstarter has closed, here's how to keep supporting"
email to all Kickstarter backers on day 31. Soft-pitch Patreon as
"if you'd like to keep supporting WatchNexus monthly."

Expected conversion: 5–10% of Kickstarter backers become Patreon
patrons in month 1. Of those, ~50% retain through month 6.

## Discord linkage

Patreon's Discord integration auto-roles backers. Configure:
- Casual Supporter → Discord role "Supporter"
- Pro Member → role "Pro Member"
- Ultra Member → role "Ultra Member"
- Founder Tier → role "Founder" + access to private "founders"
  channel
- Patron → all above + access to private "patrons" channel

## Don't do

- ❌ Per-creation charging
- ❌ Posting more than promised (set realistic cadence, deliver
  consistently)
- ❌ Gating product features behind Patreon
- ❌ Forcing pledged tier-jumps (let backers pick their own monthly
  amount)
- ❌ Long delays in licence-key issuance (auto-issue via webhook within
  24h of first month payment)
