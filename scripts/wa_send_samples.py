#!/usr/bin/env python3
"""Fetch template details and send correct test messages."""
import json, sys, urllib.request, urllib.error

env_path = '/var/www/stibe-portal/.env.local'
env = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k] = v

TOKEN = env.get('WHATSAPP_API_TOKEN', '') or env.get('WHATSAPP_ACCESS_TOKEN', '')
WABA_ID = env.get('WHATSAPP_BUSINESS_ACCOUNT_ID', '')
PHONE_ID = env.get('WHATSAPP_PHONE_NUMBER_ID', '')
TEST_PHONE = '917356072106'
BASE = 'https://graph.facebook.com/v21.0'

def api_get(url):
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {TOKEN}'})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

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

def get_templates():
    url = f'{BASE}/{WABA_ID}/message_templates?limit=50'
    data = api_get(url)
    if 'error' in data:
        print(f"Error: {data['error'].get('message','unknown')}")
        return []
    return data.get('data', [])

def count_vars(template):
    """Count the number of {{N}} variables in the BODY component."""
    for comp in template.get('components', []):
        if comp['type'] == 'BODY':
            text = comp.get('text', '')
            import re
            vars_found = re.findall(r'\{\{(\d+)\}\}', text)
            return len(vars_found), text
    return 0, ''

# Sample values for each param position
SAMPLE_VALUES = [
    'John', 'Physics Class', '2026-03-06', '2:00 PM', 'Mr. Kumar',
    '60 min', 'Batch A', 'Rs. 5,000', 'INV-001', 'See portal'
]

def send_test(template):
    name = template['name']
    lang = template.get('language', 'en')
    num_vars, body_text = count_vars(template)
    
    # Build sample params based on actual var count
    params = SAMPLE_VALUES[:num_vars]
    
    components = []
    if params:
        components.append({
            'type': 'body',
            'parameters': [{'type': 'text', 'text': p} for p in params]
        })
    
    payload = {
        'messaging_product': 'whatsapp',
        'to': TEST_PHONE,
        'type': 'template',
        'template': {
            'name': name,
            'language': {'code': lang},
        }
    }
    if components:
        payload['template']['components'] = components
    
    url = f'{BASE}/{PHONE_ID}/messages'
    result = api_post(url, payload)
    
    if 'messages' in result:
        mid = result['messages'][0].get('id', 'ok')
        return True, f'{num_vars} params', mid
    else:
        err = result.get('error', {}).get('message', str(result))
        # Get more detail
        err_data = result.get('error', {}).get('error_data', {}).get('details', '')
        return False, f'{num_vars} params', f"{err[:60]} {err_data}"

if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else 'details'
    templates = get_templates()
    
    if action == 'details':
        # Show template details with var counts
        for t in sorted(templates, key=lambda x: x['name']):
            num_vars, body = count_vars(t)
            status = t['status']
            marker = ' ✓' if status == 'APPROVED' else ''
            print(f"\n{'='*70}")
            print(f"{t['name']} | {status}{marker} | {t.get('category','')} | {num_vars} vars")
            print(f"Body: {body[:200]}")
    
    elif action == 'send':
        approved = [t for t in templates if t['status'] == 'APPROVED' and t['name'] != 'hello_world']
        approved.sort(key=lambda x: x['name'])
        
        print(f"Sending test messages for {len(approved)} approved templates...")
        print('=' * 70)
        
        for t in approved:
            ok, info, msg = send_test(t)
            status = '✓ SENT' if ok else '✗ FAIL'
            print(f"  {status}: {t['name']:<32} ({info}) {msg if not ok else ''}")
