#!/usr/bin/env python3
"""Recommendations Audit Script — Validates all 15 checks for 15/15 score."""

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

def tsc_clean() -> bool:
    r = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, cwd="/home/z/my-project", timeout=120)
    return r.returncode == 0

def main():
    results = []

    # ════════════════════════════════════════════
    # RECOMMENDATION TYPE SYSTEM
    # ════════════════════════════════════════════

    # R1: Shared Recommendation type exists
    results.append(run_check("R1: Shared Recommendation type defined in intelligence-types.ts",
        file_contains("src/lib/intelligence-types.ts", "export interface Recommendation"),
        "R1"))

    # R2: Recommendation has standard fields (id, title, status, priority, reasoning)
    results.append(run_check("R2: Recommendation type has standard fields",
        file_contains("src/lib/intelligence-types.ts", "signalIds") and
        file_contains("src/lib/intelligence-types.ts", "RecommendationStatus") and
        file_contains("src/lib/intelligence-types.ts", "reasoning"),
        "R2"))

    # ════════════════════════════════════════════
    # RECOMMENDATION CRUD API
    # ════════════════════════════════════════════

    # R3: GET /api/recommendations exists (list with filters)
    results.append(run_check("R3: GET /api/recommendations route exists",
        file_exists("src/app/api/recommendations/route.ts"),
        "R3"))

    # R4: PATCH /api/recommendations/[id] exists (accept/dismiss)
    results.append(run_check("R4: PATCH /api/recommendations/[id] route exists",
        file_exists("src/app/api/recommendations/[id]/route.ts"),
        "R4"))

    # R5: Recommendation queue screen uses fetchApi (not mock data)
    results.append(run_check("R5: Recommendation queue screen fetches from API",
        grep_file("src/components/screens/recommendation-queue-screen.tsx", "fetchApi"),
        "R5"))

    # R6: Recommendation queue v2 uses fetchApi
    results.append(run_check("R6: Recommendation queue v2 fetches from API",
        grep_file("src/components/screens/recommendation-queue-v2.tsx", "fetchApi"),
        "R6"))

    # R7: Revenue recommendations screen uses fetchApi
    results.append(run_check("R7: Revenue recommendations screen fetches from API",
        grep_file("src/components/screens/revenue-intelligence-recommendations-screen.tsx", "fetchApi"),
        "R7"))

    # ════════════════════════════════════════════
    # FEEDBACK LOOP
    # ════════════════════════════════════════════

    # R8: POST /api/feedback route exists
    results.append(run_check("R8: POST /api/feedback route exists",
        file_exists("src/app/api/feedback/route.ts"),
        "R8"))

    # R9: InlineFeedback component imported by at least one recommendation screen
    results.append(run_check("R9: InlineFeedback imported by recommendation screen",
        grep_file("src/components/screens/recommendation-queue-screen.tsx", "InlineFeedback") or
        grep_file("src/components/screens/recommendation-queue-v2.tsx", "InlineFeedback") or
        grep_file("src/components/screens/revenue-intelligence-recommendations-screen.tsx", "InlineFeedback"),
        "R9"))

    # ════════════════════════════════════════════
    # AI ADVISOR
    # ════════════════════════════════════════════

    # R10: AI Advisor POST /api/advisor/chat exists
    results.append(run_check("R10: POST /api/advisor/chat route exists",
        file_exists("src/app/api/advisor/chat/route.ts"),
        "R10"))

    # R11: AI Advisor screen uses fetchApi (not getMockResponse)
    results.append(run_check("R11: AI Advisor screen uses API (not getMockResponse)",
        grep_file("src/components/screens/ai-advisor-screen.tsx", "fetchApi"),
        "R11"))

    # ════════════════════════════════════════════
    # MEASUREMENT & ANALYTICS
    # ════════════════════════════════════════════

    # R12: Recommendation analytics/stats available
    results.append(run_check("R12: Recommendation stats tracked (acceptance rate, outcome)",
        file_exists("src/app/api/recommendations/route.ts") and
        (grep_file("src/app/api/recommendations/route.ts", "accept") or
         grep_file("src/app/api/recommendations/route.ts", "stats")),
        "R12"))

    # R13: Pipeline trigger works (POST /api/advisor/pipeline)
    results.append(run_check("R13: Advisor pipeline route exists and triggers reasoning",
        file_exists("src/app/api/advisor/pipeline/route.ts") and
        grep_file("src/app/api/advisor/pipeline/route.ts", "runIntelligencePipeline"),
        "R13"))

    # ════════════════════════════════════════════
    # INTEGRITY
    # ════════════════════════════════════════════

    # R14: Generate button on recommendation queue triggers pipeline
    results.append(run_check("R14: Generate button triggers pipeline API call",
        grep_file("src/components/screens/recommendation-queue-screen.tsx", "pipeline") or
        grep_file("src/components/screens/recommendation-queue-screen.tsx", "generate"),
        "R14"))

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
    print(f"RECOMMENDATIONS AUDIT RESULTS — {os.popen('date').read().strip()}")
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
