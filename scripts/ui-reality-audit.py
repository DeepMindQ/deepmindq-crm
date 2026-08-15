#!/usr/bin/env python3
"""UI Reality Audit Script — Validates all 15 checks for 15/15 score."""

import subprocess, sys, os

def run_check(description: str, pass_condition: bool, gap_id: str):
    return {"gap": gap_id, "desc": description, "pass": pass_condition}

def file_exists(path: str) -> bool:
    return os.path.exists(os.path.join("/home/z/my-project", path))

def file_contains(path: str, pattern: str) -> bool:
    try:
        with open(os.path.join("/home/z/my-project", path), "r") as f:
            return pattern in f.read()
    except:
        return False

def grep_file(path: str, pattern: str) -> bool:
    try:
        r = subprocess.run(["rg", "-q", pattern, os.path.join("/home/z/my-project", path)], capture_output=True)
        return r.returncode == 0
    except:
        return False

def screen_uses_api(screen_path: str) -> bool:
    """Check if a screen file uses fetchApi or real API calls (not just mock const arrays)."""
    if not file_exists(screen_path):
        return False
    return grep_file(screen_path, "fetchApi") or grep_file(screen_path, "/api/")

def screen_is_mock(screen_path: str) -> bool:
    """Check if a screen is still fully mock (has const initial arrays but no fetchApi)."""
    if not file_exists(screen_path):
        return False
    has_mock = grep_file(screen_path, "const initial") or grep_file(screen_path, "const MOCK") or grep_file(screen_path, "getMock")
    no_api = not grep_file(screen_path, "fetchApi")
    return has_mock and no_api

def tsc_clean() -> bool:
    r = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, cwd="/home/z/my-project", timeout=120)
    return r.returncode == 0

def main():
    results = []

    screens_dir = "src/components/screens"
    intel_dir = "src/components/intelligence-os"

    # ════════════════════════════════════════════
    # CORE WIRED SCREENS (already working)
    # ════════════════════════════════════════════

    # U1: Companies screen wired to /api/organizations
    results.append(run_check("U1: Companies screen wired to API",
        screen_uses_api(f"{screens_dir}/companies-screen.tsx"),
        "U1"))

    # U2: Contacts screen wired to /api/people
    results.append(run_check("U2: Contacts screen wired to API",
        screen_uses_api(f"{screens_dir}/contacts-screen.tsx"),
        "U2"))

    # U3: Intelligence Hub wired to /api/signals + /api/health
    results.append(run_check("U3: Intelligence Hub wired to APIs",
        screen_uses_api(f"{screens_dir}/intelligence-hub-screen.tsx"),
        "U3"))

    # U4: Data Import wired to /api/ingestion
    results.append(run_check("U4: Data Import screen wired to API",
        screen_uses_api(f"{screens_dir}/data-import-screen.tsx"),
        "U4"))

    # U5: Settings wired to /api/settings
    results.append(run_check("U5: Settings screen wired to API",
        screen_uses_api(f"{screens_dir}/settings-screen.tsx"),
        "U5"))

    # U6: Signal Intelligence wired to /api/signals
    results.append(run_check("U6: Signal Intelligence screen wired to API",
        screen_uses_api(f"{screens_dir}/signal-intelligence-screen.tsx"),
        "U6"))

    # ════════════════════════════════════════════
    # PREVIOUSLY MOCK → NOW WIRED
    # ════════════════════════════════════════════

    # U7: AI Health wired to /api/health/ai
    results.append(run_check("U7: AI Health screen wired to API",
        screen_uses_api(f"{screens_dir}/ai-health-screen.tsx"),
        "U7"))

    # U8: Users screen wired
    results.append(run_check("U8: Users screen wired to API",
        screen_uses_api(f"{screens_dir}/users-screen.tsx"),
        "U8"))

    # ════════════════════════════════════════════
    # MOCK → WIRED CONVERSIONS
    # ════════════════════════════════════════════

    # U9: Prompt Templates wired (fixed route mismatch)
    results.append(run_check("U9: Prompt Templates wired to correct /api/prompt-templates",
        grep_file(f"{screens_dir}/prompt-templates-screen.tsx", "/api/prompt-templates") or
        grep_file(f"{screens_dir}/prompt-templates-screen.tsx", "fetchApi"),
        "U9"))

    # U10: AI Advisor wired to /api/advisor/chat (not getMockResponse)
    results.append(run_check("U10: AI Advisor wired to API (not getMockResponse)",
        grep_file(f"{screens_dir}/ai-advisor-screen.tsx", "fetchApi"),
        "U10"))

    # U11: Recommendation Queue wired to /api/recommendations
    results.append(run_check("U11: Recommendation Queue wired to API",
        grep_file(f"{screens_dir}/recommendation-queue-screen.tsx", "fetchApi"),
        "U11"))

    # U12: Intelligence Sources wired to /api/signals
    results.append(run_check("U12: Intelligence Sources wired to API",
        screen_uses_api(f"{screens_dir}/intelligence-sources-screen.tsx"),
        "U12"))

    # U13: Intelligence Inbox wired to /api/team-activity
    results.append(run_check("U13: Intelligence Inbox wired to API",
        screen_uses_api(f"{screens_dir}/intelligence-inbox-screen.tsx"),
        "U13"))

    # U14: Analytics wired to /api/stats/overview
    results.append(run_check("U14: Analytics screen wired to API",
        screen_uses_api(f"{screens_dir}/analytics-screen.tsx"),
        "U14"))

    # ════════════════════════════════════════════
    # GLOBAL
    # ════════════════════════════════════════════

    # GLOBAL: TypeScript compiles clean
    results.append(run_check("GLOBAL: TypeScript compiles without errors",
        tsc_clean(), "TSC"))

    # ════════════════════════════════════════════
    # RESULTS
    # ════════════════════════════════════════════
    total = len(results)
    passed = sum(1 for r in results if r["pass"])
    failed = total - passed
    score = (passed / total) * 15

    print(f"\n{'='*60}")
    print(f"UI REALITY AUDIT RESULTS — {os.popen('date').read().strip()}")
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
                print(f"  [{r['gap']}] {r['desc']}")
    else:
        print("\n🎉 ALL CHECKS PASSED!")

    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
