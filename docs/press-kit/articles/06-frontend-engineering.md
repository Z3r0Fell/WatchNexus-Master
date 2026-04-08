# Designing a Dashboard for 35 Modules: Lessons from Building WatchNexus

**Target:** Smashing Magazine, CSS-Tricks, Dev.to (frontend tag)  
**Format:** Case study / technical article  
**Word Count:** ~2,000  
**Tone:** Technical but accessible, design-aware, lessons-learned framing

---

How do you build a navigation system that scales to 35 modules without becoming a cluttered mess? That was the central UI/UX challenge of WatchNexus, a self-hosted media management application where every feature -- from indexer search to VPN management to two-factor authentication -- is a first-class module with its own page.

This article covers the design decisions, component architecture, and CSS strategies we used to build a dashboard that handles 35+ modules while remaining usable.

## The Problem: Feature Density vs. Usability

WatchNexus started with 8 modules. By version 2.8.4, it had 35. The sidebar navigation, which initially listed every module as a flat list, became unusable around module 15. We needed a system that could:

1. Show the most-used modules immediately
2. Hide less-used modules without making them hard to find
3. Scale to 50+ modules without redesign
4. Work on both desktop (1920px+) and mobile viewports

## The Component Stack

Our frontend is React 18 with TailwindCSS for utility-first styling and Shadcn UI as our component library. The key decision was using Shadcn rather than building a custom component library.

**Why Shadcn worked for us:**

Shadcn components live in your codebase at `/components/ui/`. They're not imported from `node_modules` -- they're actual files you own and can modify. When you need a Button that behaves slightly differently for a media server context, you edit the file directly. No wrapper components, no `!important` overrides.

```jsx
// /components/ui/button.jsx -- we own this file
import { cn } from "../../lib/utils"

const Button = ({ className, variant = "default", ...props }) => {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium",
        "transition-colors focus-visible:outline-none",
        variant === "default" && "bg-violet-600 text-white hover:bg-violet-700",
        variant === "ghost" && "hover:bg-white/10 text-gray-400 hover:text-white",
        className
      )}
      {...props}
    />
  )
}
```

## The Navigation Architecture

We solved the 35-module problem with a **categorized collapsible sidebar**. Modules are grouped by function:

```
Media
  Home, Library, Movies, TV Shows, Anime, Playlists, Collections

Discover
  Search, Indexers, Discover

Tools
  Automation, Downloads, Download Clients, Streaming

Gadgets
  Weather, Podcasts, Radio, Photos, Web Video

Administration
  Settings, Security, VPN, System, Log Viewer, Tasks, Backups, RSS Feeds
```

Each category collapses independently. The active page's category auto-expands. The sidebar itself collapses to icons on narrow viewports.

The key CSS: the sidebar uses `overflow-y: auto` with a custom scrollbar that matches the dark theme:

```css
.sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}

.sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
```

We avoided `overflow: hidden` on the sidebar container. The scrollbar is intentionally visible (at 4px) so users know there's more content below the fold.

## Color System: Committing to Dark Mode

WatchNexus uses a single dark theme. We didn't build a light mode toggle. This was a deliberate choice:

1. **Media servers display poster art.** Rich, colorful movie posters pop against dark backgrounds. On light backgrounds, they compete with the UI.
2. **Usage context matters.** People use media servers in the evening, in dim rooms. A bright white interface is hostile in that context.
3. **One theme is easier to get right** than two half-baked themes.

The color system uses CSS custom properties, but with a flat dark palette rather than gradients:

```css
:root {
  --bg-primary: #0A0A0A;
  --bg-surface: #1E1E1E;
  --bg-elevated: #2A2A2A;
  --accent: #7C3AED;       /* violet-600 */
  --accent-hover: #6D28D9; /* violet-700 */
  --text-primary: #F3F4F6; /* gray-100 */
  --text-muted: #9CA3AF;   /* gray-400 */
  --success: #10B981;
  --error: #EF4444;
}
```

The background is `#0A0A0A` -- not pure black (`#000000`). Pure black creates harsh contrast against colored elements. The subtle warmth of `#0A0A0A` feels more natural on IPS/OLED displays.

Surfaces use `#1E1E1E` for cards and panels. Elevated surfaces (modals, dropdowns) use `#2A2A2A`. This three-tier depth hierarchy creates visual layering without shadows or borders.

## The Module Dashboard Pattern

Every module page follows the same layout pattern:

```jsx
const ModulePage = ({ title, subtitle, icon, children }) => (
  <div className="min-h-screen bg-[#0A0A0A]">
    <Sidebar />
    <main className="ml-[200px] p-6">
      {/* Module header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 
                        flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-gray-400 text-sm">{subtitle}</p>
        </div>
      </div>
      
      {/* Module content */}
      {children}
    </main>
  </div>
)
```

This consistency means users learn the layout once and can navigate any module. The icon + title + subtitle pattern provides immediate context. The content area is intentionally wide -- media servers display tables and grids that benefit from horizontal space.

## The System Dashboard: Data-Dense Without Being Cluttered

The System page is the most data-dense page in the application. It shows:
- 4 health status cards (Status, Runtime, OS, Server Time)
- 8 server detail metrics
- 8 security feature indicators
- 35 module cards with codenames and versions

We handle this density with three techniques:

**1. Card grids with responsive breakpoints:**

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {healthCards.map(card => (
    <div key={card.label} className="bg-[#1E1E1E] rounded-xl p-5 border border-white/5">
      <p className="text-gray-400 text-xs uppercase tracking-wider">{card.label}</p>
      <p className="text-white text-xl font-bold mt-1">{card.value}</p>
    </div>
  ))}
</div>
```

**2. Green checkmark grid for boolean states:**

The 8 security features are displayed as a grid of green checkmark badges. No toggle switches, no detailed configuration -- just "this is active." Users who want to configure these features navigate to the Security page.

**3. Module listing with compact cards:**

Each of the 35 modules is displayed as a small card with:
- Module name
- Codename (in parentheses, muted text)
- Version badge
- Active/inactive status indicator

The cards use a 4-column grid on desktop, 2 on tablet, 1 on mobile. Each card is ~60px tall, so all 35 fit in a scrollable area without feeling overwhelming.

## Micro-Interactions That Matter

Three small interaction patterns that made a noticeable difference in user feedback:

**1. Sidebar hover states with transition timing:**
```css
.sidebar-item {
  transition: background-color 150ms ease, color 150ms ease;
}
.sidebar-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #F3F4F6;
}
.sidebar-item.active {
  background-color: rgba(124, 58, 237, 0.15);
  color: #7C3AED;
}
```

The 150ms timing is fast enough to feel responsive but slow enough to avoid flickering when the cursor passes over multiple items.

**2. Card border glow on hover:**
```css
.module-card {
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: border-color 200ms ease;
}
.module-card:hover {
  border-color: rgba(124, 58, 237, 0.3);
}
```

This subtle violet glow on hover reinforces the brand color and gives feedback without being distracting.

**3. Loading spinner that matches the brand:**
```jsx
<div className="w-12 h-12 border-4 border-violet-600 border-t-transparent 
                rounded-full animate-spin" />
```

A simple CSS spinner using the brand color. No external animation library needed.

## Lessons Learned

1. **Don't build a light mode until users ask for it.** We never got that request. Media server users overwhelmingly prefer dark themes.

2. **Categorized navigation beats flat lists at ~15 items.** We should have started with categories instead of migrating to them later.

3. **Shadcn over a design system.** For a small team building a niche application, owning your components (Shadcn) beats maintaining a design system. The overhead of tokens, documentation, and versioning isn't worth it under 50 components.

4. **Consistent layout patterns reduce cognitive load more than clever UI.** Every module page looking the same sounds boring, but users navigate 35 modules without ever feeling lost.

5. **Dark backgrounds make content shine.** Movie posters, TV show banners, and album art are designed by professional artists. Let them be the visual star -- your UI should be the frame, not the painting.

---

*WatchNexus is a self-hosted media management pipeline at version 2.8.4. Built with React 18, TailwindCSS, and Shadcn UI.*

---

## Submission Notes
- **Smashing Magazine**: Submit via smashingmagazine.com/write-for-us/. They pay contributors. Frame as "lessons learned" case study, not product promotion. Review time: 2-4 weeks.
- **CSS-Tricks**: Submit via contact form. Focus on the CSS techniques (dark theme, scrollbar customization, micro-interactions).
- **Dev.to**: Publish directly with tags `#react #css #ui #design`. Include the visual screenshots.
- Include before/after screenshots showing the sidebar evolution from flat list to categorized.
