"""
Simplified WatchNexus Walkthrough Capture
Uses synchronous Playwright for reliability
"""

import os
from pathlib import Path
from playwright.sync_api import sync_playwright

APP_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://nexus-code-review-1.preview.emergentagent.com')
OUTPUT_DIR = Path("/app/walkthrough_frames")
OUTPUT_DIR.mkdir(exist_ok=True)

# Cursor overlay CSS/HTML
CURSOR_STYLE = """
<div id="cursor-overlay" style="
    position: fixed;
    width: 24px;
    height: 24px;
    pointer-events: none;
    z-index: 99999;
    transition: all 0.3s ease;
">
    <svg viewBox="0 0 24 24" fill="#f97316" stroke="#000" stroke-width="1">
        <path d="M3 3 L3 21 L9 15 L15 21 L18 18 L12 12 L18 12 L3 3Z"/>
    </svg>
</div>
"""

def capture_walkthrough():
    print("=" * 50)
    print("  WatchNexus Walkthrough Capture")
    print("=" * 50)
    print(f"URL: {APP_URL}")
    
    frame_count = 0
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        def add_cursor(x, y):
            page.evaluate(f'''() => {{
                let cursor = document.getElementById('cursor-overlay');
                if (!cursor) {{
                    document.body.insertAdjacentHTML('beforeend', `{CURSOR_STYLE}`);
                    cursor = document.getElementById('cursor-overlay');
                }}
                cursor.style.left = '{x}px';
                cursor.style.top = '{y}px';
            }}''')
        
        def capture(name):
            nonlocal frame_count
            frame_count += 1
            filename = f"{frame_count:03d}_{name}.png"
            page.screenshot(path=str(OUTPUT_DIR / filename), full_page=False)
            print(f"  📸 {filename}")
        
        try:
            # LOGIN PAGE
            print("\n🔐 Login Flow")
            page.goto(APP_URL, wait_until='domcontentloaded', timeout=15000)
            page.wait_for_timeout(2000)
            
            add_cursor(960, 200)
            capture("01_login_page")
            
            # Fill login
            email_input = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first
            if email_input.count() > 0:
                box = email_input.bounding_box()
                if box:
                    add_cursor(box['x'] + 100, box['y'] + 15)
                    capture("02_email_hover")
                    email_input.fill("test@test.com")
                    capture("03_email_filled")
            
            pwd_input = page.locator('input[type="password"]').first
            if pwd_input.count() > 0:
                box = pwd_input.bounding_box()
                if box:
                    add_cursor(box['x'] + 100, box['y'] + 15)
                    pwd_input.fill("password")
                    capture("04_password_filled")
            
            login_btn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first
            if login_btn.count() > 0:
                box = login_btn.bounding_box()
                if box:
                    add_cursor(box['x'] + 50, box['y'] + 15)
                    capture("05_login_button")
                    login_btn.click()
                    page.wait_for_timeout(3000)
            
            # DASHBOARD
            print("\n🏠 Dashboard")
            add_cursor(960, 200)
            capture("06_dashboard")
            
            page.evaluate('window.scrollBy(0, 300)')
            page.wait_for_timeout(500)
            add_cursor(960, 400)
            capture("07_dashboard_scrolled")
            
            # SIDEBAR NAVIGATION
            print("\n📂 Navigation")
            nav_items = ['Library', 'Search', 'Downloads', 'Settings']
            y_pos = 200
            
            for i, item in enumerate(nav_items):
                link = page.locator(f'a:has-text("{item}"), [data-testid*="{item.lower()}"]').first
                if link.count() > 0:
                    box = link.bounding_box()
                    if box:
                        add_cursor(box['x'] + 30, box['y'] + 15)
                        capture(f"{8+i:02d}_nav_{item.lower()}")
            
            # SETTINGS PAGE
            print("\n⚙️ Settings")
            settings_link = page.locator('a:has-text("Settings"), a[href*="settings"]').first
            if settings_link.count() > 0:
                settings_link.click()
                page.wait_for_timeout(2000)
                
                add_cursor(400, 300)
                capture("12_settings_page")
                
                # Click tabs
                tabs = ['Library', 'Theme', 'Indexers']
                for i, tab in enumerate(tabs):
                    tab_btn = page.locator(f'button:has-text("{tab}"), [role="tab"]:has-text("{tab}")').first
                    if tab_btn.count() > 0:
                        box = tab_btn.bounding_box()
                        if box:
                            add_cursor(box['x'] + 30, box['y'] + 12)
                            capture(f"{13+i*2:02d}_settings_{tab.lower()}_hover")
                            tab_btn.click()
                            page.wait_for_timeout(800)
                            capture(f"{14+i*2:02d}_settings_{tab.lower()}_content")
            
            # THEME SHOWCASE
            print("\n🎨 Themes")
            theme_tab = page.locator('button:has-text("Theme")').first
            if theme_tab.count() > 0:
                theme_tab.click()
                page.wait_for_timeout(1000)
                
                theme_cards = page.locator('[class*="theme"], [data-testid*="theme"]').all()
                for i, card in enumerate(theme_cards[:3]):
                    box = card.bounding_box()
                    if box:
                        add_cursor(box['x'] + 50, box['y'] + 30)
                        capture(f"20_theme_{i+1}")
            
            print(f"\n✅ Complete! {frame_count} frames captured")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            browser.close()
    
    return frame_count


if __name__ == "__main__":
    capture_walkthrough()
