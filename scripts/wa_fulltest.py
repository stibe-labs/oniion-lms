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
W=env['WHATSAPP_BUSINESS_ACCOUNT_ID']

def api_get(url):
    req=urllib.request.Request(url, headers={'Authorization':'Bearer '+T})
    try:
        r=urllib.request.urlopen(req)
        return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def api_post(url, data):
    body=json.dumps(data).encode()
    req=urllib.request.Request(url,data=body,method='POST',headers={'Authorization':'Bearer '+T,'Content-Type':'application/json'})
    try:
        r=urllib.request.urlopen(req)
        return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

BASE='https://graph.facebook.com/v21.0'

# 1. Debug token
print('=== TOKEN INFO ===')
r=api_get(f'https://graph.facebook.com/v21.0/debug_token?input_token={T}')
info=r.get('data',{})
print(f'  Type: {info.get("type")}')
print(f'  Valid: {info.get("is_valid")}')
print(f'  Expires: {info.get("expires_at")} (0=never)')
print(f'  Scopes: {info.get("scopes",[])}')

# 2. Phone info
print('\n=== PHONE ===')
r=api_get(f'{BASE}/{P}?fields=verified_name,display_phone_number,quality_rating,platform_type,status')
for k,v in sorted(r.items()):
    if k != 'id': print(f'  {k}: {v}')

# 3. Send plain text
print('\n=== TEST: Plain text message ===')
r=api_post(f'{BASE}/{P}/messages', {
    'messaging_product':'whatsapp',
    'to':'917356072106',
    'type':'text',
    'text':{'body':'Hello from stibe Learning! This is a test message.'}
})
if 'messages' in r:
    print(f'  SUCCESS! Message ID: {r["messages"][0]["id"]}')
else:
    print(f'  FAIL: {r.get("error",{}).get("message","?")}')

# 4. Send template (stibe_receipt - 4 params, APPROVED)
print('\n=== TEST: Template stibe_receipt ===')
r=api_post(f'{BASE}/{P}/messages', {
    'messaging_product':'whatsapp',
    'to':'917356072106',
    'type':'template',
    'template':{
        'name':'stibe_receipt',
        'language':{'code':'en'},
        'components':[{
            'type':'body',
            'parameters':[
                {'type':'text','text':'Arun'},
                {'type':'text','text':'REC-2026-001'},
                {'type':'text','text':'Rs. 5,000'},
                {'type':'text','text':'Mar 6, 2026'}
            ]
        }]
    }
})
if 'messages' in r:
    print(f'  SUCCESS! Message ID: {r["messages"][0]["id"]}')
else:
    print(f'  FAIL: {r.get("error",{}).get("message","?")}')
