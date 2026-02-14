"""
WatchNexus UI Walkthrough Capture
Captures the application with visible cursor movements for feature demonstration
Uses Playwright to navigate and capture frames
"""

import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

# Get the app URL
APP_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')

# Output directory
WALKTHROUGH_DIR = Path("/app/walkthrough_frames")
WALKTHROUGH_DIR.mkdir(exist_ok=True)

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"

# Custom cursor SVG (orange pointer)
CURSOR_SVG = '''
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="M4 4 L4 28 L12 20 L20 28 L24 24 L16 16 L24 16 L4 4Z" 
        fill="#f97316" stroke="#000" stroke-width="1.5"/>
</svg>
'''


async def add_cursor_overlay(page, x, y):
    """Add a visible cursor overlay at specified coordinates"""
    await page.evaluate(f'''() => {{
        // Remove existing cursor
        const existing = document.getElementById('walkthrough-cursor');
        if (existing) existing.remove();
        
        // Create cursor element
        const cursor = document.createElement('div');
        cursor.id = 'walkthrough-cursor';
        cursor.innerHTML = `{CURSOR_SVG}`;
        cursor.style.cssText = `
            position: fixed;
            left: {x}px;
            top: {y}px;
            width: 32px;
            height: 32px;
            pointer-events: none;
            z-index: 999999;
            transform: translate(-2px, -2px);
            filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.5));
        `;
        document.body.appendChild(cursor);
    }}''')


async def animate_cursor_to(page, start_x, start_y, end_x, end_y, steps=10, delay=50):
    """Animate cursor from start to end position"""
    for i in range(steps + 1):
        progress = i / steps
        # Ease-out animation
        eased = 1 - (1 - progress) ** 2
        x = start_x + (end_x - start_x) * eased
        y = start_y + (end_y - start_y) * eased
        await add_cursor_overlay(page, x, y)
        await asyncio.sleep(delay / 1000)


async def capture_walkthrough():
    """Capture the full UI walkthrough with cursor movements"""
    
    print("=" * 60)
    print("  WatchNexus Walkthrough Capture")
    print("=" * 60)
    print(f"\n  Target URL: {APP_URL}")
    print(f"  Output: {WALKTHROUGH_DIR}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            device_scale_factor=2  # Retina quality
        )
        page = await context.new_page()
        
        frame_num = 0
        
        async def capture(name, delay=500):
            nonlocal frame_num
            frame_num += 1
            filename = f"{frame_num:03d}_{name}.png"
            await asyncio.sleep(delay / 1000)
            await page.screenshot(path=str(WALKTHROUGH_DIR / filename), full_page=False)
            print(f"  📸 Captured: {filename}")
            return filename
        
        try:
            # ============================================
            # SECTION 1: Login Flow
            # ============================================
            print("\n🔐 Section 1: Login")
            
            await page.goto(APP_URL, wait_until='networkidle', timeout=30000)
            await asyncio.sleep(1000)
            
            # Show login page
            await add_cursor_overlay(page, 960, 300)
            await capture("login_page")
            
            # Move cursor to email field
            email_box = await page.query_selector('input[type="email"], input[name="email"]')
            if email_box:
                box = await email_box.bounding_box()
                if box:
                    await animate_cursor_to(page, 960, 300, box['x'] + 100, box['y'] + 20)
                    await capture("login_email_hover")
                    
                    # Type email
                    await email_box.fill(TEST_EMAIL)
                    await capture("login_email_filled")
            
            # Move to password
            pwd_box = await page.query_selector('input[type="password"]')
            if pwd_box:
                box = await pwd_box.bounding_box()
                if box:
                    await animate_cursor_to(page, 960, 400, box['x'] + 100, box['y'] + 20)
                    await pwd_box.fill(TEST_PASSWORD)
                    await capture("login_password_filled")
            
            # Click login button
            login_btn = await page.query_selector('button[type="submit"], button:has-text("Login"), button:has-text("Sign")')
            if login_btn:
                box = await login_btn.bounding_box()
                if box:
                    await animate_cursor_to(page, 960, 500, box['x'] + 50, box['y'] + 20)
                    await capture("login_button_hover")
                    await login_btn.click()
                    await asyncio.sleep(2000)
            
            # ============================================
            # SECTION 2: Dashboard
            # ============================================
            print("\n🏠 Section 2: Dashboard")
            
            await page.wait_for_load_state('networkidle', timeout=10000)
            await add_cursor_overlay(page, 960, 100)
            await capture("dashboard_overview", 1000)
            
            # Hover over Continue Watching section
            continue_section = await page.query_selector('[data-testid*="continue"], h2:has-text("Continue")')
            if continue_section:
                box = await continue_section.bounding_box()
                if box:
                    await animate_cursor_to(page, 960, 100, box['x'] + 100, box['y'] + 50)
                    await capture("dashboard_continue_watching")
            
            # Scroll down to show more content
            await page.evaluate('window.scrollBy(0, 400)')
            await asyncio.sleep(500)
            await add_cursor_overlay(page, 960, 400)
            await capture("dashboard_scrolled")
            
            # ============================================
            # SECTION 3: Navigation - Sidebar
            # ============================================
            print("\n📂 Section 3: Navigation")
            
            # Hover over sidebar items
            sidebar_items = ['Library', 'Search', 'Downloads', 'Settings']
            current_y = 200
            
            for item_text in sidebar_items:
                item = await page.query_selector(f'a:has-text("{item_text}"), button:has-text("{item_text}"), [data-testid*="{item_text.lower()}"]')
                if item:
                    box = await item.bounding_box()
                    if box:
                        await animate_cursor_to(page, 100, current_y, box['x'] + 40, box['y'] + 15)
                        current_y = box['y'] + 15
                        await capture(f"nav_{item_text.lower()}_hover")
            
            # ============================================
            # SECTION 4: Settings Page
            # ============================================
            print("\n⚙️ Section 4: Settings")
            
            settings_link = await page.query_selector('a[href*="settings"], a:has-text("Settings"), [data-testid*="settings"]')
            if settings_link:
                await settings_link.click()
                await asyncio.sleep(1500)
                await add_cursor_overlay(page, 300, 200)
                await capture("settings_overview")
                
                # Click through settings tabs
                settings_tabs = ['Library', 'Theme', 'Indexers', 'Plugins']
                tab_y = 200
                
                for tab_text in settings_tabs:
                    tab = await page.query_selector(f'button:has-text("{tab_text}"), [role="tab"]:has-text("{tab_text}")')
                    if tab:
                        box = await tab.bounding_box()
                        if box:
                            await animate_cursor_to(page, 300, tab_y, box['x'] + 40, box['y'] + 15)
                            tab_y = box['y'] + 15
                            await capture(f"settings_{tab_text.lower()}_hover")
                            await tab.click()
                            await asyncio.sleep(800)
                            await capture(f"settings_{tab_text.lower()}_content")
            
            # ============================================
            # SECTION 5: Theme Showcase
            # ============================================
            print("\n🎨 Section 5: Themes")
            
            theme_tab = await page.query_selector('button:has-text("Theme"), [data-testid*="theme"]')
            if theme_tab:
                await theme_tab.click()
                await asyncio.sleep(1000)
                await add_cursor_overlay(page, 600, 300)
                await capture("themes_overview")
                
                # Click on different themes
                theme_cards = await page.query_selector_all('[data-testid*="theme-card"], .theme-card, [class*="theme"]')
                for i, card in enumerate(theme_cards[:4]):
                    box = await card.bounding_box()
                    if box:
                        await animate_cursor_to(page, 600, 300 + i*80, box['x'] + 50, box['y'] + 30)
                        await capture(f"theme_card_{i+1}_hover")
            
            # ============================================
            # SECTION 6: Library View
            # ============================================
            print("\n📚 Section 6: Library")
            
            library_link = await page.query_selector('a[href*="library"], a:has-text("Library")')
            if library_link:
                await library_link.click()
                await asyncio.sleep(1500)
                await add_cursor_overlay(page, 960, 300)
                await capture("library_overview")
                
                # Hover over media items
                media_items = await page.query_selector_all('[data-testid*="media"], .media-card, [class*="poster"]')
                for i, item in enumerate(media_items[:6]):
                    box = await item.bounding_box()
                    if box:
                        await animate_cursor_to(page, 960, 300, box['x'] + 80, box['y'] + 100)
                        await capture(f"library_item_{i+1}_hover")
            
            print(f"\n✅ Walkthrough complete! {frame_num} frames captured")
            print(f"   Output: {WALKTHROUGH_DIR}")
            
        except Exception as e:
            print(f"\n❌ Error during capture: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            await browser.close()
    
    return frame_num


async def create_video_from_frames():
    """Create a video from captured frames using ffmpeg"""
    frames = sorted(WALKTHROUGH_DIR.glob("*.png"))
    
    if not frames:
        print("No frames to convert")
        return None
    
    # Create file list for ffmpeg
    list_file = WALKTHROUGH_DIR / "frames.txt"
    with open(list_file, 'w') as f:
        for frame in frames:
            # Each frame shown for 1.5 seconds
            f.write(f"file '{frame}'\n")
            f.write(f"duration 1.5\n")
        # Last frame needs to be listed without duration
        f.write(f"file '{frames[-1]}'\n")
    
    output_video = "/app/videos/walkthrough_demo.mp4"
    
    cmd = f'''ffmpeg -y -f concat -safe 0 -i {list_file} \
        -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
        -c:v libx264 -pix_fmt yuv420p -r 30 \
        {output_video}'''
    
    print(f"\n🎬 Creating walkthrough video...")
    os.system(cmd)
    
    if os.path.exists(output_video):
        print(f"✅ Walkthrough video saved: {output_video}")
        return output_video
    return None


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--video":
        # Just create video from existing frames
        asyncio.run(create_video_from_frames())
    else:
        # Capture walkthrough and create video
        asyncio.run(capture_walkthrough())
        asyncio.run(create_video_from_frames())
