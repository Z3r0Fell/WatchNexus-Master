import asyncio
from playwright.async_api import async_playwright
import os

SCREENSHOT_DIR = "/app/screenshots"
BASE_URL = "https://unified-media-engine.preview.emergentagent.com"

async def capture_screenshots():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        
        screenshots = []
        
        try:
            # 1. Login Page
            print("📸 Capturing Login Page...")
            await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/01-login-page.png")
            screenshots.append("01-login-page.png")
            
            # Login
            print("🔐 Logging in...")
            await page.fill('input[type="email"]', 'test@test.com')
            await page.fill('input[type="password"]', 'password')
            await page.click('button[type="submit"]')
            await page.wait_for_timeout(4000)
            
            # 2. Dashboard Hero
            print("📸 Capturing Dashboard Hero...")
            await page.screenshot(path=f"{SCREENSHOT_DIR}/02-dashboard-hero.png")
            screenshots.append("02-dashboard-hero.png")
            
            # 3. Continue Watching
            print("📸 Capturing Continue Watching...")
            await page.evaluate("window.scrollBy(0, 500)")
            await page.wait_for_timeout(1000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/03-continue-watching.png")
            screenshots.append("03-continue-watching.png")
            
            # 4. Trending Section
            print("📸 Capturing Trending...")
            await page.evaluate("window.scrollBy(0, 400)")
            await page.wait_for_timeout(1000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/04-trending-section.png")
            screenshots.append("04-trending-section.png")
            
            # 5. Movies Page
            print("📸 Capturing Movies Page...")
            await page.goto(f"{BASE_URL}/movies", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/05-movies-page.png")
            screenshots.append("05-movies-page.png")
            
            # 6. TV Shows Page
            print("📸 Capturing TV Shows Page...")
            await page.goto(f"{BASE_URL}/tv", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/06-tv-shows-page.png")
            screenshots.append("06-tv-shows-page.png")
            
            # 7. Discover Page
            print("📸 Capturing Discover Page...")
            await page.goto(f"{BASE_URL}/discover", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/07-discover-page.png")
            screenshots.append("07-discover-page.png")
            
            # 8. Plugin Marketplace
            print("📸 Capturing Plugin Marketplace...")
            await page.goto(f"{BASE_URL}/plugins", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/08-plugin-marketplace.png")
            screenshots.append("08-plugin-marketplace.png")
            
            # 9. Downloads Page
            print("📸 Capturing Downloads Page...")
            await page.goto(f"{BASE_URL}/downloads", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/09-downloads-page.png")
            screenshots.append("09-downloads-page.png")
            
            # 10. Watchlist Page
            print("📸 Capturing Watchlist Page...")
            await page.goto(f"{BASE_URL}/watchlist", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/10-watchlist-page.png")
            screenshots.append("10-watchlist-page.png")
            
            # 11. Live TV Page
            print("📸 Capturing Live TV Page...")
            await page.goto(f"{BASE_URL}/live-tv", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/11-live-tv-page.png")
            screenshots.append("11-live-tv-page.png")
            
            # Settings Pages
            print("📸 Capturing Settings - General...")
            await page.goto(f"{BASE_URL}/settings", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/12-settings-general.png")
            screenshots.append("12-settings-general.png")
            
            # 13. Settings - Users
            print("📸 Capturing Settings - Users...")
            await page.click('button:has-text("Users")')
            await page.wait_for_timeout(1500)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/13-settings-users.png")
            screenshots.append("13-settings-users.png")
            
            # 14. Settings - Library
            print("📸 Capturing Settings - Library...")
            await page.click('button:has-text("Library")')
            await page.wait_for_timeout(1500)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/14-settings-library.png")
            screenshots.append("14-settings-library.png")
            
            # 15. Settings - Media Management
            print("📸 Capturing Settings - Media Management...")
            await page.click('button:has-text("Media Management")')
            await page.wait_for_timeout(1500)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/15-settings-media-management.png")
            screenshots.append("15-settings-media-management.png")
            
            # 16. Settings - Quality Profiles
            print("📸 Capturing Settings - Quality Profiles...")
            await page.click('button:has-text("Quality Profiles")')
            await page.wait_for_timeout(1500)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/16-settings-quality-profiles.png")
            screenshots.append("16-settings-quality-profiles.png")
            
            # 17. Settings - Mass Editor
            print("📸 Capturing Settings - Mass Editor...")
            await page.click('button:has-text("Mass Editor")')
            await page.wait_for_timeout(1500)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/17-settings-mass-editor.png")
            screenshots.append("17-settings-mass-editor.png")
            
            # 18. Settings - Theme Forge
            print("📸 Capturing Settings - Theme Forge...")
            await page.click('button:has-text("Theme Forge")')
            await page.wait_for_timeout(1500)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/18-settings-theme-forge.png")
            screenshots.append("18-settings-theme-forge.png")
            
            # 19. Settings - Plugins
            print("📸 Capturing Settings - Plugins...")
            await page.click('button:has-text("Plugins")')
            await page.wait_for_timeout(1500)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/19-settings-plugins.png")
            screenshots.append("19-settings-plugins.png")
            
            # 20. Settings - Indexers
            print("📸 Capturing Settings - Indexers...")
            await page.click('button:has-text("Indexers")')
            await page.wait_for_timeout(1500)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/20-settings-indexers.png")
            screenshots.append("20-settings-indexers.png")
            
            # 21. Settings - Streaming Services
            print("📸 Capturing Settings - Streaming Services...")
            await page.click('button:has-text("Streaming Services")')
            await page.wait_for_timeout(1500)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/21-settings-streaming.png")
            screenshots.append("21-settings-streaming.png")
            
            print(f"\n✅ Successfully captured {len(screenshots)} screenshots!")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            print(f"Screenshots captured before error: {len(screenshots)}")
        
        finally:
            await browser.close()
    
    return screenshots

if __name__ == "__main__":
    asyncio.run(capture_screenshots())
