"""
Automated clean screenshot capturer capturing all 5 real UI screens without console.
"""
import os
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.abspath("docs/screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def capture_all():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ----------------------------------------------------
        # 1. REQUESTER FLOW (Intake, Matching, Reservation, Audit)
        # ----------------------------------------------------
        print("--- [1/2] Requester Flow ---", flush=True)
        req_ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2
        )
        page1 = req_ctx.new_page()

        # Login as requester
        page1.goto("http://localhost:5173/login")
        page1.wait_for_timeout(1000)

        signin_tab = page1.locator("button[type='button']:has-text('Sign In')")
        if signin_tab.count() > 0:
            signin_tab.first.click()

        page1.locator("input[type='text'], input[type='email']").first.fill("requester@lifeline.org")
        page1.locator("input[type='password']").first.fill("password123")
        page1.locator("button[type='submit']").first.click()

        page1.wait_for_url("**/intake", timeout=10000)
        page1.wait_for_timeout(1500)

        # 1. Emergency Intake Screenshot
        textarea = page1.locator("textarea")
        textarea.fill("Need AB+ blood urgently for accident victim admitted at SMS Hospital Jaipur. Surgery scheduled in 1 hour.")
        page1.wait_for_timeout(1000)

        intake_path = os.path.join(SCREENSHOT_DIR, "emergency-intake.png")
        page1.screenshot(path=intake_path)
        print(f"1. Captured: {intake_path}", flush=True)

        # Submit emergency request
        page1.locator("button[type='submit']").first.click()
        page1.wait_for_url("**/matches", timeout=12000)
        page1.wait_for_timeout(2500)

        # 2. Matching Candidates Screenshot
        matching_path = os.path.join(SCREENSHOT_DIR, "matching-screen.png")
        page1.screenshot(path=matching_path)
        print(f"2. Captured: {matching_path}", flush=True)

        # Reserve Top Donor
        reserve_btn = page1.locator("button:has-text('Reserve Donor')").first
        if reserve_btn.is_visible():
            reserve_btn.click()
            page1.wait_for_url("**/reservation/**", timeout=10000)
            page1.wait_for_timeout(2500)

            # 3. Reservation Status Screenshot
            res_path = os.path.join(SCREENSHOT_DIR, "reservation-status.png")
            page1.screenshot(path=res_path)
            print(f"3. Captured: {res_path}", flush=True)

        # 4. Audit Trail Screenshot
        page1.goto("http://localhost:5173/audit")
        page1.wait_for_timeout(2000)
        audit_path = os.path.join(SCREENSHOT_DIR, "audit-verify.png")
        page1.screenshot(path=audit_path)
        print(f"4. Captured: {audit_path}", flush=True)

        req_ctx.close()

        # ----------------------------------------------------
        # 2. DONOR FLOW (Dr. Aarav Sharma)
        # ----------------------------------------------------
        print("\n--- [2/2] Donor Flow ---", flush=True)
        donor_ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2
        )
        page2 = donor_ctx.new_page()

        page2.goto("http://localhost:5173/login")
        page2.wait_for_timeout(1000)

        signin_tab = page2.locator("button[type='button']:has-text('Sign In')")
        if signin_tab.count() > 0:
            signin_tab.first.click()

        page2.locator("input[type='text'], input[type='email']").first.fill("aarav@lifeline.org")
        page2.locator("input[type='password']").first.fill("password123")
        page2.locator("button[type='submit']").first.click()

        page2.wait_for_url("**/dashboard", timeout=10000)
        page2.wait_for_timeout(2500)

        # 5. Donor Dashboard Screenshot
        donor_path = os.path.join(SCREENSHOT_DIR, "donor-dashboard.png")
        page2.screenshot(path=donor_path)
        print(f"5. Captured: {donor_path}", flush=True)

        donor_ctx.close()
        browser.close()
        print("\nSUCCESS: All 5 clean UI screenshots captured perfectly!", flush=True)

if __name__ == "__main__":
    capture_all()
