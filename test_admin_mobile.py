from playwright.sync_api import sync_playwright
import os

SCREENSHOTS_DIR = r"C:\Users\TECNOPHONE\Desktop\SisRestaurantes\screenshots_mobile"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# Admin credentials - using the demo business
BASE_URL = "http://localhost:5173"
BUSINESS_SLUG = "macdonalds"

with sync_playwright() as p:
    # iPhone 14 viewport
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        is_mobile=True,
        has_touch=True,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    )
    page = context.new_page()

    # 1. Login page
    print("1. Capturing login page...")
    page.goto(f"{BASE_URL}/{BUSINESS_SLUG}/admin", wait_until="networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "01_login.png"), full_page=True)

    # Try to login
    print("2. Attempting login...")
    email_input = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"], input[placeholder*="correo"]')
    if email_input.count() > 0:
        email_input.first.fill("felipe@test.com")
    
    password_input = page.locator('input[type="password"]')
    if password_input.count() > 0:
        password_input.first.fill("admin123")
    
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "02_login_filled.png"), full_page=True)

    # Click login button
    login_btn = page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Login"), button:has-text("Entrar")')
    if login_btn.count() > 0:
        login_btn.first.click()
        page.wait_for_timeout(3000)
        page.wait_for_load_state("networkidle")
    
    # 3. Dashboard
    print("3. Capturing dashboard...")
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "03_dashboard.png"), full_page=True)
    
    # Check if we're logged in by looking for sidebar/nav
    current_url = page.url
    print(f"   Current URL: {current_url}")
    
    # Try to find the sidebar/navigation
    # Check what navigation elements exist
    nav_items = page.locator('nav, [class*="sidebar"], [class*="Sidebar"], [class*="menu"], [class*="nav"]').all()
    print(f"   Found {len(nav_items)} nav elements")
    
    # Look for tab buttons or navigation items
    all_buttons = page.locator('button, a').all()
    button_texts = []
    for btn in all_buttons[:30]:
        try:
            text = btn.inner_text(timeout=500)
            if text.strip():
                button_texts.append(text.strip()[:50])
        except:
            pass
    print(f"   Visible buttons/links: {button_texts}")

    # Navigate to different tabs by clicking sidebar items
    tabs_to_check = [
        ("Pedidos", "orders", "04_orders.png"),
        ("Productos", "products", "05_products.png"),
        ("Categorías", "categories", "06_categories.png"),
        ("Toppings", "toppings", "07_toppings.png"),
        ("Completados", "completed", "08_completed.png"),
        ("Clientes", "customers", "09_customers.png"),
        ("Cupones", "coupons", "10_coupons.png"),
        ("Fidelidad", "loyalty", "11_loyalty.png"),
        ("Zonas", "zones", "12_zones.png"),
        ("Domicilios", "delivery", "13_delivery.png"),
        ("Reseñas", "reviews", "14_reviews.png"),
        ("Equipo", "staff", "15_staff.png"),
        ("Reservas", "bookings", "16_bookings.png"),
        ("Mesas", "tables", "17_tables.png"),
        ("Tema", "theme", "18_theme.png"),
        ("WhatsApp", "whatsapp", "19_whatsapp.png"),
        ("Banners", "banners", "20_banners.png"),
        ("Notificaciones", "notifications", "21_notifications.png"),
        ("Configuración", "settings", "22_settings.png"),
        ("Suscripción", "subscription", "23_subscription.png"),
    ]
    
    for tab_name, tab_id, filename in tabs_to_check:
        try:
            print(f"   Trying tab: {tab_name}...")
            # Try clicking tab in sidebar
            tab_btn = page.locator(f'button:has-text("{tab_name}"), a:has-text("{tab_name}"), [data-tab="{tab_id}"]')
            if tab_btn.count() > 0:
                tab_btn.first.click(timeout=3000)
                page.wait_for_timeout(1500)
                page.screenshot(path=os.path.join(SCREENSHOTS_DIR, filename), full_page=True)
                print(f"   ✓ Captured {tab_name}")
            else:
                print(f"   ✗ Tab '{tab_name}' not found")
        except Exception as e:
            print(f"   ✗ Error on {tab_name}: {str(e)[:80]}")

    # Also capture with sidebar open if it has a hamburger menu
    print("\n4. Looking for mobile menu toggle...")
    hamburger = page.locator('button[class*="hamburger"], button[aria-label*="menu"], button[class*="mobile"], [class*="menu-toggle"], button:has(svg)')
    if hamburger.count() > 0:
        print(f"   Found {hamburger.count()} potential menu toggles")
        for i in range(min(3, hamburger.count())):
            try:
                hamburger.nth(i).click(timeout=2000)
                page.wait_for_timeout(500)
                page.screenshot(path=os.path.join(SCREENSHOTS_DIR, f"25_menu_toggle_{i}.png"), full_page=True)
            except:
                pass

    # Capture page at different scroll positions for dashboard
    print("\n5. Scroll captures of current view...")
    page.locator(f'button:has-text("Dashboard"), button:has-text("Inicio")').first.click(timeout=3000)
    page.wait_for_timeout(1500)
    
    # Get page height
    height = page.evaluate("document.body.scrollHeight")
    print(f"   Page height: {height}px")
    
    # Capture at different scroll positions
    for scroll_y in range(0, min(height, 5000), 844):
        page.evaluate(f"window.scrollTo(0, {scroll_y})")
        page.wait_for_timeout(300)
    
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "26_dashboard_full.png"), full_page=True)

    browser.close()
    print("\nDone! Screenshots saved to:", SCREENSHOTS_DIR)
