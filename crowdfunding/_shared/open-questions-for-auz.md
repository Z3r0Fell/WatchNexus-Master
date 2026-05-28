# Open Questions for Auz

> Things I don't know but the campaign would be stronger if I did.
> Answer these when you can; defaults will be used if you skip.

## High-impact (answer if you can)

### 1. Your real legal name / preferred capitalisation
- "Auz Larocque" is my current draft. Is that correct?
- Any preferred capitalisation? ("Auz LaRocque", "auz larocque",
  "Authur Larocque", etc.)
- Default: **Auz Larocque** (Kickstarter / Indiegogo / Patreon /
  Github Sponsors require legal name match).

### 2. Your city / province
- The press release says "Toronto, Ontario" as a placeholder.
- Confirm: which city/province should appear in the press release
  and the "creator location" field on Kickstarter?
- Default: **Toronto, Ontario, Canada**.

### 3. Your GitHub username
- The README mentioned "z3r0fell" as the GitHub URL.
- Confirm: should we list the WatchNexus repo as
  `https://github.com/z3r0fell/watchnexus` everywhere?
- Default: **z3r0fell/watchnexus** based on the QA URL in the
  archived dev README.

### 4. Discord server existence
- Is there already a WatchNexus Discord? Or do you want me to plan
  for one (free; quick to set up)?
- Default: **assume one will be created** before launch (covered in
  `auz-decisions.md`).

### 5. Demo environment
- Is `demo.watchnexus.ca` already running, or does this need to
  spin up pre-launch?
- Default: **needs to spin up**; budget includes a $5/mo Hetzner
  CX11 for it.

## Medium-impact (nice to know)

### 6. Bank / Stripe / Wise account setup
- Do you already have a Canadian Stripe account? Wise.com? Separate
  Canadian bank account for WatchNexus revenue?
- Default: **assume yes** for Stripe (Indiegogo + Kickstarter need
  it for Canadian creators); **plan to set up Wise.com pre-launch**
  for international USD → CAD conversions.

### 7. Press list — anyone specific to add?
- I drafted a press list in `_shared/press-release.md` with Sean
  Hollister, Ravie Lakshmanan, Abhishek Prakash, etc.
- Anyone you already have a relationship with that should be
  prioritised?
- Default: **start with the generic list** in the press release.

### 8. Discord / Twitter / Mastodon handle availability
- "watchnexus" handle confirmed available on which platforms?
- Default: **assume available** on Patreon, BMC, GitHub Sponsors,
  Open Collective, Discord; verify before launch.

### 9. Existing email infrastructure
- `watchnexus.ca` domain owns the MX records? You can send/receive
  `auz@watchnexus.ca`, `press@watchnexus.ca`, etc.?
- Default: **assume yes**; Postmark is budgeted for transactional
  email; Google Workspace or Fastmail for human-readable email.

### 10. Existing payment processor relationships
- Have you already signed up for Stripe, or do we need to factor in
  Stripe Canada's identity-verification time (~3 days)?
- Default: **assume not yet signed up**; the launch checklist allows
  3 weeks for full payment-processor setup.

## Low-impact (cosmetic / personal)

### 11. Preferred pronouns in press copy
- I used "Auz" + "he" as the default in the press release. Adjust
  if needed.
- Default: **first-name "Auz" only; neutral pronouns where possible**.

### 12. Bio / headshot
- Do you want to include a personal headshot on the Kickstarter
  campaign? A stylised avatar? No image?
- Default: **assume you'll add a stylised avatar** (less personal
  exposure for a solo dev).

### 13. Profile description across platforms
- Should I use the same 250-word bio everywhere, or tailor per
  platform?
- Default: **same bio across platforms** for simplicity; tailor only
  on Kickstarter's "About this project" intro.

### 14. Swag store readiness
- Confirmed: no swag at launch, post-launch Printify roll-out.
- Question: what brand-mark variant (light? dark? wordmark?) do
  you want on the first batch of stickers / shirts?
- Default: **wordmark on shirts, square brand mark on stickers**.

### 15. Backer-only Discord roles
- I drafted a tier ladder. Any specific role names you want?
- Default: **roles named to match Kickstarter tier names** —
  "Supporter", "Pro Member", "Ultra Member", "Founder",
  "Patron".

## Critical (must answer before launch)

### 16. Bank verification timeline
- Stripe + Wise may need 2 weeks of verification before pre-
  launch funding flows. Have you started this process?
- If not: **start TODAY**. This is on the critical path.

### 17. Code-signing certificate ordering timeline
- SSL.com EV verification takes 5-10 business days. We can't
  start the cert process until the campaign launches (or you pre-
  fund $400 yourself).
- Decision: **do you have $400 in personal float** to pre-order the
  EV cert so it's ready on day 1, or do we wait until the campaign
  is at $400+ pledged?
- Default: **wait until $400 pledged** (no personal float
  required); the unsigned Windows installer ships in the interim.

### 18. v1.0.0 RTP shipping plan
- Is v1.0.0 RTP going up on GitHub releases **before** the campaign
  launches, or **on launch day**?
- Default: **on launch day** — gives the campaign maximum "the
  product exists, here it is" credibility.

### 19. Demo credentials policy
- Should `demo.watchnexus.ca` allow public sign-up / interaction,
  or be read-only with shared `demo / demo` credentials?
- Default: **read-only with shared credentials** — prevents abuse
  and reduces support load during launch week.

### 20. Day-1 traffic plan
- If r/selfhosted picks up the campaign and traffic spikes 100x,
  is the production `watchnexus.ca` website on infrastructure that
  can handle it?
- Default: **assume static-hosted on Netlify or Cloudflare Pages**
  with auto-scaling; verify before launch.

---

Reply to any of these you have answers for. The others get sensible
defaults applied during the next iteration.
