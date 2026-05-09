#!/usr/bin/env python3
"""Fetch exact template structures and send samples matching actual param counts."""
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

# Fetch all templates with full details
result = api_get(f"{API}/{WABA_ID}/message_templates?limit=100&fields=name,status,language,category,components")
if "error" in result:
    print(f"ERROR: {result['error'].get('message', result['error'])}")
    sys.exit(1)

templates = result.get("data", [])
approved = [t for t in templates if t["status"] == "APPROVED" and t["name"] != "hello_world"]
approved.sort(key=lambda t: t["name"])

SAMPLE_VALUES = ["Arun", "Mathematics", "Mar 7, 2026", "10:00 AM", "Mrs. Sharma", "Batch A", "60 minutes", "Rs. 5,000"]

print(f"{'='*70}")
print(f"APPROVED TEMPLATES — STRUCTURE ANALYSIS")
print(f"{'='*70}")

for t in approved:
    name = t["name"]
    lang = t.get("language", "en")
    components = t.get("components", [])
    
    print(f"\n📋 {name} (lang={lang}, category={t.get('category','')})")
    
    # Count variables in each component
    send_components = []
    for comp in components:
        comp_type = comp.get("type", "").upper()
        text = comp.get("text", "")
        # Count {{N}} placeholders
        import re
        vars_found = re.findall(r'\{\{(\d+)\}\}', text)
        num_vars = len(vars_found)
        
        print(f"  Component: {comp_type} — {num_vars} vars — {text[:100]}")
        
        if num_vars > 0:
            params = []
            for i in range(num_vars):
                params.append({"type": "text", "text": SAMPLE_VALUES[i] if i < len(SAMPLE_VALUES) else f"Value{i+1}"})
            send_components.append({
                "type": comp_type.lower(),
                "parameters": params
            })
    
    # Send the template  
    payload = {
        "messaging_product": "whatsapp",
        "to": TEST_RECIPIENT,
        "type": "template",
        "template": {
            "name": name,
            "language": {"code": lang},
            "components": send_components
        }
    }
    
    print(f"  Sending with {len(send_components)} components...")
    result = api_post(f"{API}/{PHONE_ID}/messages", payload)
    if "messages" in result:
        msg_id = result["messages"][0].get("id", "?")
        print(f"  ✓ SENT! ID: {msg_id}")
    elif "error" in result:
        err = result["error"]
        err_msg = err.get("message", "")
        details = err.get("error_data", {}).get("details", "")
        print(f"  ✗ FAILED: {err_msg}")
        if details:
            print(f"    Details: {details}")
        # dump payload for debug
        print(f"    Payload components: {json.dumps(send_components, indent=2)[:300]}")

print(f"\n{'='*70}")
print("DONE")
