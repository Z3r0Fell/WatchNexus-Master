# Budget Breakdown — Where the $15,000 Goes

> Public-facing. Use this exact table on every platform's "Where will the
> money go?" section. All amounts USD. Platform fees calculated from the
> $15K **gross** figure.

## The big picture

| Bucket | Amount | % | Why |
|---|---|---|---|
| **Code-signing certificates** | $1,800 | 12.0% | Make Windows/macOS recognise WatchNexus as a legitimate publisher; eliminate SmartScreen/Gatekeeper warnings for backers |
| **OS-store legitimacy fees** | $700 | 4.7% | Apple Developer Program, Microsoft Partner Center, optional store listings |
| **Platform + payment fees** | $1,500 | 10.0% | Kickstarter 5% + Stripe 3–5%, or Indiegogo 5% + payment processor |
| **Developer runway** | $9,000 | 60.0% | 3 months of focused dev time to ship the v1.1 polish pass, fix issues raised by the first wave of paying users, write proper end-user docs |
| **Licence server infrastructure** | $1,200 | 8.0% | 12 months of `licenses.watchnexus.ca` hosting, backups, SSL renewals |
| **Buffer / surprises** | $800 | 5.3% | Tax-prep, accounting, refunds for any backer who changes their mind |
| **Total** | **$15,000** | **100%** | |

## Detailed line items

### 1. Code-signing certificates — $1,800 / 12%

| Item | Cost | Vendor (preferred) | Why this one |
|------|------|--------------------|--------------|
| Windows **EV** Code Signing Certificate (1 year) | $400 | **SSL.com** | EV gives **instant SmartScreen reputation** (no "this app could harm your computer" warnings on day one); cheaper than DigiCert ($600) and Sectigo ($500) |
| Windows EV — second year prepay | $350 | SSL.com | Locks in renewal pricing; campaign covers two years so backers aren't hit with warnings if year-2 funding lags |
| Apple Developer Program (1 year) | $99 | Apple | Required to **notarise** macOS builds + ship `.pkg` / `.dmg` installers that don't trigger Gatekeeper "unidentified developer" |
| Apple Developer Program (2nd year prepay) | $99 | Apple | Same reasoning as Windows |
| Linux PGP signing key + Yubikey HSM | $55 | Yubico | Hardware-rooted signing key so the build pipeline can be audited; replaces a soft-key that could be exfiltrated |
| Reproducible-build infrastructure | $200 | misc | Sigstore Cosign + transparency-log fees so every release artifact has a cryptographic provenance record |
| Signing-fees buffer | $597 | — | Reserve for re-issues, lost tokens, cross-signing |

### 2. OS-store legitimacy — $700 / 4.7%

| Item | Cost | Notes |
|------|------|-------|
| Microsoft Partner Center registration | $120 | One-time. Enables `winget` listing + future Store path. |
| Apple Developer Program (already counted above) | $0 | — |
| Snapcraft / Flatpak / AUR maintainer fees | $0 | Free; included in dev time |
| Unraid Community App listing | $0 | Free; template already shipped |
| TrueNAS app catalogue submission | $200 | Includes packaging review fee |
| Code-signing certificate for SSL on `releases.watchnexus.ca` (CDN) | $0 | Let's Encrypt; ops cost only |
| Trademark filing — "WatchNexus" (Canada Intellectual Property Office) | $380 | One-off ($330 application + $50 registration) — protects the name |

### 3. Platform + payment fees — $1,500 / 10%

This is what Kickstarter / Indiegogo / Stripe take off the top. Worst
case (Kickstarter 5% + Stripe 5%) is **10%** of the gross, hence $1,500.
Best case (Open Collective + Stripe at 3.4%) drops it to ~$510 — any
surplus from coming in under platform-fee budget rolls into developer
runway.

### 4. Developer runway — $9,000 / 60%

3 months × $3,000/mo. Below Canadian minimum-wage equivalent for a
full-time engineer; this is **not** a salary, it's "I won't have to take
a side job while finishing v1.1." Deliverables for the 3-month window:

- **v1.0.1** (week 1–2) — fixes from the first 100 paying users.
- **v1.0.2** (week 3–4) — telemetry opt-in, crash reporting via Sentry,
  Bastion 2FA backup-code regeneration UX.
- **v1.1.0** (week 5–10) — Strudel Phase-6 (auto-quality ladder for
  transcoded titles), Chowder bandwidth scheduling polish, Parfait UI
  parity with Jellyseerr web.
- **v1.1.x patch line** (week 11–12) — bug bash + documentation
  sprint (proper end-user docs at `docs.watchnexus.ca`).

### 5. Licence server infrastructure — $1,200 / 8%

| Item | Cost | Notes |
|------|------|-------|
| Hetzner CX22 (`licenses.watchnexus.ca`) — 12 months | $84 | €6.74/mo × 12 |
| Hetzner CPX21 (`releases.watchnexus.ca` CDN-fronted release host) | $144 | €11.49/mo × 12 |
| Cloudflare Pro (better DDoS + bot-fight for licence check endpoint) | $240 | $20/mo × 12 |
| Postmark email (licence key delivery, transactional) | $180 | $15/mo × 12; survives 10k emails/mo |
| Backups (Backblaze B2) | $60 | $5/mo × 12 |
| Domain renewals (`watchnexus.ca`, `.com`, `.app`) | $90 | 3 domains × ~$30 |
| Status-page (BetterUptime / OnlineOrNot) | $108 | $9/mo × 12 |
| Reserve for support tooling (Logflare or Axiom logs) | $294 | $24.50/mo × 12 |

### 6. Buffer — $800 / 5.3%

- Bookkeeping software (Wave Pro): $200
- Accountant prep fee for year-end (CRA self-employment): $300
- Refund / chargeback float: $200
- Backer-survey software (BackerKit) bridge fees: $100

## What if we over-fund?

Anything over $15K flows directly into the **stretch-goal pipeline**
(see `stretch-goals.md`). No money goes into a generic slush fund —
every stretch milestone has a fixed budget and ships a fixed deliverable.

## What if we under-fund (Indiegogo flexible / Open Collective)?

Priority order if we land below $15K:

1. **First $2,500** → code-signing (Windows EV + Apple Developer). This
   is non-negotiable; without it the v1.0.1 release would be flagged as
   malware by SmartScreen.
2. **Next $1,200** → licence-server infrastructure for 12 months.
3. **Next $9,000** → developer runway (scaled down to 1–3 months).
4. **Surplus** → trademark + Microsoft Partner Center + TrueNAS.

Backers get the same rewards regardless of campaign-level funding; only
the *pace* of v1.1 development scales with the funded amount.

## Transparency

Every dollar spent is logged at `https://opencollective.com/watchnexus`
(public ledger). All other platforms link to that ledger as the source
of truth.
