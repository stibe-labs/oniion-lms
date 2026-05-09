#!/usr/bin/env python3
import json, urllib.request, sys

token = sys.argv[1]
phone_id = sys.argv[2]
to_number = sys.argv[3]

payload = json.dumps({
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to_number,
    "type": "template",
    "template": {
        "name": "hello_world",
        "language": {
            "code": "en_US"
        }
    }
}).encode()

req = urllib.request.Request(
    "https://graph.facebook.com/v21.0/%s/messages" % phone_id,
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
