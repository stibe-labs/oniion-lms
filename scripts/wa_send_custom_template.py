#!/usr/bin/env python3
"""Send a WhatsApp template message."""
import json, urllib.request, sys

token = sys.argv[1]
phone_id = sys.argv[2]
to_number = sys.argv[3]
template_name = sys.argv[4] if len(sys.argv) > 4 else "stibe_notification"

payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to_number,
    "type": "template",
    "template": {
        "name": template_name,
        "language": {
            "code": "en"
        },
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": "Admin"},
                    {"type": "text", "text": "WhatsApp integration is now active! This is a test notification from stibe Learning."}
                ]
            }
        ]
    }
}

data = json.dumps(payload).encode()
req = urllib.request.Request(
    "https://graph.facebook.com/v21.0/%s/messages" % phone_id,
    data=data,
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer %s" % token
    },
    method="POST"
)

try:
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    print("SUCCESS:", json.dumps(result, indent=2))
except urllib.error.HTTPError as e:
    body = json.loads(e.read())
    print("ERROR %d:" % e.code, json.dumps(body, indent=2))
