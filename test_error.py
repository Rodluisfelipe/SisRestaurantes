from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    errors = []
    console_errors = []
    failed_requests = []
    
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)
    page.on("requestfailed", lambda req: failed_requests.append(f"{req.method} {req.url} -> {req.failure}"))
    page.on("response", lambda res: failed_requests.append(f"HTTP {res.status} {res.url}") if res.status >= 400 else None)
    
    # Go to production site
    page.goto("https://www.menuby.tech/macdonalds/admin", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(5000)
    
    # Check page content
    content = page.content()
    print("=== PAGE TITLE ===")
    print(page.title())
    
    # Check for chunk loading errors or React errors
    page.wait_for_timeout(3000)
    
    print("=== PAGE ERRORS ===")
    for e in errors:
        print(e)
    
    print("\n=== CONSOLE ERRORS/WARNINGS ===")
    for e in console_errors:
        print(e)
    
    print("\n=== FAILED REQUESTS ===")
    for e in failed_requests:
        print(e)
    
    # Take screenshot
    page.screenshot(path="C:/Users/TECNOPHONE/Desktop/SisRestaurantes/error_screenshot.png")
    print("\nScreenshot saved")
    
    browser.close()
