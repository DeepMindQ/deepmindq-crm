#!/usr/bin/env python3
"""
Phase 1: API Health Check — Hit every production API endpoint,
record status code, response time, data presence, and shape.
"""

import json
import time
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://deepmindq-crm.vercel.app"

# All 117 API routes — categorized
ENDPOINTS = {
  "Core Data": [
    ("GET",  "/api/contacts"),
    ("GET",  "/api/contacts/test-id"),
    ("GET",  "/api/companies"),
    ("GET",  "/api/companies/meta"),
    ("GET",  "/api/companies/stats"),
    ("GET",  "/api/leads"),
    ("GET",  "/api/leads/source-stats"),
    ("GET",  "/api/leads/status"),
    ("GET",  "/api/segments"),
    ("GET",  "/api/batches"),
    ("GET",  "/api/drafts"),
    ("GET",  "/api/queue"),
    ("GET",  "/api/replies"),
    ("GET",  "/api/bounces"),
    ("GET",  "/api/suppressions"),
    ("GET",  "/api/duplicates"),
    ("GET",  "/api/templates"),
    ("GET",  "/api/signals"),
  ],
  "Dashboard & Analytics": [
    ("GET",  "/api/dashboard"),
    ("GET",  "/api/analytics"),
    ("GET",  "/api/audit"),
    ("GET",  "/api/audit-logs"),
    ("GET",  "/api/notifications"),
    ("GET",  "/api/stats"),
    ("GET",  "/api/pipeline"),
    ("GET",  "/api/data-health"),
    ("GET",  "/api/compliance"),
  ],
  "AI Routes": [
    ("POST", "/api/ai/chat"),
    ("POST", "/api/ai/generate"),
    ("POST", "/api/ai/query"),
    ("POST", "/api/ai/insights"),
    ("POST", "/api/ai/recommendations"),
    ("POST", "/api/ai/opportunities"),
    ("POST", "/api/ai/signals"),
    ("POST", "/api/ai/score-leads"),
    ("POST", "/api/ai/enrich"),
    ("POST", "/api/ai/summarize"),
    ("POST", "/api/ai/account-brief"),
    ("POST", "/api/ai/conversation-plan"),
    ("POST", "/api/ai/relationship-memory"),
    ("POST", "/api/ai/suggested-contacts"),
    ("GET",  "/api/ai/insights"),
    ("GET",  "/api/ai/recommendations"),
    ("GET",  "/api/ai/opportunities"),
    ("GET",  "/api/ai/relationship-memory"),
  ],
  "Research & Strategy": [
    ("POST", "/api/research-agent"),
    ("GET",  "/api/strategy-room"),
    ("GET",  "/api/playbooks"),
    ("GET",  "/api/conversation-plans"),
    ("GET",  "/api/prompt-templates"),
    ("GET",  "/api/knowledge"),
    ("GET",  "/api/knowledge/graph"),
    ("GET",  "/api/knowledge/search"),
    ("GET",  "/api/capabilities"),
  ],
  "Sequences": [
    ("GET",  "/api/sequences"),
    ("POST", "/api/sequences/enroll"),
    ("POST", "/api/sequences/process"),
  ],
  "Command Center": [
    ("GET",  "/api/command-center/insights"),
    ("POST", "/api/command-center/query"),
  ],
  "Settings & Team": [
    ("GET",  "/api/settings"),
    ("GET",  "/api/team/performance"),
  ],
  "System": [
    ("POST", "/api/seed"),
    ("GET",  "/api/verify-email"),
    ("GET",  "/api/verify-queue"),
    ("POST", "/api/webhooks/bounce"),
    ("POST", "/api/webhooks/reply"),
    ("GET",  "/api/tracking/open"),
    ("GET",  "/api/tracking/click"),
    ("GET",  "/api/unsubscribe"),
  ],
  "Auth": [
    ("GET",  "/api/auth/me"),
  ],
}

# POST bodies for routes that need them
POST_BODIES = {
  "/api/ai/chat": json.dumps({"message": "test", "conversationId": "test"}).encode(),
  "/api/ai/generate": json.dumps({"type": "email", "contactId": "test"}).encode(),
  "/api/ai/query": json.dumps({"query": "test"}).encode(),
  "/api/ai/enrich": json.dumps({"contactId": "test"}).encode(),
  "/api/ai/summarize": json.dumps({"text": "test"}).encode(),
  "/api/ai/account-brief": json.dumps({"companyId": "test"}).encode(),
  "/api/ai/conversation-plan": json.dumps({"contactId": "test"}).encode(),
  "/api/ai/relationship-memory": json.dumps({"contactId": "test"}).encode(),
  "/api/ai/suggested-contacts": json.dumps({"companyId": "test"}).encode(),
  "/api/ai/score-leads": json.dumps({"contactIds": ["test"]}).encode(),
  "/api/ai/signals": json.dumps({"companyId": "test"}).encode(),
  "/api/ai/opportunities": json.dumps({}).encode(),
  "/api/ai/recommendations": json.dumps({}).encode(),
  "/api/research-agent": json.dumps({"query": "NovaTech Solutions", "type": "company"}).encode(),
  "/api/strategy-room": json.dumps({"title": "Test Strategy"}).encode(),
  "/api/playbooks": json.dumps({"name": "Test Playbook"}).encode(),
  "/api/conversation-plans": json.dumps({"contactId": "test"}).encode(),
  "/api/prompt-templates": json.dumps({"name": "test", "systemPrompt": "test", "userPromptTemplate": "test"}).encode(),
  "/api/sequences/enroll": json.dumps({"contactIds": ["test"], "sequenceId": "test"}).encode(),
  "/api/sequences/process": json.dumps({}).encode(),
  "/api/command-center/query": json.dumps({"query": "test"}).encode(),
  "/api/seed": b"",
  "/api/webhooks/bounce": json.dumps({"email": "test@test.com", "reason": "test"}).encode(),
  "/api/webhooks/reply": json.dumps({"email": "test@test.com", "body": "test"}).encode(),
  "/api/knowledge/search": json.dumps({"query": "test"}).encode(),
}


def hit_endpoint(method, path):
    url = BASE + path
    start = time.time()
    status = 0
    resp_len = 0
    has_data = False
    is_error = False
    error_msg = ""
    content_type = ""
    body_preview = ""

    try:
        req = Request(url, method=method)
        req.add_header("User-Agent", "DeepMindQ-HealthCheck/1.0")
        req.add_header("Content-Type", "application/json")

        if method == "POST" and path in POST_BODIES:
            req.data = POST_BODIES[path]

        resp = urlopen(req, timeout=15)
        status = resp.status
        content_type = resp.headers.get("Content-Type", "")
        data = resp.read()
        resp_len = len(data)

        # Check if response has meaningful data
        body_str = data.decode("utf-8", errors="replace")
        body_preview = body_str[:200]

        # Determine if data is present (not empty/null/error)
        try:
            parsed = json.loads(body_str)
            if isinstance(parsed, dict):
                if parsed.get("error"):
                    is_error = True
                    error_msg = str(parsed.get("error", ""))[:80]
                elif parsed.get("data") and isinstance(parsed["data"], list) and len(parsed["data"]) > 0:
                    has_data = True
                elif any(v for k, v in parsed.items() if k not in ("data",) and v and v != 0 and v != []):
                    has_data = True
            elif isinstance(parsed, list) and len(parsed) > 0:
                has_data = True
        except:
            if len(body_str.strip()) > 5:
                has_data = True

    except HTTPError as e:
        status = e.code
        try:
            body_str = e.read().decode("utf-8", errors="replace")
            body_preview = body_str[:200]
            resp_len = len(body_str)
            is_error = True
            error_msg = body_str[:80]
        except:
            error_msg = str(e)[:80]
    except URLError as e:
        status = 0
        is_error = True
        error_msg = str(e.reason)[:80] if hasattr(e, 'reason') else str(e)[:80]
    except Exception as e:
        status = 0
        is_error = True
        error_msg = str(e)[:80]
    finally:
        elapsed = time.time() - start

    return {
        "method": method,
        "path": path,
        "status": status,
        "time_ms": round(elapsed * 1000),
        "resp_bytes": resp_len,
        "content_type": content_type.split(";")[0].strip(),
        "has_data": has_data,
        "is_error": is_error,
        "error_msg": error_msg,
        "body_preview": body_preview[:120],
    }


def main():
    # Flatten all endpoints
    all_eps = []
    for category, eps in ENDPOINTS.items():
        for method, path in eps:
            all_eps.append((category, method, path))

    print(f"Phase 1: API Health Check")
    print(f"Base URL: {BASE}")
    print(f"Total endpoints to test: {len(all_eps)}")
    print(f"{'='*90}")
    print()

    results = []

    # Run in parallel (max 8 concurrent)
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {}
        for cat, method, path in all_eps:
            f = pool.submit(hit_endpoint, method, path)
            futures[f] = (cat, method, path)

        for f in as_completed(futures):
            cat, method, path = futures[f]
            try:
                r = f.result()
                r["category"] = cat
                results.append(r)
            except Exception as e:
                results.append({
                    "category": cat, "method": method, "path": path,
                    "status": 0, "time_ms": 0, "resp_bytes": 0,
                    "content_type": "", "has_data": False, "is_error": True,
                    "error_msg": str(e)[:80], "body_preview": "",
                })

    # Sort by category then path
    results.sort(key=lambda x: (x["category"], x["path"]))

    # Print report
    status_icons = {200: "✅", 201: "✅", 204: "✅", 400: "⚠️", 401: "🔒", 403: "🔒", 404: "❌", 405: "⚠️", 500: "💥", 502: "💥", 503: "⚠️", 0: "🔥"}

    # Summary counts
    total = len(results)
    ok_200 = sum(1 for r in results if r["status"] in (200, 201, 204))
    empty = sum(1 for r in results if r["status"] in (200, 201, 204) and not r["has_data"])
    with_data = sum(1 for r in results if r["has_data"])
    err_5xx = sum(1 for r in results if r["status"] >= 500)
    err_4xx = sum(1 for r in results if 400 <= r["status"] < 500)
    conn_fail = sum(1 for r in results if r["status"] == 0)

    # Per-category summary
    categories = {}
    for r in results:
        cat = r["category"]
        if cat not in categories:
            categories[cat] = {"total": 0, "ok": 0, "data": 0, "empty": 0, "err": 0}
        categories[cat]["total"] += 1
        if r["status"] in (200, 201, 204):
            categories[cat]["ok"] += 1
            if r["has_data"]:
                categories[cat]["data"] += 1
            else:
                categories[cat]["empty"] += 1
        else:
            categories[cat]["err"] += 1

    # Print category summary
    print(f"{'CATEGORY':<25} {'TOTAL':>5} {'OK':>5} {'DATA':>5} {'EMPTY':>5} {'ERR':>5}")
    print(f"{'─'*25} {'─'*5} {'─'*5} {'─'*5} {'─'*5} {'─'*5}")
    for cat, c in categories.items():
        print(f"{cat:<25} {c['total']:>5} {c['ok']:>5} {c['data']:>5} {c['empty']:>5} {c['err']:>5}")
    print(f"{'─'*25} {'─'*5} {'─'*5} {'─'*5} {'─'*5} {'─'*5}")
    print(f"{'TOTAL':<25} {total:>5} {ok_200:>5} {with_data:>5} {empty:>5} {err_5xx + err_4xx + conn_fail:>5}")
    print()

    # Print detailed results
    current_cat = ""
    for r in results:
        if r["category"] != current_cat:
            current_cat = r["category"]
            print(f"\n{'━'*90}")
            print(f"  {current_cat}")
            print(f"{'━'*90}")

        icon = status_icons.get(r["status"], "❓")
        data_tag = " 📊" if r["has_data"] else (" ⚠️EMPTY" if r["status"] in (200, 201) else "")
        err_tag = f" ← {r['error_msg']}" if r["is_error"] and r["error_msg"] else ""

        print(f"  {icon} {r['method']:>4} {r['path']:<45} {r['status']:>3}  {r['time_ms']:>5}ms  {r['resp_bytes']:>6}B{data_tag}{err_tag}")

    print(f"\n{'='*90}")
    print(f"OVERALL: {ok_200}/{total} endpoints return 2xx | {with_data} have real data | {empty} return empty | {err_5xx + err_4xx + conn_fail} errors")

    # Save JSON report
    report_path = "/home/z/my-project/download/phase1-api-health-report.json"
    with open(report_path, "w") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "base_url": BASE,
            "summary": {
                "total": total,
                "ok_2xx": ok_200,
                "with_data": with_data,
                "empty_2xx": empty,
                "errors_4xx": err_4xx,
                "errors_5xx": err_5xx,
                "connection_failures": conn_fail,
            },
            "by_category": categories,
            "results": results,
        }, f, indent=2)

    print(f"\nFull report saved to: {report_path}")


if __name__ == "__main__":
    main()