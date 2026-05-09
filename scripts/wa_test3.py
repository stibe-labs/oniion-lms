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

# Phone details
try:
    req=urllib.request.Request(f'https://graph.facebook.com/v21.0/{P}?fields=verified_name,code_verification_status,display_phone_number,quality_rating,platform_type,throughput,messaging_limit_tier,name_status,is_official_business_account,account_mode,is_pin_enabled,status',
        headers={'Authorization':'Bearer '+T})
    r=urllib.request.urlopen(req)
    data = json.loads(r.read())
    print('Phone details:')
    for k,v in sorted(data.items()):
        print(f'  {k}: {v}')
except urllib.error.HTTPError as e:
    err = json.loads(e.read())
    print(f'Phone error: {err}')

# Try sending to a different number - any other test number
print('\nTrying to send text to business number:')
payload = json.dumps({'messaging_product':'whatsapp','to':'917356072106','type':'text','text':{'body':'Test from stibe API'}}).encode()
try:
    req=urllib.request.Request(f'https://graph.facebook.com/v21.0/{P}/messages', data=payload, method='POST',
        headers={'Authorization':'Bearer '+T, 'Content-Type':'application/json'})
    r=urllib.request.urlopen(req)
    print(f'OK: {json.loads(r.read())}')
except urllib.error.HTTPError as e:
    err = json.loads(e.read())
    print(f'FAIL: {json.dumps(err, indent=2)}')

# Try sending to 919876543210 (test number)
print('\nTrying to send text to 919952693993:')
payload2 = json.dumps({'messaging_product':'whatsapp','to':'919952693993','type':'text','text':{'body':'Test from stibe Learning API'}}).encode()
try:
    req=urllib.request.Request(f'https://graph.facebook.com/v21.0/{P}/messages', data=payload2, method='POST',
        headers={'Authorization':'Bearer '+T, 'Content-Type':'application/json'})
    r=urllib.request.urlopen(req)
    print(f'OK: {json.loads(r.read())}')
except urllib.error.HTTPError as e:
    err = json.loads(e.read())
    print(f'FAIL: {json.dumps(err, indent=2)}')
