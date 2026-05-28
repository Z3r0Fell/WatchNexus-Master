# Stretch Goals — Beyond $15,000

> Stretch goals unlock when the campaign hits the dollar amount on the
> tile. They apply identically across Kickstarter, Indiegogo, and
> Open Collective. Patreon/GHSponsors backers count toward stretch goals
> using the dollar value of their first 6 months of pledges.

## 🥇 $15,000 — Base Goal (already detailed in `budget.md`)
**Ships:** v1.0.0 RTP fully signed across Windows + Linux + Docker, 12 months of licence-server hosting, 3 months of dev runway for v1.1 polish.

---

## 🌐 $25,000 — Native macOS Build (Unlocks the deferred platform)

WatchNexus has always intentionally skipped macOS because the dev cycle
for Gatekeeper notarisation, universal binaries (Intel + Apple Silicon),
and macOS-specific tray/AppKit integration is expensive.

**At $25K we ship:**
- Universal `.pkg` + `.dmg` installers for macOS Sonoma+ (Intel + Apple Silicon).
- Native macOS tray icon (replacing the cross-platform GTK helper).
- Notarised + stapled binaries (Gatekeeper-clean on first launch).
- Homebrew tap (`brew install watchnexus`).
- Apple-Silicon hardware transcoding profile in Strudel (VideoToolbox).

**Backer impact:** Mac homelabbers can finally run WatchNexus
natively. All existing license tiers cover macOS automatically — no
"Mac tax".

**Why $25K specifically:** Apple Developer subscription is already
covered at the base goal; the extra $10K covers ~6 weeks of macOS-
specific dev work plus a refurbished M2 mini for the build pipeline
($600) and notarisation/CI runner costs.

---

## 📱 $40,000 — Mobile Companion Apps (iOS + Android)

A native Flutter app for both stores that pairs with your WatchNexus
server.

**Ships:**
- WatchNexus Mobile for iOS (App Store) and Android (Google Play +
  F-Droid).
- Continue-watching, "next-up" notifications, remote-control of
  Chromecast / AirPlay / DLNA from the phone, offline-sync queue
  for Popsicle, request submission for Parfait/Menu.
- Tier-aware (logs into your server, inherits your licence).

**Backer impact:** the homelab-from-your-couch experience. All licence
holders get the mobile apps free; no separate mobile tier.

**Why $40K specifically:** Apple's App Store fee ($99/yr already
covered), Google Play one-off ($25), but the bulk is 8 weeks of
Flutter dev + a paid Android-app review consultancy ($1,500 — to avoid
the typical app-store rejection cycle).

---

## ☁️ $60,000 — Hosted Sync Service (Marshmallow Cloud)

The Marshmallow module already does cloud sync if you BYO storage
(S3 / B2 / R2). At $60K we run the storage **for you** — a
batteries-included sync tier.

**Ships:**
- `https://sync.watchnexus.ca` — managed service for watchlist /
  progress / settings sync across devices.
- Free tier: 100 MB sync data per account.
- Paid tier: $3/mo for 5 GB + cross-device device-up-to-10.
- End-to-end encryption with client-held keys (zero-knowledge for the
  operator).

**Backer impact:** none of this is mandatory; the existing
self-hosted Marshmallow path stays free. The hosted service exists for
users who want a "just works" cloud anchor.

**Why $60K specifically:** Hetzner storage box ($30/mo × 12 = $360),
plus 12 weeks of engineering for the multi-tenant orchestrator + KMS,
plus the GDPR/PIPEDA legal review ($1,200) for running personal data
in Canada/EU.

---

## 🌟 $90,000 — The "Forever Tier" (No more annual signing renewals)

This is the Big One.

**Ships:**
- An endowment fund for **5 years** of Windows EV + Apple Developer +
  Microsoft Partner + licence-server hosting renewals.
- Hardware security module ($1,500 Yubikey 5 FIPS) for the official
  signing key, with the public certificate fingerprint published on
  `watchnexus.ca` so users can verify any installer they download.
- 3 years of recurring penetration tests against the licence server
  (Cure53 or similar — ~$8,000/test).
- The remaining ~$50K extends the dev runway from 3 months to 12 months.

**Backer impact:** WatchNexus is funded enough to operate as a real
software company through the v1.0 → v2.0 cycle without ever needing
another crowdfunding round. Every backer at $35+ gets the "Founding
Backer" badge in the app forever.

**Why $90K specifically:** This is what it costs to *not* have to ask
again until the v3.x cycle.

---

## What if we blow past $90K?

We **don't** keep raising goals. Past $90K, the campaign closes the
stretch ladder and instead announces a **public AMA + roadmap vote**:

> The next $10K — and every $10K after — funds **one community-voted
> module** added to the official roadmap. Backers at $35+ get one vote
> each.

This avoids the classic crowdfunding trap where stretch goals balloon
into commitments the dev can't deliver.

---

## Stretch-goal credibility note

Every stretch goal above has a **deliverable cost estimate** sourced
from real vendor pricing (Hetzner, Apple, SSL.com, Cure53), not napkin
math. If a stretch goal funds, the budget breakdown for that goal will
be added to the public ledger at `opencollective.com/watchnexus` within
7 days of campaign close.
