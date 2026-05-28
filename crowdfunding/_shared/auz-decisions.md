# Things Auz Should Decide / Acquire Before Launching

> A short list of pre-launch decisions and acquisitions that aren't
> documented elsewhere because they're personal-to-Auz, not template-
> able. Tick them off before going live on Kickstarter.

## Identity decisions

- [ ] **Decide your public-facing name on each platform.** Real name
      (Auz Larocque) is required on Kickstarter, Indiegogo, Patreon,
      GitHub Sponsors. Handle-only (@watchnexus) is acceptable on
      Open Collective, Buy Me a Coffee.
- [ ] **Get a separate "professional" email** — `auz@watchnexus.ca`
      or similar. Don't mix campaign communication with your
      personal inbox.
- [ ] **Set up Calendly** at `calendly.com/watchnexus` for the
      $500 "1-hour deployment call" reward fulfilment. Use the free
      plan; reward winners get a 30-day Calendly link.

## Financial setup

- [ ] **Open a separate Canadian bank account** for WatchNexus
      revenue. Don't mix with personal banking — makes tax filing
      and accountant fees easier.
- [ ] **Open a Wise.com account** for USD → CAD conversion on
      international platform payouts (Kickstarter pays in USD, OC in
      USD, GitHub Sponsors in USD, BMC in USD; only Indiegogo flexes
      to CAD on payout).
- [ ] **Pick an accountant** — `Bench.co`, `Wave.com Pro`, or a
      local Toronto bookkeeper. Budget $300/yr (already in
      `_shared/budget.md`).

## Communication channels

- [ ] **Create a WatchNexus Discord server** (free) with channels:
      `#announcements`, `#support`, `#feature-requests`, `#meta`,
      `#founders` (gated), `#patrons` (gated).
- [ ] **Set up Postmark.com** ($15/mo) for transactional licence-key
      delivery emails. Configure SPF/DKIM/DMARC for
      `licenses.watchnexus.ca`.
- [ ] **Set up the public press email** at
      `press@watchnexus.ca`. Forward to your professional email.
- [ ] **Set up `refunds@watchnexus.ca`** with auto-reply pointing at
      the 14-day refund policy.

## Legal nice-to-haves

- [ ] **Privacy policy** at `watchnexus.ca/privacy` — required by
      Stripe Connect for OC, GitHub Sponsors. Use a generator like
      `iubenda.com` (~$30/yr).
- [ ] **Terms of service** at `watchnexus.ca/terms`.
- [ ] **EULA** at `watchnexus.ca/legal/eula` (already drafted in
      `/LICENSE.html` and `/LICENSE.txt`).
- [ ] **Cookie banner** on `watchnexus.ca` and `demo.watchnexus.ca` if
      using analytics — required by EU backers.

## Demo environment

- [ ] **Spin up `demo.watchnexus.ca`** (read-only) on a Hetzner CX11
      ($5/mo). Seed with TMDB sample data. Demo credentials shared
      publicly: `demo@watchnexus.ca` / `demo`.
- [ ] **Pre-record fallback video** in case `demo.watchnexus.ca`
      crashes during a press hit. ~3-minute screencast of the
      WatchNexus dashboard, library, Strudel, and Settings.

## Press kit assets

- [ ] **Take all screenshots** listed in `_shared/brand-kit.md`
      "Screenshots needed" section.
- [ ] **Generate the "tier matrix" marketing image** — three
      columns (Standard / Pro / Ultra) with checkmarks for each
      tier's unlocked features. Use the colour palette in
      `brand-kit.md`.
- [ ] **Export the press kit zip** containing all logos, screenshots,
      press release, bio, and budget breakdown. Host at
      `watchnexus.ca/press/kit.zip`.

## Campaign video

- [ ] **Choose between Option A (personal) or Option B (technical)**
      in `_shared/video-script.md`. Pre-launch instinct: Option A
      for Kickstarter, Option B for Indiegogo.
- [ ] **Record the screen capture footage** in OBS Studio. Export
      at 1920×1080 H.264 mp4.
- [ ] **Generate voiceover** via ElevenLabs ($5/mo Starter plan).
      Voice "Charlie" or "Brian" for Option A; "Daniel" for
      Option B.
- [ ] **Source music** from Epidemic Sound ($15/mo) or freePD.com
      (free).
- [ ] **Edit in DaVinci Resolve** (free). Final cut should be 60s
      exactly for max conversion.

## Pre-launch press outreach

- [ ] **Build the press contact list**:
      - Sean Hollister, Ars Technica
      - Ravie Lakshmanan, The Hacker News
      - Abhishek Prakash, It's FOSS
      - Linux Magazine editorial team
      - Phoronix tip line
      - Self-Hosted Podcast (Alex Kretzschmar)
      - Selfh.st newsletter (Ethan Phelps-Goodman)
- [ ] **Send the embargoed press release** 5 business days before
      launch. Offer demo access in the email.
- [ ] **Pre-write Reddit posts** using the templates in
      `_shared/subreddit-post-templates.md`.

## Stretch: things to think about but not blocking

- [ ] **Decide on Printify vs Redbubble** for the swag store.
      Printify wins on quality and integration; Redbubble wins on
      product variety. Recommend Printify.
- [ ] **Design 5 codename stickers** for the swag store (Strudel,
      Chowder, Fondue, Parfait, Bastion). Use the brand-kit colour
      palette.
- [ ] **Decide if you want a YouTube presence** — a 6-month plan of
      one architecture deep-dive per month would compound visibility
      meaningfully.

## What you don't need before launch (resist scope creep)

- ❌ Native mobile apps (stretch goal at $40K)
- ❌ Native macOS build (stretch goal at $25K)
- ❌ A "WatchNexus Cloud" hosted offering
- ❌ A full documentation site (the existing `/help` page covers it)
- ❌ Localised translations (English-only is acceptable for v1.0)
- ❌ A formal company name / incorporation (sole proprietorship is
      fine for the first $30K of revenue)
