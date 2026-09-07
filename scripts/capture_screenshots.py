"""
Script to capture clean, professional UI screenshots for LifeLine documentation.
Runs headlessly via Playwright and saves high-res screenshots to docs/screenshots/.
"""
import os
import time
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.abspath("docs/screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            device_scale_factor=2  # High-DPI / Retina quality
        )
        page = context.new_page()

        print("[1/5] Capturing Auth / Emergency Intake Screen...")
        page.goto("http://localhost:5173/")
        page.wait_for_timeout(2000)

        # 1. Auth / Intake Screen
        # If on login, let's log in or switch to requester flow
        # Let's check if we can log in with a seed user
        # Let's fill email & password
        email_input = page.locator("input[type='text'], input[type='email']").first
        pass_input = page.locator("input[type='password']").first
        
        if email_input.is_visible():
            email_input.fill("requester@lifeline.org")
            pass_input.fill("password123")
            # Click sign in / submit
            submit_btn = page.locator("button[type='submit']").first
            if submit_btn.is_visible():
                submit_btn.click()
                page.wait_for_timeout(2000)

        # Save Emergency Intake screen
        intake_file = os.path.join(SCREENSHOT_DIR, "emergency-intake.png")
        page.screenshot(path=intake_file)
        print(f"Saved: {intake_file}")

        # Fill emergency request text if textarea exists
        textarea = page.locator("textarea")
        if textarea.is_visible():
            textarea.fill("Need O- blood urgently for my father admitted in ICU at Fortis Hospital Jaipur. Surgery scheduled in 2 hours.")
            page.wait_for_timeout(500)
            intake_filled_file = os.path.join(SCREENSHOT_DIR, "emergency-intake.png")
            page.screenshot(path=intake_filled_file)

            # Click submit to view matches
            find_btn = page.locator("button:has-text('Find Matching Donors'), button:has-text('Submit'), button[type='submit']").first
            if find_btn.is_visible():
                find_btn.click()
                page.wait_for_timeout(3000)

        # 2. Matching Candidates Screen
        print("[2/5] Capturing Matching Candidates Screen...")
        matching_file = os.path.join(SCREENSHOT_DIR, "matching-screen.png")
        page.screenshot(path=matching_file)
        print(f"Saved: {matching_file}")

        # Click Reserve on the first candidate if available
        reserve_btn = page.locator("button:has-text('Reserve Donor'), button:has-text('Reserve')").first
        if reserve_btn.is_visible():
            reserve_btn.click()
            page.wait_for_timeout(2500)

        # 3. Reservation Status Screen
        print("[3/5] Capturing Reservation Status Screen...")
        reservation_file = os.path.join(SCREENSHOT_DIR, "reservation-status.png")
        page.screenshot(path=reservation_file)
        print(f"Saved: {reservation_file}")

        # 4. Donor Dashboard Screen
        print("[4/5] Capturing Donor Dashboard Screen...")
        page.goto("http://localhost:5173/dashboard")
        page.wait_for_timeout(2000)
        # If redirected to login, login as donor
        if "login" in page.url:
            email_input = page.locator("input[type='text'], input[type='email']").first
            pass_input = page.locator("input[type='password']").first
            if email_input.is_visible():
                email_input.fill("donor@lifeline.org")
                pass_input.fill("password123")
                page.locator("button[type='submit']").first.click()
                page.wait_for_timeout(2000)
        
        dashboard_file = os.path.join(SCREENSHOT_DIR, "donor-dashboard.png")
        page.screenshot(path=dashboard_file)
        print(f"Saved: {dashboard_file}")

        # 5. Audit Verify Screen
        print("[5/5] Capturing Audit Verify Screen...")
        page.goto("http://localhost:5173/audit")
        page.wait_for_timeout(2000)
        audit_file = os.path.join(SCREENSHOT_DIR, "audit-verify.png")
        page.screenshot(path=audit_file)
        print(f"Saved: {audit_file}")

        browser.close()
        print("All screenshots captured cleanly without browser DevTools!")

if __name__ == "__main__":
    run()
