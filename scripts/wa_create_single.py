#!/usr/bin/env python3
"""Create a single simple WhatsApp template for testing."""
import json, urllib.request, sys

token = sys.argv[1]
waba_id = sys.argv[2]

# Try simple template first
t = {
    "name": "stibe_notification",
    "category": "UTILITY",
    "allow_category_change": True,
    "language": "en",
    "components": [
        {
            "type": "BODY",
            "text": "Hello {{1}}, this is a notification from stibe Learning.\n\n{{2}}\n\nVisit your dashboard for more details."
        }
    ]
}

url = "https://graph.facebook.com/v21.0/%s/message_templates" % waba_id
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
    print("SUCCESS:", json.dumps(data, indent=2))
except urllib.error.HTTPError as e:
    body = json.loads(e.read())
    print("ERROR %d:" % e.code, json.dumps(body, indent=2))
