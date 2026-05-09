#!/usr/bin/env python3
"""Delete existing pending templates and create comprehensive ones for stibe Learning."""
import json, urllib.request, sys, time

token = sys.argv[1]
waba_id = sys.argv[2]
action = sys.argv[3] if len(sys.argv) > 3 else "create"

# ── Templates to delete first ──
DELETE_NAMES = [
    "stibe_notification",
    "stibe_class_reminder",
    "stibe_payment_reminder",
    "stibe_exam_result",
]

# ── All templates to create ──
# Meta limits: max 1024 chars body, max positional params
# We use {{1}} {{2}} ... for variables
TEMPLATES = [
    # 1. Generic notification (catch-all)
    {
        "name": "stibe_alert",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}},\n\n{{2}}\n\nstibe Learning\nhttps://stibelearning.online"}
        ]
    },
    # 2. Class/room reminder
    {
        "name": "stibe_class_reminder",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, your {{2}} class starts at {{3}}.\n\nTeacher: {{4}}\nBatch: {{5}}\n\nJoin from your stibe dashboard."}
        ]
    },
    # 3. Teacher invite to room
    {
        "name": "stibe_teacher_invite",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, your class \"{{2}}\" is scheduled.\n\nSubject: {{3}}\nDate: {{4}} at {{5}}\nDuration: {{6}}\n\nCheck your stibe dashboard for join links."}
        ]
    },
    # 4. Student invite to room
    {
        "name": "stibe_student_invite",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, you are invited to \"{{2}}\".\n\nSubject: {{3}}\nDate: {{4}} at {{5}}\nDuration: {{6}}\n\nJoin from your stibe dashboard."}
        ]
    },
    # 5. Room cancelled
    {
        "name": "stibe_class_cancelled",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Class \"{{1}}\" on {{2}} at {{3}} has been cancelled.\n\nReason: {{4}}\n\nContact your coordinator for details.\n\nstibe Learning"}
        ]
    },
    # 6. Room rescheduled
    {
        "name": "stibe_class_rescheduled",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Class \"{{1}}\" has been rescheduled.\n\nOld: {{2}} at {{3}}\nNew: {{4}} at {{5}}\n\nJoin from your stibe dashboard."}
        ]
    },
    # 7. Room started (class is live)
    {
        "name": "stibe_class_live",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, your class \"{{2}}\" is LIVE now!\n\nTeacher {{3}} has started the session.\n\nJoin: {{4}}"}
        ]
    },
    # 8. Payment confirmation
    {
        "name": "stibe_payment_confirm",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, payment of {{2}} received.\n\nTransaction: {{3}}\nDate: {{4}}\n\nThank you!\nstibe Learning"}
        ]
    },
    # 9. Payment reminder / due
    {
        "name": "stibe_payment_due",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, payment of {{2}} for {{3}} is due by {{4}}.\n\nInvoice: {{5}}\n\nPay online at your stibe dashboard."}
        ]
    },
    # 10. Invoice generated
    {
        "name": "stibe_invoice",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, a new invoice has been generated.\n\nInvoice: {{2}}\nStudent: {{3}}\nAmount: {{4}}\nDue: {{5}}\n\nPay at your stibe dashboard."}
        ]
    },
    # 11. Payment receipt
    {
        "name": "stibe_receipt",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, payment received!\n\nReceipt: {{2}}\nAmount: {{3}}\nTransaction: {{4}}\nDate: {{5}}\n\nstibe Learning"}
        ]
    },
    # 12. Exam result
    {
        "name": "stibe_exam_result",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, your {{2}} results are ready.\n\nScore: {{3}}\nGrade: {{4}}\n\nView details on your stibe dashboard."}
        ]
    },
    # 13. Credentials (welcome)
    {
        "name": "stibe_welcome",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Welcome to stibe Learning, {{1}}!\n\nYour {{2}} account is ready.\n\nLogin: {{3}}\nEmail: {{4}}\nPassword: {{5}}\n\nPlease change your password after first login."}
        ]
    },
    # 14. Batch assignment (coordinator/teacher/student/parent)
    {
        "name": "stibe_batch_assign",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, you have been assigned to batch \"{{2}}\".\n\nGrade: {{3}}\nSubjects: {{4}}\nRole: {{5}}\n\nLogin to your stibe dashboard for details."}
        ]
    },
    # 15. Daily timetable
    {
        "name": "stibe_daily_schedule",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, here is your schedule for {{2}}.\n\n{{3}}\n\nJoin links will be sent 30 min before each class.\n\nstibe Learning"}
        ]
    },
    # 16. Weekly timetable
    {
        "name": "stibe_weekly_schedule",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, your weekly timetable for {{2}} (Grade {{3}}).\n\n{{4}}\n\nJoin links sent 30 min before each class.\n\nstibe Learning"}
        ]
    },
    # 17. Session request submitted
    {
        "name": "stibe_session_request",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, new {{2}} request for {{3}} from {{4}}.\n\nReason: {{5}}\n\nPlease review on your stibe dashboard."}
        ]
    },
    # 18. Session request approved/rejected
    {
        "name": "stibe_request_update",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, your {{2}} request for {{3}} has been {{4}}.\n\n{{5}}\n\nstibe Learning"}
        ]
    },
    # 19. Session rescheduled notify
    {
        "name": "stibe_session_moved",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, session rescheduled.\n\n{{2}} — {{3}}\nOld: {{4}} at {{5}}\nNew: {{6}} at {{7}}\n\nstibe Learning"}
        ]
    },
    # 20. Session cancelled notify
    {
        "name": "stibe_session_cancel",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, session cancelled.\n\n{{2}} — {{3}} on {{4}}\nReason: {{5}}\n\nstibe Learning"}
        ]
    },
    # 21. Leave request submitted
    {
        "name": "stibe_leave_request",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, leave request from {{2}}.\n\nType: {{3}}\nDates: {{4}} to {{5}}\nReason: {{6}}\nSessions affected: {{7}}\n\nReview on your stibe dashboard."}
        ]
    },
    # 22. Leave approved/rejected
    {
        "name": "stibe_leave_update",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, your leave request ({{2}}) from {{3}} to {{4}} has been {{5}}.\n\n{{6}}\n\nstibe Learning"}
        ]
    },
    # 23. Leave sessions affected
    {
        "name": "stibe_leave_affected",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, {{2}} sessions for {{3}} have been cancelled.\n\nTeacher {{4}} is on leave ({{5}} to {{6}}).\n\nstibe Learning"}
        ]
    },
    # 24. Payslip notification
    {
        "name": "stibe_payslip",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, your payslip for {{2}} is ready.\n\nClasses: {{3}}\nBase: {{4}}\nIncentive: {{5}}\nTotal: {{6}}\n\nView on your stibe dashboard."}
        ]
    },
    # 25. Coordinator summary
    {
        "name": "stibe_coord_summary",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, notifications sent for \"{{2}}\".\n\nDate: {{3}}\nTeacher: {{4}}\nStudents notified: {{5}}\n\nstibe Learning"}
        ]
    },
    # 26. Password reset OTP
    {
        "name": "stibe_otp",
        "category": "AUTHENTICATION",
        "allow_category_change": False,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Your stibe verification code is {{1}}. This expires in 10 minutes. Do not share this code."}
        ]
    },
    # 27. Demo teacher request
    {
        "name": "stibe_demo_teacher",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, new demo session request!\n\nStudent: {{2}} (Grade {{3}})\nSubject: {{4}}\n\nLog in to your stibe dashboard to accept or reject."}
        ]
    },
    # 28. Demo student accepted
    {
        "name": "stibe_demo_confirmed",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, your {{2}} demo session is confirmed!\n\nTeacher: {{3}}\nTime: {{4}}\n\nJoin: {{5}}\n\nThis session is FREE!"}
        ]
    },
    # 29. Demo student searching
    {
        "name": "stibe_demo_pending",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": [
            {"type": "BODY", "text": "Hi {{1}}, your {{2}} demo request is received!\n\nWe are finding the best teacher for you. You will receive a confirmation soon.\n\nYour demo is FREE (30 min).\n\nstibe Learning"}
        ]
    },
]

def api_call(method, url, data=None):
    payload = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer %s" % token
        },
        method=method
    )
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

if action == "delete":
    print("=== DELETING OLD TEMPLATES ===")
    # List all templates to get IDs
    status, data = api_call("GET", "https://graph.facebook.com/v21.0/%s/message_templates?limit=50" % waba_id)
    if status == 200:
        for t in data.get("data", []):
            if t["name"] in DELETE_NAMES:
                del_url = "https://graph.facebook.com/v21.0/%s/message_templates?name=%s" % (waba_id, t["name"])
                ds, dd = api_call("DELETE", del_url)
                print("  DELETE %s: %d %s" % (t["name"], ds, json.dumps(dd)))
    else:
        print("  Failed to list templates:", data)

elif action == "create":
    print("=== CREATING %d TEMPLATES ===" % len(TEMPLATES))
    url = "https://graph.facebook.com/v21.0/%s/message_templates" % waba_id
    ok = 0
    fail = 0
    for t in TEMPLATES:
        status, data = api_call("POST", url, t)
        if status == 200:
            print("  OK [%s]: id=%s status=%s" % (t["name"], data.get("id","?"), data.get("status","?")))
            ok += 1
        else:
            msg = data.get("error", {}).get("error_user_msg") or data.get("error", {}).get("message", "Unknown")
            print("  FAIL [%s]: %d — %s" % (t["name"], status, msg))
            fail += 1
        time.sleep(0.3)  # Rate limit safety
    print("\nDone: %d created, %d failed" % (ok, fail))

elif action == "list":
    print("=== LISTING ALL TEMPLATES ===")
    status, data = api_call("GET", "https://graph.facebook.com/v21.0/%s/message_templates?limit=50" % waba_id)
    if status == 200:
        for t in data.get("data", []):
            print("  %s | %s | %s | %s" % (t["name"], t["status"], t["category"], t.get("language","?")))
    else:
        print("  Error:", data)
