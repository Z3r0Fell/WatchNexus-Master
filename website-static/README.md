# WatchNexus Static Website

A simple, fully static HTML website that you can easily edit and deploy anywhere.

## Directory Structure

```
website-static/
├── css/
│   └── styles.css      # All styles - edit colors, fonts, etc. here
├── js/
│   └── main.js         # Simple JavaScript (FAQ accordion, scroll)
├── images/             # Put your images here
├── index.html          # Home page
├── features.html       # Features page
├── download.html       # Download page
├── demo.html           # Demo/screenshots page
├── faq.html            # FAQ page
├── troubleshooting.html # Support page
├── terms.html          # Terms of Service
├── disclaimer.html     # Legal disclaimer
└── README.md           # This file
```

## How to Edit

### Changing Colors/Fonts

Open `css/styles.css` and edit the CSS variables at the top:

```css
:root {
  /* Main Colors - Change these! */
  --color-primary: #8B5CF6;         /* Purple - main accent */
  --color-secondary: #EC4899;       /* Pink - secondary accent */
  --color-background: #0a0a0f;      /* Dark background */
  --color-surface: #1a1a2e;         /* Card background */
  
  /* Text Colors */
  --color-text: #ffffff;            /* Main text */
  --color-text-muted: #a0a0b0;      /* Gray text */
}
```

### Editing Page Content

Each `.html` file is a standalone page. To edit:

1. Open the HTML file in any text editor
2. Find the section you want to edit
3. Change the text between the HTML tags
4. Save and refresh your browser

**Example - Changing the hero title:**
```html
<!-- Find this in index.html -->
<h1 class="hero-title">
  Your Complete <span class="text-gradient">Media Pipeline</span>
</h1>

<!-- Change it to -->
<h1 class="hero-title">
  Your New <span class="text-gradient">Title Here</span>
</h1>
```

### Adding Pages

1. Copy an existing HTML file
2. Rename it (e.g., `new-page.html`)
3. Edit the content
4. Add a link to it in the navigation (edit all other pages' `<nav>` section)

### Adding Images

1. Put your image in the `images/` folder
2. Reference it in HTML: `<img src="images/my-image.png" alt="Description">`

## Deployment

### IONOS Web Hosting

1. Log into your IONOS account
2. Go to Hosting > File Manager
3. Upload all files from `website-static/` to your web space root
4. Your site is live!

**Note:** An `.htaccess` file is already included for proper routing.

### Any Web Host

Simply upload all files to your web hosting's public folder. Static HTML works everywhere!

### Local Testing

Just open `index.html` in your web browser. No server needed!

## Quick Reference

### Common Edits

| What | Where |
|------|-------|
| Colors | `css/styles.css` → `:root` variables |
| Navigation links | Any `.html` file → `<nav>` section |
| Footer links | Any `.html` file → `<footer>` section |
| Hero text | Each page → `<section class="hero">` |
| Feature cards | `features.html` or `index.html` |
| FAQ questions | `faq.html` → `.faq-item` sections |
| Download links | `download.html` |

### Adding a FAQ

```html
<div class="faq-item">
  <button class="faq-question">Your question here?</button>
  <div class="faq-answer">
    <p>Your answer here.</p>
  </div>
</div>
```

### Adding a Feature Card

```html
<div class="card feature-card">
  <div class="feature-icon">🚀</div>
  <h3 class="feature-title">Feature Name</h3>
  <p class="feature-description">
    Description of the feature goes here.
  </p>
</div>
```

## Need Help?

- HTML basics: https://developer.mozilla.org/en-US/docs/Learn/HTML
- CSS basics: https://developer.mozilla.org/en-US/docs/Learn/CSS
- Open an issue on GitHub

---

Made with ❤️ for WatchNexus
