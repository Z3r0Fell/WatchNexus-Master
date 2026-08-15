# Risk Register — Public-facing Risks Section

> Copy this into each platform's "Risks and Challenges" section. Be
> honest. Backers reward honesty far more than optimism.

## What could go wrong, and how I'm handling it

WatchNexus v1.0.1 RTP is **code-complete today**. The campaign isn't
funding "an idea" — it's funding the **legitimacy** that turns the
build into a software product real users can install without their OS
yelling at them. That changes the risk profile from typical
crowdfunding (where the product doesn't exist yet) to something closer
to "buy a licence, support the launch."

That said, three real risks deserve naming.

### 1. Code-signing certificate issuance delays

**Risk:** SSL.com EV certificates ship via FedEx hardware token; the
identity-verification process can take 5–10 business days. If the cert
ships late, Windows installers continue to show SmartScreen warnings on
day-one downloads.

**Mitigation:**
- I'm starting the EV verification process **the day this campaign hits
  $5K** (lower than the full $15K, so we're not waiting until close).
- The unsigned Linux + Docker installers ship on day-one regardless —
  Linux/Docker users get a clean experience immediately.
- Windows installers will be **signed but with low SmartScreen
  reputation** until ~2,500 unique downloads accumulate, which usually
  takes ~30 days post-launch. I'll document the SmartScreen "More info
  → Run anyway" path in the README until reputation builds.

### 2. Apple App Store / Notarisation rejection

**Risk:** Apple's notarisation pipeline occasionally rejects builds for
inscrutable reasons (entitlements, hardened-runtime quirks). This only
affects the **macOS stretch goal at $25K**, not the base $15K
deliverables.

**Mitigation:**
- I'll run the build through `notarytool` in CI before claiming the
  macOS stretch is shipped — no announcing victory until Apple's
  service confirms a clean notarisation.
- If notarisation drags on, the macOS build still ships as a
  *signed-but-not-notarised* `.pkg` (gatekeeper requires one extra
  click, no scary red banner).

### 3. Solo-dev bus factor

**Risk:** I'm one human (Auz Larocque). If I get hit by a bus, the
project stalls.

**Mitigation:**
- The repository, all signing certificates, the licence-server source
  code, and the deployment runbooks live in a **dead-man's switch**
  with my partner. If I miss a 90-day check-in, the entire codebase
  becomes public-domain under AGPLv3 and the licence server is open-
  sourced.
- All backers' licence keys remain valid forever — the licence-server
  source is published so backers can self-host activation if the
  hosted service ever goes down.

## What is *not* a risk

- **The product not existing.** v1.0.1 RTP code is complete and live in
  the repo; you can compile and run it today.
- **Features not landing.** Stretch goals expand the roadmap, but the
  base $15K goal is fully covered by deliverables that already exist.
- **Vendor lock-in.** WatchNexus uses no proprietary integrations — all
  third-party services (TMDB, qBittorrent, SABnzbd, MakeMKV) are
  swappable for alternatives without breaking the app.

## Refund policy

If the campaign hits goal and a backer changes their mind within 14
days of receiving their licence key, the licence is revoked and the
pledge is refunded minus platform fees. Email `refunds@watchnexus.ca`.

## Public ledger

Every dollar in and out of the project is tracked at
`https://opencollective.com/watchnexus`. The ledger is open whether you
backed via Kickstarter, Indiegogo, Patreon, or directly — there's no
"behind the curtain" pot of money.
