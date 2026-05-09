#!/usr/bin/env python3
"""Debug: test basic messaging capabilities step by step."""
import json, os, sys, urllib.request, urllib.error

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
TEST_RECIPIENT = "917356072106"
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

# Step 1: Verify token works
print("=== STEP 1: Verify Token ===")
r = api_get(f"{API}/{WABA_ID}")
print(json.dumps(r, indent=2))

# Step 2: Check phone number
print("\n=== STEP 2: Phone Number Details ===")
r = api_get(f"{API}/{PHONE_ID}")
print(json.dumps(r, indent=2))

# Step 3: Try a plain text message
print("\n=== STEP 3: Plain Text Message ===")
payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": TEST_RECIPIENT,
    "type": "text",
    "text": {"body": "Test from stibe debug script"}
}
r = api_post(f"{API}/{PHONE_ID}/messages", payload)
print(json.dumps(r, indent=2))

# Step 4: Try template with explicit recipient_type
print("\n=== STEP 4: Template with recipient_type ===")
payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": TEST_RECIPIENT,
    "type": "template",
    "template": {
        "name": "stibe_demo_waiting",
        "language": {"code": "en"},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": "Arun"},
                    {"type": "text", "text": "Mathematics"}
                ]
            }
        ]
    }
}
r = api_post(f"{API}/{PHONE_ID}/messages", payload)
print(json.dumps(r, indent=2))

# Step 5: Try with different API versions
for ver in ["v22.0", "v20.0", "v19.0"]:
    print(f"\n=== STEP 5: Try API {ver} ===")
    payload = {
        "messaging_product": "whatsapp",
        "to": TEST_RECIPIENT,
        "type": "template",
        "template": {
            "name": "stibe_demo_waiting",
            "language": {"code": "en"},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": "Arun"},
                        {"type": "text", "text": "Mathematics"}
                    ]
                }
            ]
        }
    }
    r = api_post(f"https://graph.facebook.com/{ver}/{PHONE_ID}/messages", payload)
    success = "messages" in r
    err = r.get("error", {}).get("message", "") if not success else ""
    print(f"  {ver}: {'SUCCESS' if success else 'FAIL'} {err}")
    if success:
        print(f"  Message ID: {r['messages'][0]['id']}")
        break
