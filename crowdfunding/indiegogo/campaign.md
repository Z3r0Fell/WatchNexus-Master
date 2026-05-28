# Indiegogo Campaign — WatchNexus v1.0 (InDemand mode)

> Launches **day 15** of the Kickstarter campaign.
> Flexible-funding model (keep what you raise) — no all-or-nothing
> risk. Real-name: **Auz Larocque**. 30-day visible campaign window,
> then converts to InDemand (continuous post-30-days).

## Why Indiegogo overlapping at day 15?

Two reasons:
1. **Captures Kickstarter spillover.** People who heard about the
   campaign but missed the all-or-nothing window still want to back.
2. **InDemand keeps the page live forever.** After day 30, the page
   stays open in InDemand mode — backers can still pledge for licence
   keys for months after.

## Project basics

| Field | Value |
|---|---|
| **Project title** | WatchNexus — Self-Hosted Media Server, Powered by Your Hardware |
| **Tagline** | The 73-module replacement for Jellyfin + the *arr stack. Single binary. Three tiers. Sign once, install forever. |
| **Category** | Technology → Software |
| **Funding goal** | **$15,000 USD** (matches Kickstarter; if Kickstarter funded, Indiegogo goal stays as a "stretch beyond" total target) |
| **Funding model** | Flexible (keep all funds raised) |
| **Duration** | 30 days visible, then InDemand indefinitely |
| **Creator name** | Auz Larocque |
| **Country** | Canada |

## Pitch (Indiegogo readers are slightly more "consumer", lead differently than Kickstarter)

```
**WatchNexus turns your homelab into a single-app streaming
service that you own.**

If you've ever:
- Argued with your spouse about which streaming service has *The
  Bear* this month
- Spent a Saturday troubleshooting Jellyfin's transcoding pipeline
  because Disney+ pushed a 4K episode you wanted to add to your
  library
- Lost track of which podcast app, ebook reader, and music server
  you have running on which Docker container

...WatchNexus is the answer.

One application. 73 modules. Three licence tiers. Native installers
for Windows, Fedora, Debian, Arch, and Docker. Your hardware, your
library, your rules.

Built in Ontario, Canada by a solo developer who got tired of
maintaining eleven services to do the job of one. Version 1.0 is
done; this campaign funds the code-signing certificates that make
Windows and macOS trust the installer on day one.
```

## Sections (Indiegogo renders these in tabs)

### "Story" tab

Same content as Kickstarter's "About this project", but with
**three differences**:

1. **Open with a personal hook** — Indiegogo viewers respond to
   creator stories more than feature lists. Lead with:

   > "Two years ago my apartment had an 11-service Docker compose
   > file glued together with prayers. Tonight, my parents'
   > Christmas presents are all in one library on a Raspberry Pi 5
   > that sits on top of their router. They watch what they want.
   > They don't see the gears. That's WatchNexus."

2. **Slightly more emphasis on stretch goals** — Indiegogo's
   "flexible funding" model means stretch goals are the marketing
   hook, not the safety net. Lead with the macOS stretch in the
   intro paragraph.

3. **Add a "Why Indiegogo?" section** explaining why both
   Kickstarter and Indiegogo are open:

   > "Kickstarter's all-or-nothing model funded the code-signing
   > minimums. Indiegogo's flexible model funds the things beyond
   > that — every dollar pledged here adds runway, advances the
   > stretch-goal roadmap, and continues to support the project
   > after the 30-day window closes."

### "FAQ" tab

Same as Kickstarter FAQ + add three Indiegogo-specific entries:

**Q: Can I pledge here if I already backed on Kickstarter?**
A: Yes. Many backers do — add-on Indiegogo pledges add to your
total benefits (extra licences, named-in-credits upgrade, etc.).
Email backers@watchnexus.ca and we'll merge your rewards.

**Q: What happens after the 30-day Indiegogo window?**
A: The page stays live in InDemand mode indefinitely. You can pledge
for licence keys for as long as the campaign page exists. Stretch
goals continue to unlock based on cumulative total (Kickstarter +
Indiegogo combined).

**Q: Why two crowdfunding sites at the same time?**
A: To cover both audiences. Kickstarter backers tend to be project-
funders ("I want this thing to exist"); Indiegogo backers tend to
be early adopters ("I want this thing now"). Both groups are welcome.

### "Backers" tab

Indiegogo shows backers a public count and a "recent backer" feed.
This is great for momentum. Pin a "Day 1 backer" badge on early
adopters and feature their reviews in the campaign Story tab as
campaign progresses.

## Reward tiers (Indiegogo allows "Perks")

Identical to Kickstarter's tiers (`_shared/reward-tiers.md`), with
two Indiegogo-specific perks added:

| Perk | Price | What you get |
|---|---|---|
| **"Day 100 Bundle"** (Indiegogo InDemand only) | $50 | Standard licence + a 1-hour onboarding call (normally only at $500). Available only after day 60 of InDemand. |
| **"Late Bloomer"** (Indiegogo InDemand only) | $90 | Pro licence + early access to the v1.1 alpha build (normally only at $300+). Available only after day 90 of InDemand. |

These exist because InDemand backers (who come in late) miss the
"early-bird" Kickstarter advantage; these perks give them a reason to
pledge late.

## Indiegogo-specific platform mechanics

- **Fee structure:** 5% platform fee + ~3.5% payment processing =
  ~8.5% total. (Slightly cheaper than Kickstarter at worst-case 10%.)
- **Payouts:** Indiegogo releases funds within 15 business days
  of campaign close (Kickstarter is 14 days, roughly even).
- **InDemand mode** is free to enable. Funds collected post-30-days
  arrive in the same payout cycle as the campaign close.

## Indiegogo trust badges to enable

Indiegogo's campaign-creator dashboard has a few opt-in badges:
- ✅ **"Forever-funded"** — toggle ON (since Kickstarter campaign
  already funded the project)
- ✅ **"Free shipping"** — toggle ON (digital delivery, no shipping)
- ✅ **"Verified team"** — provide GitHub link and demo URL for
  staff review
- ❌ **"Coming soon"** — toggle OFF (the product exists today)

## Cross-promotion with Kickstarter

On day 15 launch:
- Add a banner to the Kickstarter campaign page: "Backers in
  countries Kickstarter doesn't support — back us on Indiegogo
  instead." (Kickstarter doesn't support backers from certain
  countries; Indiegogo accepts global pledges.)
- Update the Kickstarter FAQ with a link to Indiegogo.
- On the Indiegogo page, link back to Kickstarter as "primary
  campaign — pledge there for the lifetime-major-version perk."

## Closing-day actions (Indiegogo day 30)

- Post a "We made it / we didn't / either way we keep going"
  update on the Indiegogo page.
- Flip the Indiegogo page to InDemand mode.
- Send the BackerKit survey to Indiegogo backers on the same day
  Kickstarter backers receive theirs (so cross-platform backers
  don't get confused).
