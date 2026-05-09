#!/usr/bin/env python3
import json, urllib.request, sys

token = sys.argv[1]
waba_id = sys.argv[2]

req = urllib.request.Request(
    "https://graph.facebook.com/v21.0/%s/message_templates?limit=50" % waba_id,
    headers={"Authorization": "Bearer %s" % token},
    method="GET"
)

try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    templates = data.get("data", [])
    if not templates:
        print("NO TEMPLATES FOUND on this WABA")
        sys.exit(0)
    for t in templates:
        name = t.get("name", "?")
        status = t.get("status", "?")
        cat = t.get("category", "?")
        lang = t.get("language", "?")
        print("Name: %s | Status: %s | Category: %s | Lang: %s" % (name, status, cat, lang))
        for comp in t.get("components", []):
            if comp.get("type") == "BODY":
                body_text = comp.get("text", "")
                print("  Body: %s" % body_text[0:150])
except urllib.error.HTTPError as e:
    body = json.loads(e.read())
    print("ERROR %d: %s" % (e.code, json.dumps(body, indent=2)))
