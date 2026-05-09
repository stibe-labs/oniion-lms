#!/usr/bin/env python3
"""Create WhatsApp message templates for stibe Learning."""
import json, urllib.request, sys

token = sys.argv[1]
waba_id = sys.argv[2]

templates = [
    {
        "name": "stibe_notification",
        "category": "UTILITY",
        "language": "en",
        "components": [
            {
                "type": "BODY",
                "text": "Hello {{1}}, this is a notification from stibe Learning.\n\n{{2}}\n\nVisit your dashboard for more details.",
                "example": {
                    "body_text": [["Student", "Your next class is scheduled for tomorrow at 4 PM."]]
                }
            }
        ]
    },
    {
        "name": "stibe_class_reminder",
        "category": "UTILITY",
        "language": "en",
        "components": [
            {
                "type": "BODY",
                "text": "Hi {{1}}, your {{2}} class is starting at {{3}}.\n\nTeacher: {{4}}\n\nJoin from your stibe dashboard.",
                "example": {
                    "body_text": [["Rahul", "Mathematics", "4:00 PM", "Mrs. Sharma"]]
                }
            }
        ]
    },
    {
        "name": "stibe_payment_reminder",
        "category": "UTILITY",
        "language": "en",
        "components": [
            {
                "type": "BODY",
                "text": "Dear {{1}}, payment of {{2}} for {{3}} is due by {{4}}.\n\nPay online at your stibe parent dashboard.",
                "example": {
                    "body_text": [["Parent", "Rs.5000", "Rahul", "March 15"]]
                }
            }
        ]
    },
    {
        "name": "stibe_exam_result",
        "category": "UTILITY",
        "language": "en",
        "components": [
            {
                "type": "BODY",
                "text": "Hi {{1}}, your {{2}} results are ready.\n\nScore: {{3}}\nGrade: {{4}}\n\nView details on your stibe dashboard.",
                "example": {
                    "body_text": [["Rahul", "Mathematics Exam", "85/100", "A"]]
                }
            }
        ]
    }
]

url = "https://graph.facebook.com/v21.0/%s/message_templates" % waba_id

for t in templates:
    payload = json.dumps(t).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer %s" % token
        },
        method="POST"
    )
    try:
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read())
        print("OK [%s]: id=%s, status=%s" % (t["name"], data.get("id","?"), data.get("status","?")))
    except urllib.error.HTTPError as e:
        body = json.loads(e.read())
        msg = body.get("error", {}).get("message", "Unknown error")
        print("FAIL [%s]: %s" % (t["name"], msg))
