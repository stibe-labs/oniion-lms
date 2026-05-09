#!/usr/bin/env python3
"""stibe WhatsApp template manager v3 — fixed variable/length ratios and OTP format."""
import json, urllib.request, sys, time, os

# Read from .env.local on server, or from args
ENV_FILE = "/var/www/stibe-portal/.env.local"
def read_env(key):
    try:
        for line in open(ENV_FILE):
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip()
    except:
        pass
    return None

if len(sys.argv) > 2 and not sys.argv[1].startswith("-"):
    token = sys.argv[1]
    waba_id = sys.argv[2]
    action = sys.argv[3] if len(sys.argv) > 3 else "list"
else:
    token = read_env("WHATSAPP_API_TOKEN")
    waba_id = read_env("WHATSAPP_BUSINESS_ACCOUNT_ID")
    action = sys.argv[1] if len(sys.argv) > 1 else "list"
    if not token or not waba_id:
        print("ERROR: Could not read credentials from %s" % ENV_FILE)
        sys.exit(1)

def body(text, examples):
    """Build a BODY component with example values."""
    return [{"type": "BODY", "text": text, "example": {"body_text": [examples]}}]

TEMPLATES = [
    # 1. Generic alert (catch-all) — OK already created
    # {
    #     "name": "stibe_alert",
    #     ...
    # },
    # 2. Class reminder
    {
        "name": "stibe_class_reminder",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your {{2}} class starts at {{3}}.\n\nTeacher: {{4}}\nBatch: {{5}}\n\nJoin from your stibe Learning dashboard at https://stibelearning.online",
            ["Ramesh", "Mathematics", "10:00 AM", "Priya Sharma", "Grade 10 - Batch A"]
        ),
    },
    # 3. Teacher invite
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
    # 4. Student invite
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
    # 5. Class cancelled
    {
        "name": "stibe_class_cancelled",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, class \"{{2}}\" on {{3}} at {{4}} has been cancelled.\n\nPlease contact your coordinator for details or check your stibe Learning dashboard.\n\nstibe Learning",
            ["Ramesh", "Algebra Basics", "15 Jan 2025", "10:00 AM"]
        ),
    },
    # 6. Class rescheduled
    {
        "name": "stibe_class_rescheduled",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, class \"{{2}}\" has been rescheduled.\n\nPrevious time: {{3}} at {{4}}\nNew time: {{5}} at {{6}}\n\nPlease join from your stibe Learning dashboard at the updated time.",
            ["Ramesh", "Algebra Basics", "15 Jan 2025", "10:00 AM", "16 Jan 2025", "11:00 AM"]
        ),
    },
    # 7. Class live — NO variable at end
    {
        "name": "stibe_class_live",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your class \"{{2}}\" is LIVE now!\n\nTeacher {{3}} has started the session. Please join immediately from your stibe Learning dashboard.\n\nJoin link: {{4}}\n\nstibe Learning",
            ["Ramesh", "Algebra Basics", "Priya Sharma", "https://stibelearning.online/room/abc"]
        ),
    },
    # 8. Payment confirmation
    {
        "name": "stibe_payment_confirm",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your payment of {{2}} has been received successfully.\n\nTransaction ID: {{3}}\nDate: {{4}}\n\nThank you for your payment!\nstibe Learning",
            ["Ramesh", "Rs. 5,000", "TXN123456", "15 Jan 2025"]
        ),
    },
    # 9. Payment due / reminder
    {
        "name": "stibe_payment_due",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, a payment of {{2}} for {{3}} is due by {{4}}.\n\nInvoice number: {{5}}\n\nPlease pay online through your stibe Learning dashboard to avoid interruption.\n\nstibe Learning",
            ["Ramesh", "Rs. 5,000", "January 2025 Tuition", "31 Jan 2025", "INV-2025-001"]
        ),
    },
    # 10. Invoice generated — reduced to 4 vars
    {
        "name": "stibe_invoice",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, a new invoice has been generated for your account.\n\nInvoice number: {{2}}\nAmount due: {{3}}\nDue date: {{4}}\n\nPlease pay through your stibe Learning dashboard to avoid late fees.\n\nstibe Learning",
            ["Ramesh", "INV-2025-001", "Rs. 5,000", "31 Jan 2025"]
        ),
    },
    # 11. Payment receipt — reduced to 4 vars, longer body
    {
        "name": "stibe_receipt",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, we have received your payment successfully. Here are your receipt details.\n\nReceipt number: {{2}}\nAmount paid: {{3}}\nPayment date: {{4}}\n\nThank you for your timely payment. View the full receipt on your stibe Learning dashboard.\n\nstibe Learning",
            ["Ramesh", "REC-2025-001", "Rs. 5,000", "15 Jan 2025"]
        ),
    },
    # 12. Exam result
    {
        "name": "stibe_exam_result",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your {{2}} results are ready.\n\nScore: {{3}}\nGrade: {{4}}\n\nView detailed results and analysis on your stibe Learning dashboard.\n\nstibe Learning",
            ["Ramesh", "Mathematics Mid-Term", "85/100", "A"]
        ),
    },
    # 13. Welcome / credentials (no password)
    {
        "name": "stibe_welcome",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Welcome to stibe Learning, {{1}}!\n\nYour {{2}} account has been created successfully.\n\nLogin at: {{3}}\nRegistered email: {{4}}\n\nPlease check your email for login credentials and change your password after first login.\n\nstibe Learning",
            ["Ramesh", "student", "https://stibelearning.online", "ramesh@example.com"]
        ),
    },
    # 14. Batch assignment — reduced to 4 vars
    {
        "name": "stibe_batch_assign",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, you have been assigned to batch \"{{2}}\" for {{3}} grade.\n\nSubjects: {{4}}\n\nLogin to your stibe Learning dashboard to view your schedule and class details.\n\nstibe Learning",
            ["Ramesh", "Batch A", "Grade 10", "Mathematics, Science"]
        ),
    },
    # 15. Daily schedule
    {
        "name": "stibe_daily_schedule",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, here is your class schedule for {{2}}.\n\n{{3}}\n\nJoin links will be sent 30 minutes before each class. Visit your stibe Learning dashboard for details.\n\nstibe Learning",
            ["Ramesh", "Monday, 15 Jan 2025", "10:00 AM - Mathematics\n11:00 AM - Science"]
        ),
    },
    # 16. Weekly schedule — reduced to 3 vars
    {
        "name": "stibe_weekly_schedule",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, here is your weekly timetable for the week of {{2}}.\n\n{{3}}\n\nJoin links will be sent 30 minutes before each class. Visit your stibe Learning dashboard for the full schedule.\n\nstibe Learning",
            ["Ramesh", "15-21 Jan 2025", "Mon: Math 10AM, Science 11AM\nTue: English 10AM"]
        ),
    },
    # 17. Session request — reduced to 4 vars
    {
        "name": "stibe_session_request",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, a new session request has been submitted by {{2}} for {{3}}.\n\nDetails: {{4}}\n\nPlease review and respond on your stibe Learning dashboard.\n\nstibe Learning",
            ["Priya Sharma", "Ramesh", "Mathematics", "Extra class needed before exam"]
        ),
    },
    # 18. Request update — reduced to 4 vars
    {
        "name": "stibe_request_update",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your session request for {{2}} has been reviewed.\n\nStatus: {{3}}\nDetails: {{4}}\n\nPlease check your stibe Learning dashboard for more information.\n\nstibe Learning",
            ["Ramesh", "Mathematics extra class", "Approved", "Session scheduled for 16 Jan 2025 at 3 PM."]
        ),
    },
    # 19. Session rescheduled — reduced to 4 vars
    {
        "name": "stibe_session_moved",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your {{2}} session has been rescheduled.\n\nPrevious: {{3}}\nNew: {{4}}\n\nPlease update your calendar. Visit your stibe Learning dashboard for updated join links.\n\nstibe Learning",
            ["Ramesh", "Mathematics", "15 Jan 2025 at 10:00 AM", "16 Jan 2025 at 11:00 AM"]
        ),
    },
    # 20. Session cancelled — reduced to 4 vars
    {
        "name": "stibe_session_cancel",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your {{2}} session on {{3}} has been cancelled.\n\nReason: {{4}}\n\nPlease check your stibe Learning dashboard for any rescheduled classes.\n\nstibe Learning",
            ["Ramesh", "Mathematics", "15 Jan 2025 at 10:00 AM", "Teacher is unavailable"]
        ),
    },
    # 21. Leave request — reduced to 4 vars
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
    # 22. Leave update — reduced to 4 vars
    {
        "name": "stibe_leave_update",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your leave request for {{2}} has been reviewed.\n\nStatus: {{3}}\nDetails: {{4}}\n\nPlease check your stibe Learning dashboard for more information.\n\nstibe Learning",
            ["Priya Sharma", "15 Jan 2025 to 17 Jan 2025", "Approved", "Substitute teacher has been assigned for your classes."]
        ),
    },
    # 23. Leave sessions affected — reduced to 4 vars
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
    # 24. Payslip — reduced to 4 vars
    {
        "name": "stibe_payslip",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your payslip for {{2}} is ready.\n\nTotal classes: {{3}}\nTotal amount: {{4}}\n\nView the detailed breakdown on your stibe Learning dashboard.\n\nstibe Learning",
            ["Priya Sharma", "January 2025", "24", "Rs. 12,000"]
        ),
    },
    # 25. Coordinator summary — reduced to 4 vars
    {
        "name": "stibe_coord_summary",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, notification summary for class \"{{2}}\" on {{3}}.\n\nDetails: {{4}}\n\nView the full summary on your stibe Learning dashboard.\n\nstibe Learning",
            ["Admin", "Algebra Basics", "15 Jan 2025", "Teacher: Priya Sharma, 12 students notified"]
        ),
    },
    # 26. OTP — AUTHENTICATION with OTP button
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
    # 27. Demo teacher request
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
    # 28. Demo confirmed
    {
        "name": "stibe_demo_confirmed",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your {{2}} demo session is confirmed!\n\nTeacher: {{3}}\nTime: {{4}}\n\nJoin link: {{5}}\n\nThis session is completely FREE for 30 minutes. We hope you enjoy learning with stibe Learning!",
            ["Ramesh", "Mathematics", "Priya Sharma", "15 Jan 2025 at 10:00 AM", "https://stibelearning.online/room/demo"]
        ),
    },
    # 29. Demo pending
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

if action == "list":
    status, data = api_call("GET", "https://graph.facebook.com/v21.0/%s/message_templates?fields=name,status,rejected_reason,category&limit=50" % waba_id)
    if status == 200:
        for t in data.get("data", []):
            reason = t.get("rejected_reason", "")
            extra = " [%s]" % reason if reason and reason != "NONE" else ""
            print("  %s | %s | %s%s" % (t["name"], t["status"], t["category"], extra))
    else:
        print("Error:", data)

elif action == "delete_rejected":
    print("=== DELETING ALL REJECTED TEMPLATES ===")
    status, data = api_call("GET", "https://graph.facebook.com/v21.0/%s/message_templates?fields=name,status&limit=50" % waba_id)
    if status == 200:
        for t in data.get("data", []):
            if t["status"] == "REJECTED":
                del_url = "https://graph.facebook.com/v21.0/%s/message_templates?name=%s" % (waba_id, t["name"])
                ds, dd = api_call("DELETE", del_url)
                print("  DELETE %s: %s" % (t["name"], dd))
                time.sleep(0.3)
    print("Done")

elif action == "delete_all":
    print("=== DELETING ALL NON-APPROVED TEMPLATES ===")
    status, data = api_call("GET", "https://graph.facebook.com/v21.0/%s/message_templates?fields=name,status&limit=50" % waba_id)
    if status == 200:
        for t in data.get("data", []):
            if t["name"] != "hello_world":
                del_url = "https://graph.facebook.com/v21.0/%s/message_templates?name=%s" % (waba_id, t["name"])
                ds, dd = api_call("DELETE", del_url)
                print("  DELETE %s: %s" % (t["name"], dd))
                time.sleep(0.3)
    print("Done")

elif action == "create":
    print("=== CREATING %d TEMPLATES ===" % len(TEMPLATES))
    url = "https://graph.facebook.com/v21.0/%s/message_templates" % waba_id
    ok = fail = 0
    for t in TEMPLATES:
        status, data = api_call("POST", url, t)
        if status == 200:
            print("  OK  %s: id=%s" % (t["name"], data.get("id","?")))
            ok += 1
        else:
            msg = data.get("error", {}).get("error_user_msg") or data.get("error", {}).get("message", "?")
            code = data.get("error", {}).get("code", "?")
            print("  FAIL %s: %s (code %s)" % (t["name"], msg, code))
            fail += 1
        time.sleep(0.5)
    print("\nDone: %d ok, %d failed" % (ok, fail))
