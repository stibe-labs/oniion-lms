#!/usr/bin/env python3
"""stibe WhatsApp template manager v2 — with proper example values."""
import json, urllib.request, sys, time

token = sys.argv[1]
waba_id = sys.argv[2]
action = sys.argv[3] if len(sys.argv) > 3 else "list"

def body(text, examples):
    """Build a BODY component with example values."""
    return [{"type": "BODY", "text": text, "example": {"body_text": [examples]}}]

TEMPLATES = [
    # 1. Generic alert (catch-all)
    {
        "name": "stibe_alert",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, this is a notification from stibe Learning.\n\n{{2}}\n\nFor more details, visit your dashboard at https://stibelearning.online\n\nstibe Learning",
            ["Ramesh", "Your account has been updated successfully. Please check your dashboard for details."]
        ),
    },
    # 2. Class reminder
    {
        "name": "stibe_class_reminder",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your {{2}} class starts at {{3}}.\n\nTeacher: {{4}}\nBatch: {{5}}\n\nJoin from your stibe dashboard.",
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
            "Hi {{1}}, your class \"{{2}}\" is scheduled.\n\nSubject: {{3}}\nDate: {{4}} at {{5}}\nDuration: {{6}}\n\nCheck your stibe dashboard for details.",
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
            "Hi {{1}}, you are invited to class \"{{2}}\".\n\nSubject: {{3}}\nDate: {{4}} at {{5}}\nDuration: {{6}}\n\nJoin from your stibe dashboard.",
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
            "Hi {{1}}, class \"{{2}}\" on {{3}} at {{4}} has been cancelled.\n\nContact your coordinator for details.\n\nstibe Learning",
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
            "Hi {{1}}, class \"{{2}}\" has been rescheduled.\n\nOld: {{3}} at {{4}}\nNew: {{5}} at {{6}}\n\nJoin from your stibe dashboard.",
            ["Ramesh", "Algebra Basics", "15 Jan 2025", "10:00 AM", "16 Jan 2025", "11:00 AM"]
        ),
    },
    # 7. Class live
    {
        "name": "stibe_class_live",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your class \"{{2}}\" is LIVE now!\n\nTeacher {{3}} has started the session.\n\nJoin: {{4}}",
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
            "Hi {{1}}, payment of {{2}} received.\n\nTransaction: {{3}}\nDate: {{4}}\n\nThank you!\nstibe Learning",
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
            "Hi {{1}}, payment of {{2}} for {{3}} is due by {{4}}.\n\nInvoice: {{5}}\n\nPay online at your stibe dashboard.",
            ["Ramesh", "Rs. 5,000", "January 2025 Tuition", "31 Jan 2025", "INV-2025-001"]
        ),
    },
    # 10. Invoice generated
    {
        "name": "stibe_invoice",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, a new invoice has been generated.\n\nInvoice: {{2}}\nAmount: {{3}}\nDue: {{4}}\n\nPay at your stibe dashboard.",
            ["Ramesh", "INV-2025-001", "Rs. 5,000", "31 Jan 2025"]
        ),
    },
    # 11. Payment receipt
    {
        "name": "stibe_receipt",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, payment received!\n\nReceipt: {{2}}\nAmount: {{3}}\nDate: {{4}}\n\nstibe Learning",
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
            "Hi {{1}}, your {{2}} results are ready.\n\nScore: {{3}}\nGrade: {{4}}\n\nView details on your stibe dashboard.",
            ["Ramesh", "Mathematics Mid-Term", "85/100", "A"]
        ),
    },
    # 13. Welcome / credentials (no password — security risk)
    {
        "name": "stibe_welcome",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Welcome to stibe Learning, {{1}}!\n\nYour {{2}} account is ready.\n\nLogin: {{3}}\nEmail: {{4}}\n\nPlease check your email for login details.",
            ["Ramesh", "student", "https://stibelearning.online", "ramesh@example.com"]
        ),
    },
    # 14. Batch assignment
    {
        "name": "stibe_batch_assign",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, you have been assigned to batch \"{{2}}\".\n\nGrade: {{3}}\nSubjects: {{4}}\n\nLogin to your stibe dashboard for details.",
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
            "Hi {{1}}, here is your schedule for {{2}}.\n\n{{3}}\n\nstibe Learning",
            ["Ramesh", "Monday, 15 Jan 2025", "10:00 AM - Mathematics\n11:00 AM - Science"]
        ),
    },
    # 16. Weekly schedule
    {
        "name": "stibe_weekly_schedule",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your weekly timetable for {{2}}.\n\n{{3}}\n\nstibe Learning",
            ["Ramesh", "15-21 Jan 2025", "Mon: Math 10AM, Science 11AM\nTue: English 10AM"]
        ),
    },
    # 17. Session request
    {
        "name": "stibe_session_request",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, new {{2}} request from {{3}} for {{4}}.\n\nReason: {{5}}\n\nReview on your stibe dashboard.",
            ["Priya Sharma", "extra class", "Ramesh", "Mathematics", "Need revision before exam"]
        ),
    },
    # 18. Request update (approved/rejected)
    {
        "name": "stibe_request_update",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your {{2}} request for {{3}} has been {{4}}.\n\n{{5}}\n\nstibe Learning",
            ["Ramesh", "extra class", "Mathematics", "approved", "Session scheduled for 16 Jan 2025 at 3 PM."]
        ),
    },
    # 19. Session rescheduled
    {
        "name": "stibe_session_moved",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, session \"{{2}}\" has been rescheduled.\n\nOld: {{3}} at {{4}}\nNew: {{5}} at {{6}}\n\nstibe Learning",
            ["Ramesh", "Mathematics", "15 Jan 2025", "10:00 AM", "16 Jan 2025", "11:00 AM"]
        ),
    },
    # 20. Session cancelled
    {
        "name": "stibe_session_cancel",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, session \"{{2}}\" on {{3}} at {{4}} has been cancelled.\n\nReason: {{5}}\n\nstibe Learning",
            ["Ramesh", "Mathematics", "15 Jan 2025", "10:00 AM", "Teacher is unavailable"]
        ),
    },
    # 21. Leave request
    {
        "name": "stibe_leave_request",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, leave request from {{2}}.\n\nType: {{3}}\nDates: {{4}} to {{5}}\nReason: {{6}}\n\nReview on your stibe dashboard.",
            ["Admin", "Priya Sharma", "Sick Leave", "15 Jan 2025", "17 Jan 2025", "Medical appointment"]
        ),
    },
    # 22. Leave update (approved/rejected)
    {
        "name": "stibe_leave_update",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your leave request from {{2}} to {{3}} has been {{4}}.\n\n{{5}}\n\nstibe Learning",
            ["Priya Sharma", "15 Jan 2025", "17 Jan 2025", "approved", "Substitute teacher assigned."]
        ),
    },
    # 23. Leave sessions affected
    {
        "name": "stibe_leave_affected",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, {{2}} sessions have been cancelled due to teacher leave.\n\nTeacher: {{3}}\nLeave: {{4}} to {{5}}\n\nstibe Learning",
            ["Ramesh", "3", "Priya Sharma", "15 Jan 2025", "17 Jan 2025"]
        ),
    },
    # 24. Payslip
    {
        "name": "stibe_payslip",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, your payslip for {{2}} is ready.\n\nClasses: {{3}}\nAmount: {{4}}\n\nView on your stibe dashboard.",
            ["Priya Sharma", "January 2025", "24", "Rs. 12,000"]
        ),
    },
    # 25. Coordinator summary
    {
        "name": "stibe_coord_summary",
        "category": "UTILITY",
        "allow_category_change": True,
        "language": "en",
        "components": body(
            "Hi {{1}}, notifications sent for \"{{2}}\".\n\nDate: {{3}}\nTeacher: {{4}}\nStudents notified: {{5}}\n\nstibe Learning",
            ["Admin", "Algebra Basics", "15 Jan 2025", "Priya Sharma", "12"]
        ),
    },
    # 26. OTP (authentication — special format)
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
                "type": "FOOTER",
                "code_expiration_minutes": 10
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
            "Hi {{1}}, new demo session request!\n\nStudent: {{2}} (Grade {{3}})\nSubject: {{4}}\n\nLog in to your stibe dashboard to accept or reject.",
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
            "Hi {{1}}, your {{2}} demo session is confirmed!\n\nTeacher: {{3}}\nTime: {{4}}\nJoin: {{5}}\n\nThis session is FREE!",
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
            "Hi {{1}}, your {{2}} demo request is received!\n\nWe are finding the best teacher for you. You will receive a confirmation soon.\n\nstibe Learning",
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
                time.sleep(0.2)
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
