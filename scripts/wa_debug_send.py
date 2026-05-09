#!/usr/bin/env python3
"""Debug a single template send."""
import json, re, sys, urllib.request, urllib.error

env_path = '/var/www/stibe-portal/.env.local'
env = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k] = v

TOKEN = env.get('WHATSAPP_API_TOKEN', '')
PHONE_ID = env.get('WHATSAPP_PHONE_NUMBER_ID', '')
WABA_ID = env.get('WHATSAPP_BUSINESS_ACCOUNT_ID', '')
TEST_PHONE = '917356072106'
BASE = 'https://graph.facebook.com/v21.0'

def api_get(url):
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {TOKEN}'})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def api_post(url, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method='POST',
                                headers={'Authorization': f'Bearer {TOKEN}',
                                         'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

# Get all templates
data = api_get(f'{BASE}/{WABA_ID}/message_templates?limit=50')
templates = {t['name']: t for t in data.get('data', [])}

# Pick one to debug
name = sys.argv[1] if len(sys.argv) > 1 else 'stibe_receipt'
t = templates.get(name)
if not t:
    print(f"Template '{name}' not found")
    sys.exit(1)

print(f"Template: {name}")
print(f"Status: {t['status']}")
print(f"Language: {t.get('language', 'N/A')}")
print(f"Category: {t.get('category', 'N/A')}")
print(f"\nComponents:")
num_vars = 0
for comp in t.get('components', []):
    print(f"  Type: {comp['type']}")
    print(f"  Text: {comp.get('text', 'N/A')[:200]}")
    if 'example' in comp:
        print(f"  Example: {json.dumps(comp['example'])}")
    if comp['type'] == 'BODY':
        vars_found = re.findall(r'\{\{(\d+)\}\}', comp.get('text', ''))
        num_vars = len(vars_found)
        print(f"  Variables: {num_vars} -> {vars_found}")
    print()

# Build and send payload
samples = ['John', 'Physics Class', '2026-03-06', '2:00 PM', 'Mr. Kumar', '60 min']
params = samples[:num_vars]

payload = {
    'messaging_product': 'whatsapp',
    'to': TEST_PHONE,
    'type': 'template',
    'template': {
        'name': name,
        'language': {'code': t.get('language', 'en_US')},
        'components': [
            {
                'type': 'body',
                'parameters': [{'type': 'text', 'text': p} for p in params]
            }
        ] if params else []
    }
}

print(f"Payload:")
print(json.dumps(payload, indent=2))

print(f"\nSending...")
result = api_post(f'{BASE}/{PHONE_ID}/messages', payload)
print(f"\nResponse:")
print(json.dumps(result, indent=2))
