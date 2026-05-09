#!/usr/bin/env python3
"""
Fix WhatsApp template categories — move MARKETING templates to UTILITY.

Meta doesn't allow in-place category changes, so the process is:
  1. List all templates and find non-UTILITY ones (skip AUTHENTICATION — required for OTP)
  2. Delete the MARKETING templates
  3. Wait for deletion to propagate
  4. Recreate them as UTILITY

Usage (run on portal server):
  python3 wa_fix_category.py list        # show all templates + categories
  python3 wa_fix_category.py fix         # delete MARKETING, recreate as UTILITY
"""
import json, urllib.request, sys, time

ENV_FILE = "/var/www/stibe-portal/.env.local"

def read_env(key):
    for line in open(ENV_FILE):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    return None

token = read_env("WHATSAPP_API_TOKEN")
waba_id = read_env("WHATSAPP_BUSINESS_ACCOUNT_ID")
action = sys.argv[1] if len(sys.argv) > 1 else "list"

API = "https://graph.facebook.com/v21.0"

def body(text, examples):
    return [{"type": "BODY", "text": text, "example": {"body_text": [examples]}}]

# Templates that need to be recreated as UTILITY (currently MARKETING)
RECREATE_AS_UTILITY = {
    "stibe_onboarding": {
        "name": "stibe_onboarding",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Welcome to stibe Learning, {{1}}!\n\nYour {{2}} account has been created successfully.\n\nLogin at: {{3}}\nRegistered email: {{4}}\n\nPlease check your email for login credentials and change your password after first login.\n\nstibe Learning",
            ["Ramesh", "student", "https://stibelearning.online", "ramesh@example.com"]
        ),
    },
    "stibe_demo_confirmed": {
        "name": "stibe_demo_confirmed",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your {{2}} demo session is confirmed!\n\nTeacher: {{3}}\nTime: {{4}}\nJoin: {{5}}\n\nThis session is FREE!",
            ["Ramesh", "Mathematics", "Priya Sharma", "15 Jan 2025 at 10:00 AM", "https://stibelearning.online/room/demo"]
        ),
    },
    "stibe_leave_impact": {
        "name": "stibe_leave_impact",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, some of your upcoming sessions have been affected by a teacher leave.\n\nTeacher: {{2}}\nLeave period: {{3}}\nAffected sessions: {{4}}\n\nPlease check your stibe Learning dashboard for rescheduled classes.\n\nstibe Learning",
            ["Ramesh", "Priya Sharma", "15 Jan 2025 to 17 Jan 2025", "3 sessions cancelled"]
        ),
    },
    "stibe_payment_confirm": {
        "name": "stibe_payment_confirm",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, payment of {{2}} received.\n\nTransaction: {{3}}\nDate: {{4}}\n\nThank you!\nstibe Learning",
            ["Ramesh", "Rs. 5,000", "TXN123456", "15 Jan 2025"]
        ),
    },
    "stibe_payment_due": {
        "name": "stibe_payment_due",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, payment of {{2}} for {{3}} is due by {{4}}.\n\nInvoice: {{5}}\n\nPay online at your stibe dashboard.",
            ["Ramesh", "Rs. 5,000", "January 2025 Tuition", "31 Jan 2025", "INV-2025-001"]
        ),
    },
}

# Categories that cannot be changed (Meta requirement)
SKIP_CATEGORIES = {"AUTHENTICATION"}  # OTP must stay AUTHENTICATION

def api_call(method, url, data=None):
    payload = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json", "Authorization": "Bearer %s" % token},
        method=method,
    )
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def list_templates():
    """List all templates with their categories."""
    url = "%s/%s/message_templates?fields=name,status,category,rejected_reason&limit=100" % (API, waba_id)
    status, data = api_call("GET", url)
    if status != 200:
        print("Error fetching templates:", data)
        return []

    templates = data.get("data", [])
    non_utility = []

    print("\n%-35s %-12s %-15s" % ("TEMPLATE NAME", "STATUS", "CATEGORY"))
    print("-" * 65)
    for t in sorted(templates, key=lambda x: x["name"]):
        cat = t.get("category", "?")
        marker = ""
        if cat != "UTILITY":
            if cat in SKIP_CATEGORIES:
                marker = "  (required — cannot change)"
            else:
                marker = "  ← NEEDS FIX"
                non_utility.append(t)
        print("%-35s %-12s %-15s%s" % (t["name"], t["status"], cat, marker))

    print("\nTotal: %d templates" % len(templates))
    if non_utility:
        print("Non-UTILITY (fixable): %d" % len(non_utility))
        for t in non_utility:
            print("  - %s (%s)" % (t["name"], t["category"]))

    return non_utility


def fix_categories():
    """Delete MARKETING templates and recreate as UTILITY."""
    print("=== STEP 1: Find non-UTILITY templates ===\n")
    non_utility = list_templates()

    if not non_utility:
        print("\nAll templates are already UTILITY (or AUTHENTICATION for OTP). Nothing to fix!")
        return

    # Filter to only the ones we have recreate definitions for
    to_fix = [t for t in non_utility if t["name"] in RECREATE_AS_UTILITY]
    unknown = [t for t in non_utility if t["name"] not in RECREATE_AS_UTILITY]

    if unknown:
        print("\nWARNING: These MARKETING templates don't have UTILITY definitions yet:")
        for t in unknown:
            print("  - %s (%s)" % (t["name"], t["category"]))
        print("  Add them to RECREATE_AS_UTILITY dict to include them.\n")

    if not to_fix:
        print("\nNo templates to fix (missing recreate definitions).")
        return

    print("\n=== STEP 2: Delete %d MARKETING template(s) ===" % len(to_fix))
    for t in to_fix:
        del_url = "%s/%s/message_templates?name=%s" % (API, waba_id, t["name"])
        ds, dd = api_call("DELETE", del_url)
        if ds == 200:
            print("  DELETED %s" % t["name"])
        else:
            msg = dd.get("error", {}).get("message", str(dd))
            print("  DELETE FAILED %s: %s" % (t["name"], msg))
        time.sleep(0.3)

    print("\n=== STEP 3: Wait 5s for deletion to propagate ===")
    time.sleep(5)

    print("\n=== STEP 4: Recreate as UTILITY ===")
    url = "%s/%s/message_templates" % (API, waba_id)
    ok = fail = 0
    for t in to_fix:
        tpl = RECREATE_AS_UTILITY[t["name"]]
        status, data = api_call("POST", url, tpl)
        if status == 200:
            print("  OK  %s → UTILITY (id=%s)" % (tpl["name"], data.get("id", "?")))
            ok += 1
        else:
            msg = data.get("error", {}).get("error_user_msg") or data.get("error", {}).get("message", "?")
            code = data.get("error", {}).get("code", "?")
            print("  FAIL %s: %s (code %s)" % (tpl["name"], msg, code))
            fail += 1
        time.sleep(0.5)

    print("\nDone: %d fixed, %d failed" % (ok, fail))


if action == "list":
    list_templates()
elif action == "fix":
    fix_categories()
else:
    print("Usage: python3 wa_fix_category.py [list|fix]")
