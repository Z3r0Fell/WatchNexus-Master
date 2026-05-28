# Indiegogo Platform Notes

## Account setup

1. Create an Indiegogo account under **Auz Larocque** (real name).
2. Verify identity (Stripe-powered KYC).
3. Connect Canadian bank account; Indiegogo pays in USD.

## Fees

- Platform fee: 5%
- Payment processing: 3% + $0.30 (Stripe)
- Combined: ~8% on the $15K goal — better than Kickstarter's
  worst-case 10%

## InDemand mechanics

- Free to enable
- Page stays live indefinitely after the 30-day "launch" window
- Stretch goals continue to count cumulative funding past day 30
- Indiegogo pays out InDemand earnings on the **15th of each
  month** (separate from the original campaign payout)

## Canadian tax

Same as Kickstarter — self-employment income, report on Canadian T1
line 13700. No GST registration until $30K threshold.

## Verification badges

Indiegogo offers a "Verified Creator" badge — requires submission of
government ID + a business plan summary. Worth getting; gives social
proof on the campaign page.

## Common rejection reasons (avoid these in the campaign draft)

1. **Software claims without proof of work.** Solution: link the
   GitHub repo and the live demo URL in the campaign description
   ABOVE the fold.
2. **Reward tiers that look like resale** (e.g., "we'll ship you a
   Raspberry Pi pre-loaded with WatchNexus" — Indiegogo would treat
   that as an e-commerce listing, not a campaign).
3. **Stretch goals without budget justification.** Solution: every
   stretch goal in `_shared/stretch-goals.md` has explicit cost
   reasoning.

## Day 15 launch checklist (when Indiegogo opens during Kickstarter)

- Banner on Kickstarter campaign page linking to Indiegogo
- New "Mid-campaign launch" Kickstarter update
- One press release update (not a fresh release) sent to top 5 press
  contacts: "Indiegogo InDemand now live — back from anywhere in the
  world"
- Mastodon / Bluesky / X cross-posts

## InDemand evergreen strategy

After day 30, when the Kickstarter window has closed but Indiegogo
stays open:
- Update the Indiegogo page hero copy: "Kickstarter has closed but
  InDemand pledges still unlock everything — pledge now to lock in
  pre-launch pricing forever."
- Post one InDemand-only update per month: "Last month X new
  backers, stretch-goal progress, here's what's next."
- Run targeted Reddit ads on r/selfhosted and r/HomeServer using
  the Indiegogo "ads-friendly" badge.
