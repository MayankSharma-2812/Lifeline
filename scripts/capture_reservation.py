"""
Script to capture clean reservation-status.png from the live reservation screen.
"""
import os
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.abspath("docs/screenshots")

def capture_reservation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2
        )
        page = ctx.new_page()

        print("Logging in as requester...", flush=True)
        page.goto("http://localhost:5173/login")
        page.wait_for_timeout(1000)

        signin_tab = page.locator("button[type='button']:has-text('Sign In')")
        if signin_tab.count() > 0:
            signin_tab.first.click()

        page.locator("input[type='text'], input[type='email']").first.fill("requester@lifeline.org")
        page.locator("input[type='password']").first.fill("password123")
        page.locator("button[type='submit']").first.click()

        page.wait_for_url("**/intake", timeout=10000)
        page.wait_for_timeout(1000)
        print("At intake...", flush=True)

        # Submit request
        textarea = page.locator("textarea")
        textarea.fill("Need O- blood urgently for my father admitted in ICU at Fortis Hospital Jaipur. Surgery scheduled in 2 hours.")
        page.locator("button[type='submit']").first.click()

        page.wait_for_url("**/matches", timeout=12000)
        page.wait_for_timeout(2500)
        print("At matches screen...", flush=True)

        # Click Reserve Donor button
        reserve_btn = page.locator("button:has-text('Reserve Donor')").first
        print("Found reserve button, clicking...", flush=True)
        reserve_btn.click()

        page.wait_for_url("**/reservation/**", timeout=10000)
        page.wait_for_timeout(2000)
        print("At reservation screen:", page.url, flush=True)

        res_path = os.path.join(SCREENSHOT_DIR, "reservation-status.png")
        page.screenshot(path=res_path)
        print(f"Captured clean reservation-status: {res_path}", flush=True)

        ctx.close()
        browser.close()

if __name__ == "__main__":
    capture_reservation()
