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

# Check phone number details with all fields
try:
    req=urllib.request.Request(f'https://graph.facebook.com/v21.0/{P}?fields=verified_name,code_verification_status,display_phone_number,quality_rating,platform_type,throughput,messaging_limit_tier,name_status,is_official_business_account,account_mode,is_pin_enabled,register_status,status',
        headers={'Authorization':'Bearer '+T})
    r=urllib.request.urlopen(req)
    data = json.loads(r.read())
    print('Phone details:')
    for k,v in sorted(data.items()):
        print(f'  {k}: {v}')
except urllib.error.HTTPError as e:
    print(f'Phone error: {json.loads(e.read())}')

# Check WABA details
print()
try:
    req=urllib.request.Request(f'https://graph.facebook.com/v21.0/{W}?fields=id,name,currency,timezone_id,account_review_status,on_behalf_of_business_info,ownership_type,primary_funding_id,purchase_order_number,message_template_namespace',
        headers={'Authorization':'Bearer '+T})
    r=urllib.request.urlopen(req)
    data = json.loads(r.read())
    print('WABA details:')
    for k,v in sorted(data.items()):
        print(f'  {k}: {v}')
except urllib.error.HTTPError as e:
    print(f'WABA error: {json.loads(e.read())}')

# Try register the phone number
print('\nTrying to register phone...')
try:
    data = json.dumps({'messaging_product':'whatsapp','pin':'123456'}).encode()
    req=urllib.request.Request(f'https://graph.facebook.com/v21.0/{P}/register', data=data, method='POST',
        headers={'Authorization':'Bearer '+T, 'Content-Type':'application/json'})
    r=urllib.request.urlopen(req)
    print(f'Register: {json.loads(r.read())}')
except urllib.error.HTTPError as e:
    print(f'Register: {json.loads(e.read())}')

# Debug token
print()
try:
    req=urllib.request.Request(f'https://graph.facebook.com/v21.0/debug_token?input_token={T}',
        headers={'Authorization':'Bearer '+T})
    r=urllib.request.urlopen(req)
    data = json.loads(r.read())
    print('Token debug:')
    for k,v in sorted(data.get('data',{}).items()):
        print(f'  {k}: {v}')
except urllib.error.HTTPError as e:
    print(f'Token debug error: {json.loads(e.read())}')
