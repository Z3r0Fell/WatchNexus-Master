# GitHub Sponsors Platform Notes

## Eligibility

GitHub Sponsors requires:
- ✅ A verifiable GitHub account (Auz already has one)
- ✅ A 2FA-protected account
- ✅ A linked Stripe account for payouts
- ✅ Either an organisation account OR an individual account; both
  qualify

**Recommendation:** sponsor via personal account `@auz-larocque`
first (faster onboarding, no organisation review needed), then
optionally migrate to `@watchnexus` organisation account in 6 months
if the project grows.

## The 12-month fee waiver

GitHub waives platform fees for the **first 12 months** of any
sponsor account. This is the single best reason to launch
GitHub Sponsors **at the same time as Kickstarter**, not later —
every month you delay is a month of fee-waiver runway burned.

After 12 months:
- GitHub keeps ~6% platform fee
- Stripe processing: 2.9% + $0.30/transaction
- Effective fee: ~9%

## Matching funds (the other secret weapon)

GitHub's "Sponsors Matching Fund" matches sponsorship contributions
up to $5,000 per sponsored account, in eligible regions (US, Canada,
EU, UK, others). Auz qualifies as a Canadian individual.

**To get matching:** apply through the Sponsors dashboard. Approval
is ~2 weeks. The matching applies to one-off AND recurring
sponsorships received during the matched period.

This effectively doubles your first year of GitHub Sponsors income
up to $5K. Combined with the 12-month fee waiver, GitHub Sponsors
becomes the highest-efficiency funding channel: 0% fees on the first
$5K, **plus** GitHub gives you a matching $5K. That's $10K from the
first $5K raised.

## Sponsor profile checklist

- ✅ Profile photo: WatchNexus brand mark (1080×1080)
- ✅ Cover image: dashboard screenshot (1280×640)
- ✅ Bio: 250-word summary of WatchNexus + your role
- ✅ Featured work: link to the WatchNexus repo
- ✅ FUNDING.yml in the repo points the "Sponsor" button at the
  account
- ✅ At least 3 sponsor tiers configured (one-time and recurring)
- ✅ Custom "thank you" message for new sponsors (configure under
  Account → Sponsorship Profile)

## Webhook setup

GitHub Sponsors webhooks are configured at:
**Sponsors dashboard → Webhooks → Add webhook**

Point at: `https://licenses.watchnexus.ca/api/cellar/issue`

Event payload includes:
- `sponsor.login` (GitHub username)
- `sponsor.email` (the email backing the Stripe charge)
- `tier.monthly_price_in_dollars`
- `tier.is_one_time`
- `created_at`

The licence server inspects the price, maps to a tier (Standard /
Pro / Ultra), issues a key, and emails the backer.

## Profile copy

See `campaign.md` for the README copy. Paste verbatim into the
GitHub Sponsors "About" section.

## FUNDING.yml file (lives in the repo root: `.github/FUNDING.yml`)

```yaml
github: [auz-larocque]
patreon: watchnexus
open_collective: watchnexus
custom:
  - "https://www.kickstarter.com/projects/auz-larocque/watchnexus"
  - "https://www.indiegogo.com/projects/watchnexus"
  - "https://www.buymeacoffee.com/watchnexus"
```

## Tax handling

- US-based GitHub Sponsors income arrives via Stripe → Wise → CAD
  bank
- W-8BEN filed during onboarding (Auz is non-US person)
- US withholding: 0% (W-8BEN claim)
- Canadian tax: report as self-employment on T1

## Don'ts

1. **Don't fund Patreon migrations from GitHub Sponsors.** Backers
   who pledge on GitHub specifically chose that platform — don't
   ask them to move.
2. **Don't link the "1-hour deployment call" reward tier to GitHub
   Sponsors only.** Make sure it's available across all platforms.
3. **Don't post sponsor-only updates** unless they're actually
   exclusive. GitHub Sponsors backers reward consistent monthly
   posts as much as Patreon backers do.
