# Brand Kit Pointers — Assets You Need Before Launching

> Anything not yet produced is flagged **TODO**. Almost everything else
> already lives in the repo.

## Logos (✅ exist in repo)

| Use case | File | Where |
|---|---|---|
| Square brand mark (light) | `watchnexus-icon-light.png` (1024×1024) | `/build/installbuilder/resources/watchnexus.ico` (multi-res); originals in `/website/assets/images/` |
| Wordmark | `watchnexus-logo.png` (4088×3848 master, 400px export ready) | `/build/installbuilder/resources/watchnexus-logo.png` |
| Header banner | `watchnexus-banner.png` (1280×896) | `/website/assets/images/` |
| Favicon | `favicon.png` | `/website/assets/images/` |

For Kickstarter / Indiegogo header images (1024×576 recommended), crop
the banner. The press kit at `/docs/press-kit/images/` has additional
sizes if needed.

## Campaign video — **TODO**

Every platform recommends 30–90 second video. Suggested script in
`video-script.md`. You'll need:

- A screen-recorder pass through the WatchNexus dashboard, library, and
  Strudel rip pipeline (~45 seconds of footage).
- Voiceover over the screen recording. If you don't want to record your
  own voice, **ElevenLabs** ($5/mo Starter plan) produces broadcast-
  quality narration; use the voice "Charlie" or "Brian" for a calm,
  techie tone.
- B-roll: hardware shots of a NAS, a homelab rack, a TV with the
  WatchNexus dashboard on it. If you don't have these, royalty-free
  stock at `pexels.com` covers it ("homelab", "server rack", "tv
  streaming" search terms).
- Music: Epidemic Sound or Artlist (~$15/mo); royalty-free
  alternatives at `freepd.com`.

## Screenshots needed (✅ likely already taken)

Each platform asks for 5–8 still images. Targets:

1. Dashboard with libraries (`/dashboard`)
2. Library detail with poster grid (`/movies` or `/tv`)
3. Strudel rip-pipeline progress (`/strudel`)
4. Settings → Tier card showing Standard / Pro / Ultra unlocks
5. Help & docs page (`/help`)
6. Mobile-responsive view (Discover page on phone width)
7. Tier-matrix screen (a marketing image, see `tier-matrix.md`)

If any are missing, take them with Firefox's screenshot tool (`Ctrl-
Shift-S`) at 1920×1080 against a Standard install seeded with TMDB demo
data.

## Colour palette (already in CSS variables, exported here for graphic work)

```
#0b1220  Background (deep slate)
#111a2c  Panel
#e6edf6  Foreground ink
#94a3b8  Muted text
#f5a524  Accent (warm amber)
#1f2a3f  Rule / divider
```

Use accent `#f5a524` for CTA buttons and badges on campaign pages — it
matches the in-app tier-locked-feature highlighting so backers see
visual continuity from campaign → product.

## Font stack

Inter for body, JetBrains Mono for code blocks. Both are free + open.
On Kickstarter / Indiegogo body copy you can't override fonts (they
use their own system), so this only matters for graphic assets.

## Swag — **TODO** (post-funding, not blocking)

You mentioned getting stuck on Printify/Redbubble. **Don't ship swag in
the v1.0 campaign rewards.** Instead:

1. Land the campaign with licence-only rewards (no fulfilment risk).
2. Post-funding, open the Printify store at your own pace.
3. Push a 20% discount code to all $35+ backers when the store opens
   (we tease this in `reward-tiers.md` as a stretch unlock at $25K).

Recommended initial swag SKUs once the store opens (Printify line
items — POD so zero inventory risk):

- T-shirt with the wordmark on the chest (Bella+Canvas 3001, $15–18
  POD, sell at $28)
- Sticker pack: 5 codename stickers (Strudel, Chowder, Fondue, Parfait,
  Bastion) on holographic vinyl ($3 POD, sell at $9)
- Coffee mug with "Self-Hosting Saves Lives" tagline ($8 POD, sell at
  $18)
- Hoodie (winter SKU only — Independent Trading SS4500, $30 POD, sell
  at $52)

You don't need to fulfill these manually. Printify auto-prints + ships.
You ship a discount code; they handle the rest.

## Trademark — **TODO at $700 line item**

If campaign funds, file "WatchNexus" with CIPO
(`https://www.ic.gc.ca/eic/site/cipointernet-internetopic.nsf/eng/home`).
Single-class filing (Class 9 — Software). Wesley & Greve or
TM-Headquarters can handle this for ~$380 inclusive of legal review;
DIY filing is $330 application + $50 registration.

## Domains (already owned, listed for the ledger)

- `watchnexus.ca` ✅ owned
- `licenses.watchnexus.ca` ✅ subdomain
- `releases.watchnexus.ca` ✅ subdomain
- Suggest grabbing `watchnexus.app` and `watchnexus.com` defensively
  (~$30/yr each, $60 total, already in the budget buffer).
