"""Capture mobile screenshots of the MenuBy admin panel for UX/UI analysis."""
from playwright.sync_api import sync_playwright
import os, time

OUT = r"c:\Users\TECNOPHONE\Desktop\SisRestaurantes\screenshots_mobile"
os.makedirs(OUT, exist_ok=True)

BASE = "https://www.menuby.tech"

# We'll capture the public menu first to get a slug, then the admin panel
# Since admin requires auth, we'll capture what's publicly accessible
# and also the login page + admin structure

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    # iPhone 14 viewport
    mobile = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    )
    page = mobile.new_page()
    
    # 1. Landing page
    print("1. Capturing landing page...")
    page.goto(BASE, wait_until="networkidle", timeout=30000)
    time.sleep(2)
    page.screenshot(path=os.path.join(OUT, "01_landing_mobile.png"), full_page=True)
    print("   Done")
    
    # 2. Try a known slug (fraise from logs)
    print("2. Capturing menu page (fraise)...")
    page.goto(f"{BASE}/fraise", wait_until="networkidle", timeout=30000)
    time.sleep(3)
    page.screenshot(path=os.path.join(OUT, "02_menu_mobile.png"), full_page=True)
    # Also viewport-only screenshot
    page.screenshot(path=os.path.join(OUT, "02b_menu_viewport.png"), full_page=False)
    print("   Done")
    
    # 3. Admin login page
    print("3. Capturing admin login...")
    page.goto(f"{BASE}/fraise/login", wait_until="networkidle", timeout=30000)
    time.sleep(2)
    page.screenshot(path=os.path.join(OUT, "03_login_mobile.png"), full_page=True)
    print("   Done")
    
    # 4. Try admin page (will redirect to login if not authed)
    print("4. Capturing admin page...")
    page.goto(f"{BASE}/fraise/admin", wait_until="networkidle", timeout=30000)
    time.sleep(3)
    page.screenshot(path=os.path.join(OUT, "04_admin_mobile.png"), full_page=True)
    page.screenshot(path=os.path.join(OUT, "04b_admin_viewport.png"), full_page=False)
    print("   Done")
    
    # 5. Desktop viewport for comparison
    print("5. Capturing desktop admin for comparison...")
    desktop = browser.new_context(viewport={"width": 1440, "height": 900})
    dpage = desktop.new_page()
    dpage.goto(f"{BASE}/fraise/admin", wait_until="networkidle", timeout=30000)
    time.sleep(3)
    dpage.screenshot(path=os.path.join(OUT, "05_admin_desktop.png"), full_page=False)
    dpage.close()
    desktop.close()
    print("   Done")
    
    # 6. Check various mobile pages
    print("6. Capturing other mobile pages...")
    # Cart page
    page.goto(f"{BASE}/fraise", wait_until="networkidle", timeout=30000)
    time.sleep(2)
    # Scroll down to see full menu
    page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
    time.sleep(1)
    page.screenshot(path=os.path.join(OUT, "06_menu_scrolled.png"), full_page=False)
    print("   Done")
    
    page.close()
    mobile.close()
    browser.close()
    
print("\nAll screenshots saved to:", OUT)
