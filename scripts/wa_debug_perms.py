#!/usr/bin/env python3
"""Check token permissions and try sending to a different number."""
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
API = "https://graph.facebook.com/v21.0"

def api_get(url):
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

# Check token debug info (permissions)
print("=== TOKEN DEBUG INFO ===")
r = api_get(f"https://graph.facebook.com/debug_token?input_token={TOKEN}")
print(json.dumps(r, indent=2))

# Check /me endpoint
print("\n=== /me ===")
r = api_get(f"https://graph.facebook.com/v21.0/me")
print(json.dumps(r, indent=2))

# Check phone number messaging limit
print("\n=== PHONE NUMBER MESSAGING LIMITS ===") 
r = api_get(f"{API}/{PHONE_ID}?fields=messaging_limit_tier,quality_rating,verified_name,display_phone_number,name_status,status")
print(json.dumps(r, indent=2))
