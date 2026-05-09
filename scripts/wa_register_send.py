import json, urllib.request, urllib.error

env={}
with open('/var/www/stibe-portal/.env.local') as f:
    for l in f:
        l=l.strip()
        if '=' in l and not l.startswith('#'):
            k,v=l.split('=',1)
            env[k]=v

T=env['WHATSAPP_API_TOKEN']
P=env['WHATSAPP_PHONE_NUMBER_ID']
BASE='https://graph.facebook.com/v21.0'

def api_post(url, data):
    body=json.dumps(data).encode()
    req=urllib.request.Request(url,data=body,method='POST',headers={'Authorization':'Bearer '+T,'Content-Type':'application/json'})
    try:
        r=urllib.request.urlopen(req)
        return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

# Step 1: Register the phone number with Cloud API
print('=== Registering phone number ===')
r = api_post(f'{BASE}/{P}/register', {
    'messaging_product': 'whatsapp',
    'pin': '123456'
})
print(f'  Register result: {r}')

# Step 2: Try text message now
print('\n=== Sending text message ===')
r = api_post(f'{BASE}/{P}/messages', {
    'messaging_product': 'whatsapp',
    'to': '917356072106',
    'type': 'text',
    'text': {'body': 'Hello from stibe Learning - permanent token test!'}
})
if 'messages' in r:
    print(f'  SUCCESS! Message ID: {r["messages"][0]["id"]}')
else:
    print(f'  FAIL: {json.dumps(r, indent=2)}')

# Step 3: Try template
print('\n=== Sending template stibe_receipt ===')
r = api_post(f'{BASE}/{P}/messages', {
    'messaging_product': 'whatsapp',
    'to': '917356072106',
    'type': 'template',
    'template': {
        'name': 'stibe_receipt',
        'language': {'code': 'en'},
        'components': [{
            'type': 'body',
            'parameters': [
                {'type': 'text', 'text': 'Arun'},
                {'type': 'text', 'text': 'REC-2026-001'},
                {'type': 'text', 'text': 'Rs. 5,000'},
                {'type': 'text', 'text': 'Mar 6, 2026'}
            ]
        }]
    }
})
if 'messages' in r:
    print(f'  SUCCESS! Message ID: {r["messages"][0]["id"]}')
else:
    print(f'  FAIL: {json.dumps(r, indent=2)}')
