#!/usr/bin/env python3
"""Create missing templates + fix stibe_welcome."""
import json, urllib.request, sys, time

ENV_FILE = "/var/www/stibe-portal/.env.local"
def read_env(key):
    for line in open(ENV_FILE):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    return None

token = read_env("WHATSAPP_API_TOKEN")
waba_id = read_env("WHATSAPP_BUSINESS_ACCOUNT_ID")
action = sys.argv[1] if len(sys.argv) > 1 else "create"

def body(text, examples):
    return [{"type": "BODY", "text": text, "example": {"body_text": [examples]}}]

TEMPLATES = [
    {
        "name": "stibe_teacher_invite",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your class \"{{2}}\" is scheduled.\n\nSubject: {{3}}\nDate: {{4}} at {{5}}\nDuration: {{6}}\n\nCheck your stibe Learning dashboard for join links and details.",
            ["Priya Sharma", "Algebra Basics", "Mathematics", "15 Jan 2025", "10:00 AM", "60 minutes"]
        ),
    },
    {
        "name": "stibe_student_invite",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, you are invited to class \"{{2}}\".\n\nSubject: {{3}}\nDate: {{4}} at {{5}}\nDuration: {{6}}\n\nJoin from your stibe Learning dashboard at https://stibelearning.online",
            ["Ramesh", "Algebra Basics", "Mathematics", "15 Jan 2025", "10:00 AM", "60 minutes"]
        ),
    },
    {
        "name": "stibe_leave_request",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, a leave request has been submitted by {{2}}.\n\nLeave period: {{3}}\nDetails: {{4}}\n\nPlease review and respond on your stibe Learning dashboard.\n\nstibe Learning",
            ["Admin", "Priya Sharma", "15 Jan 2025 to 17 Jan 2025", "Sick Leave - Medical appointment, 3 sessions affected"]
        ),
    },
    {
        "name": "stibe_leave_affected",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, some of your upcoming sessions have been affected by a teacher leave.\n\nTeacher: {{2}}\nLeave period: {{3}}\nAffected sessions: {{4}}\n\nPlease check your stibe Learning dashboard for rescheduled classes.\n\nstibe Learning",
            ["Ramesh", "Priya Sharma", "15 Jan 2025 to 17 Jan 2025", "3 sessions cancelled"]
        ),
    },
    {
        "name": "stibe_demo_teacher",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, you have received a new demo session request!\n\nStudent: {{2}} (Grade {{3}})\nSubject: {{4}}\n\nLog in to your stibe Learning dashboard to accept or reject this request.\n\nstibe Learning",
            ["Priya Sharma", "Ramesh", "10", "Mathematics"]
        ),
    },
    {
        "name": "stibe_demo_pending",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your {{2}} demo request has been received!\n\nWe are finding the best teacher for you. You will receive a confirmation message soon with the join link.\n\nYour demo session is completely FREE for 30 minutes.\n\nstibe Learning",
            ["Ramesh", "Mathematics"]
        ),
    },
    # OTP — AUTHENTICATION with OTP COPY_CODE button
    {
        "name": "stibe_otp",
        "category": "AUTHENTICATION",
        "allow_category_change": False,
        "language": "en",
        "components": [
            {
                "type": "BODY",
                "add_security_recommendation": True,
            },
            {
                "type": "BUTTONS",
                "buttons": [
                    {
                        "type": "OTP",
                        "otp_type": "COPY_CODE"
                    }
                ]
            }
        ],
    },
]

def api_call(method, url, data=None):
    payload = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": "Bearer %s" % token},
        method=method
    )
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

if action == "create":
    # First delete stibe_welcome so we can recreate with MARKETING category
    del_url = "https://graph.facebook.com/v21.0/%s/message_templates?name=stibe_welcome" % waba_id
    ds, dd = api_call("DELETE", del_url)
    print("DELETE stibe_welcome (to fix category):", dd)
    time.sleep(2)

    # Re-create stibe_welcome with MARKETING category
    wt = {
        "name": "stibe_welcome",
        "category": "MARKETING",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Welcome to stibe Learning, {{1}}!\n\nYour {{2}} account has been created successfully.\n\nLogin at: {{3}}\nRegistered email: {{4}}\n\nPlease check your email for login credentials and change your password after first login.\n\nstibe Learning",
            ["Ramesh", "student", "https://stibelearning.online", "ramesh@example.com"]
        ),
    }
    url = "https://graph.facebook.com/v21.0/%s/message_templates" % waba_id
    status, data = api_call("POST", url, wt)
    if status == 200:
        print("OK  stibe_welcome: id=%s" % data.get("id","?"))
    else:
        msg = data.get("error", {}).get("error_user_msg") or data.get("error", {}).get("message", "?")
        print("FAIL stibe_welcome: %s (code %s)" % (msg, data.get("error", {}).get("code", "?")))
    time.sleep(0.5)

    # Create missing templates
    ok = fail = 0
    for t in TEMPLATES:
        status, data = api_call("POST", url, t)
        if status == 200:
            print("OK  %s: id=%s" % (t["name"], data.get("id","?")))
            ok += 1
        else:
            msg = data.get("error", {}).get("error_user_msg") or data.get("error", {}).get("message", "?")
            code = data.get("error", {}).get("code", "?")
            print("FAIL %s: %s (code %s)" % (t["name"], msg, code))
            fail += 1
        time.sleep(0.5)
    print("\nDone: %d ok, %d failed" % (ok, fail))

elif action == "list":
    status, data = api_call("GET", "https://graph.facebook.com/v21.0/%s/message_templates?fields=name,status,rejected_reason,category&limit=50" % waba_id)
    if status == 200:
        for t in data.get("data", []):
            reason = t.get("rejected_reason", "")
            extra = " [%s]" % reason if reason and reason != "NONE" else ""
            print("  %s | %s | %s%s" % (t["name"], t["status"], t["category"], extra))
        print("\nTotal: %d" % len(data.get("data", [])))
    else:
        print("Error:", data)
