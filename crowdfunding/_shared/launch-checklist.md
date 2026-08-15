# Pre-Launch Checklist — Two Weeks Out

> Tick these off before flipping the switch on Kickstarter. Each item
> has an owner (you, Auz) and an estimated time-to-complete.

## Two weeks before launch (T-14)

- [ ] **Verify the Kickstarter draft is reviewable** — submit for KS
      pre-launch review, which takes 3–5 business days.
- [ ] **Set up the Indiegogo draft** in InDemand mode (no need to
      launch yet, just hold the URL).
- [ ] **Spin up the demo at `demo.watchnexus.ca`** — read-only, seeded
      with TMDB sample data so press + backers can poke at the real
      app in their browser. ~$5/mo Hetzner CX11.
- [ ] **Publish `https://watchnexus.ca/press`** with high-res logos,
      screenshots, the press release, and a "media kit" zip.
- [ ] **Email the press list** (Self-Hosted Show, It's FOSS, Linux
      Magazine, Phoronix). Embargoed press release attached. Offer
      pre-launch access to the demo.
- [ ] **Reddit verification** — DM the r/selfhosted mods asking what
      they need to allow a campaign launch post; same with
      r/HomeServer, r/JellyfinCommunity (carefully — competitive
      project to Jellyfin).
- [ ] **Schedule the launch post** on Mastodon, Bluesky, and X for
      09:00 ET on launch day.

## One week before launch (T-7)

- [ ] **Open Collective page goes live** — set funding goal to "$15K
      stretch from campaign", description points at the active
      Kickstarter URL.
- [ ] **GitHub Sponsors page goes live** — monthly tiers mirror
      reward-tiers.md.
- [ ] **Buy Me a Coffee page goes live** — single tip-jar URL.
- [ ] **Patreon page goes live but unlisted** — make it visible only
      after Kickstarter closes.
- [ ] **Lock the licence-server** to `prod` config; no schema migrations
      during the 30-day campaign window.
- [ ] **Deploy v1.0.1** to GitHub releases with both signed (if cert
      arrived) and unsigned artifacts available.
- [ ] **Record the campaign video** (see `video-script.md`).
- [ ] **Test the donation webhook end-to-end** — make a $1 self-pledge,
      verify the licence key arrives in your inbox.

## Launch day (T-0)

- [ ] **09:00 ET** — Kickstarter goes live, watchnexus.ca/launch URL
      redirects to it.
- [ ] **09:05** — Post to r/selfhosted, r/HomeServer (different titles
      per sub, no copy-paste; see `subreddit-post-templates.md`).
- [ ] **09:15** — Submit to Hacker News (Show HN). Title:
      "Show HN: WatchNexus — self-hosted media server replacing Jellyfin + *arr stack".
      Avoid Tuesday morning ET (peak competition).
- [ ] **09:30** — Mastodon + Bluesky + X launch posts go up.
- [ ] **10:00** — Lemmy crossposts (`!selfhosted@lemmy.world`,
      `!homelab@lemmy.ml`).
- [ ] **12:00 ET** — Email-list blast to anyone who signed up on
      watchnexus.ca during the pre-launch window.
- [ ] **17:00** — First "thank you for the support" update on
      Kickstarter even if funding is at $0 — sets the cadence for
      backer comms.

## Day 1–7

- [ ] **Daily Kickstarter update** at 09:00 ET. Short. Cover one
      thing: a milestone hit, a question answered, a new piece of press
      coverage.
- [ ] **Respond to every comment within 4 hours** on Kickstarter +
      Discord. Backers reward responsiveness disproportionately.
- [ ] **Monitor SmartScreen reputation** on the Windows installer; if
      anyone reports a warning, post the "More Info → Run anyway"
      workflow in a pinned comment.

## Day 15 — Indiegogo InDemand opens

- [ ] **Flip Indiegogo to live** in InDemand mode. Cross-link from
      Kickstarter.

## Day 30 — Close

- [ ] **Kickstarter closes** at the same hour it opened.
- [ ] **Post the "we made it / we didn't" update** within 2 hours of
      close.
- [ ] **Patreon goes public** — direct evangelists who want ongoing
      support there.
- [ ] **BackerKit survey opens** for licence-key fulfilment.

## Day 30–45 — Fulfilment

- [ ] **Licence keys issued** to all $15+ backers within 7 days of
      BackerKit survey close.
- [ ] **"Named in credits" update** shipped in the v1.0.1 release
      with all $300+ backers' names baked into the in-app credits
      screen.
- [ ] **1:1 deployment calls** scheduled for $500+ backers via Calendly.
- [ ] **First post-funding monthly transparency update** on Open
      Collective ledger — every dollar logged.

## Anti-failure-mode list (things that nuke campaigns)

1. **Going silent.** Daily-update cadence is the single biggest
   predictor of cross-day-15 momentum. Set calendar reminders.
2. **Letting refund requests pile up.** Reply within 24 hours, no
   exceptions. Bad word-of-mouth at the refund counter kills
   conversion.
3. **Launching during a major US holiday week or Steam sale week.**
   Avoid the week before Christmas, the week of Black Friday, the
   week of the Steam Summer Sale, and Game Awards week.
4. **Promising stretch goals you can't budget for.** Every stretch
   goal in `stretch-goals.md` has a costed line. Don't add ones that
   aren't.
5. **Engaging with bad-faith comments.** If a comment is hostile, post
   the link to `/docs/installbuilder.md` (proof the work is real) and
   stop responding. Don't argue.
