#!/usr/bin/env python3
"""Check all WhatsApp template statuses and send samples for APPROVED ones."""
import json, os, sys, urllib.request, urllib.error

# Read token from .env.local
ENV_FILE = "/var/www/stibe-portal/.env.local"
def read_env():
    env = {}
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip()
    return env

env = read_env()
TOKEN = env.get("WHATSAPP_API_TOKEN", "")
PHONE_ID = env.get("WHATSAPP_PHONE_NUMBER_ID", "")
WABA_ID = env.get("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
# Your own number to receive test messages
TEST_RECIPIENT = "917356072106"

if not TOKEN or not WABA_ID:
    print("ERROR: Missing WHATSAPP_API_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID in .env.local")
    sys.exit(1)

API = "https://graph.facebook.com/v21.0"

def api_get(url):
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def api_post(url, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def send_template(template_name, lang, params):
    """Send a template message to TEST_RECIPIENT."""
    components = []
    if params:
        parameters = [{"type": "text", "text": str(p)} for p in params]
        components.append({"type": "body", "parameters": parameters})
    
    payload = {
        "messaging_product": "whatsapp",
        "to": TEST_RECIPIENT,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": lang},
            "components": components
        }
    }
    return api_post(f"{API}/{PHONE_ID}/messages", payload)

# ── Sample parameters for each template ──
SAMPLE_PARAMS = {
    "hello_world": [],
    "stibe_alert": ["Arun", "Your class has been updated. Please check the portal for details."],
    "stibe_class_reminder": ["Arun", "Mathematics", "10:00 AM", "Mrs. Sharma", "Batch A"],
    "stibe_teacher_class": ["Arun", "Math Class", "Mathematics", "Mar 7, 2026", "10:00 AM", "60 minutes"],
    "stibe_student_class": ["Arun", "Math Class", "Mathematics", "Mar 7, 2026", "10:00 AM", "60 minutes"],
    "stibe_class_cancelled": ["Arun", "Math Class", "Mar 7, 2026", "10:00 AM"],
    "stibe_class_rescheduled": ["Arun", "Math Class", "Mar 7", "10:00 AM", "Mar 8", "11:00 AM"],
    "stibe_class_live": ["Arun", "Mathematics", "Mrs. Sharma", "Join now at stibelearning.online"],
    "stibe_payment_confirm": ["Arun", "Rs. 5,000", "TXN123456", "Mar 6, 2026"],
    "stibe_payment_due": ["Arun", "Rs. 5,000", "March tuition fees", "Mar 15, 2026", "INV-2026-001"],
    "stibe_invoice": ["Arun", "INV-2026-001", "Rs. 5,000", "Mar 15, 2026"],
    "stibe_receipt": ["Arun", "REC-2026-001", "Rs. 5,000", "Mar 6, 2026"],
    "stibe_exam_result": ["Arun", "Mathematics Mid-Term", "85/100", "Grade A"],
    "stibe_onboarding": ["Arun", "stibe Learning", "stibelearning.online", "info.pydart@gmail.com"],
    "stibe_batch_assign": ["Arun", "Mathematics Batch A", "student", "Starts Mar 10, 2026"],
    "stibe_daily_schedule": ["Arun", "Mar 7, 2026", "Math 10AM, Science 2PM, English 4PM"],
    "stibe_weekly_schedule": ["Arun", "Mar 7-13, 2026", "Mon: Math, Wed: Science, Fri: English"],
    "stibe_session_request": ["Arun", "Extra Math class", "Mar 10, 2026", "Requested by Mrs. Sharma"],
    "stibe_request_update": ["Arun", "Extra Math class", "Approved", "Scheduled for Mar 10 at 3PM"],
    "stibe_session_moved": ["Arun", "Math Class", "Mar 8 at 11AM", "Room changed to Lab 2"],
    "stibe_session_cancel": ["Arun", "Extra Math class", "Mar 10, 2026", "Teacher unavailable"],
    "stibe_leave_req": ["Arun", "Mar 10-12, 2026", "Personal reasons", "Pending approval"],
    "stibe_leave_update": ["Arun", "Mar 10-12, 2026", "Approved", "By Principal"],
    "stibe_leave_impact": ["Arun", "Mrs. Sharma", "Mar 10-12, 2026", "Math classes rescheduled"],
    "stibe_payslip": ["Arun", "March 2026", "24", "Rs. 15,000"],
    "stibe_coord_summary": ["Arun", "Math Class", "Mar 6, 2026", "15/20 attended"],
    "stibe_demo_req": ["Arun", "Mathematics demo", "Mar 8, 2026", "Parent: Mr. Kumar"],
    "stibe_demo_confirmed": ["Arun", "Mathematics demo", "Mar 8, 2026", "10:00 AM", "stibelearning.online/demo/abc"],
    "stibe_demo_waiting": ["Arun", "We will confirm your demo shortly."],
}

# ── Main ──
print("=" * 70)
print("WHATSAPP TEMPLATE STATUS CHECK")
print("=" * 70)

# Fetch all templates
result = api_get(f"{API}/{WABA_ID}/message_templates?limit=100")
if "error" in result:
    print(f"ERROR: {result['error'].get('message', result['error'])}")
    sys.exit(1)

templates = result.get("data", [])
templates.sort(key=lambda t: t["name"])

# Count by status
status_counts = {}
approved = []
for t in templates:
    name = t["name"]
    status = t["status"]
    cat = t.get("category", "?")
    status_counts[status] = status_counts.get(status, 0) + 1
    symbol = {"APPROVED": "✓", "PENDING": "⏳", "REJECTED": "✗"}.get(status, "?")
    reject_reason = ""
    if status == "REJECTED":
        reject_reason = f" — {t.get('rejected_reason', t.get('quality_score', {}).get('reasons', ['unknown']))}"
    print(f"  {symbol} {name:35s} {status:10s} [{cat}]{reject_reason}")
    if status == "APPROVED":
        approved.append(t)

print("-" * 70)
for s, c in sorted(status_counts.items()):
    print(f"  {s}: {c}")
print(f"  TOTAL: {len(templates)}")

# ── Send samples for APPROVED templates ──
if not approved:
    print("\n❌ No APPROVED templates found. Nothing to send.")
    sys.exit(0)

print(f"\n{'=' * 70}")
print(f"SENDING SAMPLE MESSAGES for {len(approved)} APPROVED templates → {TEST_RECIPIENT}")
print(f"{'=' * 70}")

for t in approved:
    name = t["name"]
    lang = t.get("language", "en")
    params = SAMPLE_PARAMS.get(name, [])
    print(f"\n  → Sending: {name} (lang={lang}, params={len(params)})")
    result = send_template(name, lang, params)
    if "messages" in result:
        msg_id = result["messages"][0].get("id", "?")
        print(f"    ✓ Sent! Message ID: {msg_id}")
    elif "error" in result:
        err = result["error"]
        print(f"    ✗ Failed: {err.get('message', err)}")
    else:
        print(f"    ? Unexpected: {result}")

print(f"\n{'=' * 70}")
print("DONE")
