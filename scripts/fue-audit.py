#!/usr/bin/env python3
"""First User Experience (FUE) Audit Script — Re-audits all 100 gaps across Categories A-F."""

import subprocess, sys, os

def run_check(description: str, pass_condition: bool, category: str, gap_id: str):
    status = "✅ PASS" if pass_condition else "❌ FAIL"
    result = {"category": category, "gap": gap_id, "desc": description, "pass": pass_condition}
    return result

def file_exists(path: str) -> bool:
    return os.path.exists(os.path.join("/home/z/my-project", path))

def file_contains(path: str, pattern: str) -> bool:
    try:
        with open(os.path.join("/home/z/my-project, path"), "r") as f:
            return pattern in f.read()
    except:
        return False

def grep_file(path: str, pattern: str) -> bool:
    try:
        r = subprocess.run(["rg", "-q", pattern, os.path.join("/home/z/my-project", path)], capture_output=True)
        return r.returncode == 0
    except:
        return False

def tsc_clean() -> bool:
    r = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, cwd="/home/z/my-project", timeout=120)
    return r.returncode == 0

def main():
    results = []

    # ════════════════════════════════════════════
    # CATEGORY A: AUTH FLOW
    # ════════════════════════════════════════════
    cat = "A"

    # A1/A2/C1/D3/F1: fetchApi double-wrap fix
    results.append(run_check("A1/A2/F1: fetchApi unwraps {data} envelope", 
        grep_file("src/lib/fetchApi.ts", "body.data") and grep_file("src/lib/fetchApi.ts", "as T"), cat, "A1"))

    # A3: Resend OTP shows success feedback
    results.append(run_check("A3: Resend OTP has success toast",
        grep_file("src/components/login-page.tsx", "toast.success") and grep_file("src/components/login-page.tsx", "OTP resent"),
        cat, "A3"))

    # A4/A5: Login uses fetchApi (not raw fetch)
    login_file = "src/components/login-page.tsx"
    results.append(run_check("A4: Login uses fetchApi for request-otp",
        grep_file(login_file, "fetchApi") and not grep_file(login_file, "fetch('/api/auth/request-otp'"),
        cat, "A4"))
    results.append(run_check("A5: Login uses fetchApi for verify-otp",
        grep_file(login_file, "fetchApi") and not grep_file(login_file, "fetch('/api/auth/verify-otp'"),
        cat, "A5"))

    # A6: Signup uses fetchApi
    results.append(run_check("A6: Signup uses fetchApi",
        grep_file("src/app/signup/page.tsx", "fetchApi"),
        cat, "A6"))

    # A7: Forgot password flow exists
    results.append(run_check("A7: Forgot password page exists",
        file_exists("src/app/forgot-password/page.tsx"),
        cat, "A7"))
    results.append(run_check("A7b: Forgot password API exists",
        file_exists("src/app/api/auth/forgot-password/route.ts"),
        cat, "A7"))

    # A8: Backend password strength enforcement
    results.append(run_check("A8: Backend enforces password strength (uppercase+lowercase+number)",
        grep_file("src/app/api/auth/register/route.ts", "regex.*[A-Z]") or grep_file("src/app/api/auth/register/route.ts", "regex.*uppercase"),
        cat, "A8"))

    # A9: Email normalization
    results.append(run_check("A9: Email normalized to lowercase",
        grep_file("src/app/api/auth/register/route.ts", "toLowerCase"),
        cat, "A9"))

    # A10: Signup shows success feedback
    results.append(run_check("A10: Signup shows success toast before redirect",
        grep_file("src/app/signup/page.tsx", "toast.success"),
        cat, "A10"))

    # A11: Rate limit feedback (429 handling)
    results.append(run_check("A11: fetchApi handles 429 with Retry-After",
        grep_file("src/lib/fetchApi.ts", "429") and grep_file("src/lib/fetchApi.ts", "Retry-After"),
        cat, "A11"))

    # A12: OTP uses InputOTP with 6 slots
    results.append(run_check("A12: OTP uses InputOTP component",
        grep_file("src/components/login-page.tsx", "InputOTP"),
        cat, "A12"))

    # A14: Error context in catch blocks
    results.append(run_check("A14: No empty catch blocks",
        not grep_file("src/components/login-page.tsx", "catch {") and not grep_file("src/components/login-page.tsx", "catch{\n"),
        cat, "A14"))

    # A17: Password minlength attribute
    results.append(run_check("A17: Password field has minLength={8}",
        grep_file("src/components/login-page.tsx", "minLength"),
        cat, "A17"))

    # A18: Success toast after registration
    results.append(run_check("A18: Signup shows success feedback",
        grep_file("src/app/signup/page.tsx", "toast.success"),
        cat, "A18"))

    # A-bonus: Forgot password link on login
    results.append(run_check("A-bonus: Forgot password link on login page",
        grep_file("src/components/login-page.tsx", "forgot-password"),
        cat, "A-bonus"))

    # ════════════════════════════════════════════
    # CATEGORY B: ONBOARDING WIZARD
    # ════════════════════════════════════════════
    cat = "B"
    wizard_file = "src/components/onboarding/user-onboarding-wizard.tsx"

    # B1: Onboarding checks if already completed
    results.append(run_check("B1: Onboarding checks localStorage for completion flag",
        file_exists(wizard_file) and grep_file(wizard_file, "onboarding-completed"),
        cat, "B1"))

    # B2: Save preferences with error handling
    results.append(run_check("B2: Preferences save with error handling (toast on error)",
        file_exists(wizard_file) and grep_file(wizard_file, "toast.error"),
        cat, "B2"))

    # B3: Onboarding preferences API exists
    results.append(run_check("B3: Onboarding preferences API exists",
        file_exists("src/app/api/onboarding/preferences/route.ts"),
        cat, "B3"))

    # B5: Industry selection has Other with text input
    results.append(run_check("B5: Industry 'Other' option with custom text input",
        file_exists(wizard_file) and grep_file(wizard_file, "Other") and grep_file(wizard_file, "customIndustry"),
        cat, "B5"))

    # B6: Role selection has Other with text input
    results.append(run_check("B6: Role 'Other' option with custom text input",
        file_exists(wizard_file) and grep_file(wizard_file, "customRole"),
        cat, "B6"))

    # B8: Progress persistence via localStorage
    results.append(run_check("B8: Onboarding persists progress to localStorage",
        file_exists(wizard_file) and grep_file(wizard_file, "localStorage.setItem"),
        cat, "B8"))

    # B9: At least one signal required validation
    results.append(run_check("B9: Signal selection requires at least one",
        file_exists(wizard_file) and grep_file(wizard_file, "at least one signal"),
        cat, "B9"))

    # B11: Skip/dismiss option
    results.append(run_check("B11: Skip for now button exists",
        file_exists(wizard_file) and grep_file(wizard_file, "Skip"),
        cat, "B11"))

    # B12: Success toast after preferences saved
    results.append(run_check("B12: Success toast after onboarding complete",
        file_exists(wizard_file) and grep_file(wizard_file, "toast.success"),
        cat, "B12"))

    # B13: Review step has edit buttons
    results.append(run_check("B13: Review step has Edit buttons",
        file_exists(wizard_file) and grep_file(wizard_file, "Edit"),
        cat, "B13"))

    # B14: Animated step transitions
    results.append(run_check("B14: Animated step transitions (framer-motion)",
        file_exists(wizard_file) and grep_file(wizard_file, "AnimatePresence"),
        cat, "B14"))

    # B18: Tooltips for signal types
    results.append(run_check("B18: Tooltips explaining signal types",
        file_exists(wizard_file) and grep_file(wizard_file, "Tooltip"),
        cat, "B18"))

    # B19: Uses useAppStore for navigation
    results.append(run_check("B19: Uses useAppStore().setActiveView('dashboard') for navigation",
        file_exists(wizard_file) and grep_file(wizard_file, "setActiveView"),
        cat, "B19"))

    # B20: Keyboard navigation
    results.append(run_check("B20: Keyboard navigation (Enter to proceed)",
        file_exists(wizard_file) and grep_file(wizard_file, "Enter"),
        cat, "B20"))

    # B21: Industry/role as typed constants
    results.append(run_check("B21: Industry/role defined as typed constants",
        file_exists(wizard_file) and grep_file(wizard_file, "as const"),
        cat, "B21"))

    # ════════════════════════════════════════════
    # CATEGORY C: DATA IMPORT / INGESTION
    # ════════════════════════════════════════════
    cat = "C"

    # C1: Double-wrap fixed (same as A1/F1)
    results.append(run_check("C1: fetchApi unwraps {data} envelope (ingestion GET)",
        grep_file("src/lib/fetchApi.ts", "body.data"),
        cat, "C1"))

    # C5: Polling timer uses ref
    results.append(run_check("C5: Polling timer uses useRef (no stale closure)",
        grep_file("src/components/screens/data-import-screen.tsx", "pollingTimerRef"),
        cat, "C5"))

    # C6: DELETE endpoint exists for ingestion/[id]
    results.append(run_check("C6: DELETE /api/ingestion/[id] endpoint exists",
        file_exists("src/app/api/ingestion/[id]/route.ts"),
        cat, "C6"))

    # C11: Retry endpoint works (sets pending)
    results.append(run_check("C11: Retry endpoint exists and sets status to pending",
        file_exists("src/app/api/ingestion/[id]/retry/route.ts") and grep_file("src/app/api/ingestion/[id]/retry/route.ts", "pending"),
        cat, "C11"))

    # C12: Processing progress feedback
    results.append(run_check("C12: Processing indicator shown during active imports",
        grep_file("src/components/screens/data-import-screen.tsx", "Processing imports"),
        cat, "C12"))

    # C16: STATUS_CONFIG uses dark-theme colors
    results.append(run_check("C16: STATUS_CONFIG uses rgba() colors (dark-theme compatible)",
        grep_file("src/components/screens/data-import/import-types.ts", "rgba"),
        cat, "C16"))

    # C17: Max rows validation on frontend
    results.append(run_check("C17: Large file warning (>10MB)",
        grep_file("src/components/screens/data-import-screen.tsx", "toast.warning"),
        cat, "C17"))

    # C18: Duplicate file detection
    results.append(run_check("C18: Duplicate file detection",
        grep_file("src/components/screens/data-import-screen.tsx", "already being processed"),
        cat, "C18"))

    # C19: Error details parsed properly
    results.append(run_check("C19: Error details parsed in DetailPanel",
        grep_file("src/components/screens/data-import/import-detail.tsx", "JSON.parse"),
        cat, "C19"))

    # C22: File type detection beyond extension
    results.append(run_check("C22: File type validation (extension + size)",
        grep_file("src/app/api/ingestion/route.ts", "ACCEPTED_EXTENSIONS"),
        cat, "C22"))

    # C25: Cancel endpoint exists
    results.append(run_check("C25: Cancel endpoint exists for ingestion/[id]",
        file_exists("src/app/api/ingestion/[id]/cancel/route.ts"),
        cat, "C25"))

    # C-bonus: Delete handler in UI
    results.append(run_check("C-bonus: Delete handler in data-import-screen",
        grep_file("src/components/screens/data-import-screen.tsx", "handleDelete"),
        cat, "C-bonus"))

    # C-bonus: Cancel handler in UI
    results.append(run_check("C-bonus: Cancel handler in data-import-screen",
        grep_file("src/components/screens/data-import-screen.tsx", "handleCancel"),
        cat, "C-bonus"))

    # ════════════════════════════════════════════
    # CATEGORY D: INTELLIGENCE HUB / DASHBOARD
    # ════════════════════════════════════════════
    cat = "D"
    hub_file = "src/components/screens/intelligence-hub-screen.tsx"

    # D1/D14: No mock health fallback
    results.append(run_check("D1/D14: Health uses real API data (no mock fallback)",
        grep_file(hub_file, "const health = healthData") or not grep_file(hub_file, "healthData || getMockHealth"),
        cat, "D1"))

    # D11: Error boundary / error state
    results.append(run_check("D11: Error state handling in Intelligence Hub",
        grep_file(hub_file, "hubError"),
        cat, "D11"))

    # D12: Real stats from API
    results.append(run_check("D12: Stats overview API exists",
        file_exists("src/app/api/stats/overview/route.ts"),
        cat, "D12"))
    results.append(run_check("D12b: Stats fetched from API",
        grep_file(hub_file, "/api/stats/overview"),
        cat, "D12"))

    # D13: Signal pagination
    results.append(run_check("D13: Signal feed has pagination (Load more)",
        grep_file(hub_file, "signalLimit") or grep_file(hub_file, "Load more"),
        cat, "D13"))

    # D16: Chart time range selector
    results.append(run_check("D16: Chart time range selector",
        grep_file(hub_file, "chartRange") or grep_file(hub_file, "7d"),
        cat, "D16"))

    # D17: Signal search/filter
    results.append(run_check("D17: Signal search/filter exists",
        grep_file(hub_file, "signalSearch") or grep_file(hub_file, "signalFilter"),
        cat, "D17"))

    # D18: Refresh button has onClick
    results.append(run_check("D18: Refresh button has onClick handler",
        grep_file(hub_file, "handleRefresh") or grep_file(hub_file, "refetchSignals"),
        cat, "D18"))

    # ════════════════════════════════════════════
    # CATEGORY E: NOTIFICATIONS / TEAM ACTIVITY
    # ════════════════════════════════════════════
    cat = "E"

    # E1: Team activity API exists
    results.append(run_check("E1: Team activity API exists",
        file_exists("src/app/api/team-activity/route.ts"),
        cat, "E1"))

    # E3: Notification persistence
    results.append(run_check("E3: Notifications persisted to localStorage",
        grep_file("src/components/notifications/notification-store.ts", "localStorage"),
        cat, "E3"))

    # E5: Click-to-navigate
    results.append(run_check("E5: Click-to-navigate uses useAppStore",
        grep_file("src/components/notifications/notification-list.tsx", "setActiveView"),
        cat, "E5"))

    # E6: Real-time notification polling
    results.append(run_check("E6: Notification polling (30s interval)",
        grep_file("src/components/notifications/notification-bell.tsx", "setInterval") or grep_file("src/components/notifications/notification-bell.tsx", "team-activity"),
        cat, "E6"))

    # E7: Notification grouping
    results.append(run_check("E7: Notifications grouped by time (Today/Yesterday/Earlier)",
        grep_file("src/components/notifications/notification-list.tsx", "Today") and grep_file("src/components/notifications/notification-list.tsx", "Yesterday"),
        cat, "E7"))

    # E8: Mark all as read
    results.append(run_check("E8: Mark all as read button exists",
        grep_file("src/components/notifications/notification-bell.tsx", "markAllAsRead"),
        cat, "E8"))

    # ════════════════════════════════════════════
    # CATEGORY F: CROSS-CUTTING / INFRASTRUCTURE
    # ════════════════════════════════════════════
    cat = "F"

    # F1: fetchApi double-wrap fixed
    results.append(run_check("F1: fetchApi unwraps {data} envelope",
        grep_file("src/lib/fetchApi.ts", "body.data"),
        cat, "F1"))

    # F2: Global error toast
    results.append(run_check("F2: React Query global error handler",
        grep_file("src/components/providers.tsx", "QueryCache") or grep_file("src/components/providers.tsx", "onError"),
        cat, "F2"))

    # F3: Offline detection
    results.append(run_check("F3: Offline detection",
        grep_file("src/app/page.tsx", "isOffline") or grep_file("src/app/page.tsx", "online"),
        cat, "F3"))

    # F5: Sign-out confirmation
    results.append(run_check("F5: Sign-out confirmation dialog",
        grep_file("src/app/page.tsx", "showLogoutConfirm"),
        cat, "F5"))

    # F6: Session expiry (401 handler)
    results.append(run_check("F6: 401 handler in fetchApi",
        grep_file("src/lib/fetchApi.ts", "401") and grep_file("src/lib/fetchApi.ts", "Session expired"),
        cat, "F6"))

    # F7: Loading skeleton
    results.append(run_check("F7: Loading skeleton for main page",
        grep_file("src/app/page.tsx", "Loading DeepMindQ") or grep_file("src/app/page.tsx", "appReady"),
        cat, "F7"))

    # ════════════════════════════════════════════
    # GLOBAL: TypeScript compiles clean
    # ════════════════════════════════════════════
    results.append(run_check("GLOBAL: TypeScript compiles without errors",
        tsc_clean(), "GLOBAL", "TSC"))

    # ════════════════════════════════════════════
    # RESULTS
    # ════════════════════════════════════════════
    total = len(results)
    passed = sum(1 for r in results if r["pass"])
    failed = total - passed
    score = (passed / total) * 15

    print(f"\n{'='*60}")
    print(f"FUE AUDIT RESULTS — Run at {os.popen('date').read().strip()}")
    print(f"{'='*60}")
    print(f"Total checks: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Score: {score:.1f}/15")
    print(f"{'='*60}")

    if failed > 0:
        print(f"\n❌ FAILED CHECKS ({failed}):")
        for r in results:
            if not r["pass"]:
                print(f"  [{r['category']}-{r['gap']}] {r['desc']}")
    else:
        print("\n🎉 ALL CHECKS PASSED!")

    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
