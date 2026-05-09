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

def try_send(version, phone_to, payload_desc, payload):
    data = json.dumps(payload).encode()
    url = f'https://graph.facebook.com/{version}/{P}/messages'
    req = urllib.request.Request(url, data=data, method='POST',
        headers={'Authorization':'Bearer '+T, 'Content-Type':'application/json'})
    try:
        r = urllib.request.urlopen(req)
        result = json.loads(r.read())
        print(f'  OK: {result}')
        return True
    except urllib.error.HTTPError as e:
        result = json.loads(e.read())
        err = result.get('error', {})
        print(f'  FAIL [{err.get("code")}]: {err.get("message","?")} | details: {err.get("error_data",{}).get("details","")}')
        return False

# Test 1: v21.0 text to self
print('Test 1: v21.0 text to business number')
try_send('v21.0', '917356072106', 'text',
    {'messaging_product':'whatsapp','to':'917356072106','type':'text','text':{'body':'Hi test'}})

# Test 2: v22.0 text to self
print('Test 2: v22.0 text to business number')
try_send('v22.0', '917356072106', 'text',
    {'messaging_product':'whatsapp','to':'917356072106','type':'text','text':{'body':'Hi test'}})

# Test 3: v21.0 with recipient_type
print('Test 3: v21.0 with recipient_type individual')
try_send('v21.0', '917356072106', 'text',
    {'messaging_product':'whatsapp','recipient_type':'individual','to':'917356072106','type':'text','text':{'body':'Hi test'}})

# Test 4: v21.0 text with + prefix
print('Test 4: v21.0 text with + prefix')
try_send('v21.0', '+917356072106', 'text',
    {'messaging_product':'whatsapp','to':'+917356072106','type':'text','text':{'body':'Hi test'}})

# Test 5: Check debug token
print('\nTest 5: Debug token info')
req = urllib.request.Request(f'https://graph.facebook.com/v21.0/debug_token?input_token={T}',
    headers={'Authorization':'Bearer '+T})
try:
    r = urllib.request.urlopen(req)
    data = json.loads(r.read())
    info = data.get('data', {})
    print(f'  App ID: {info.get("app_id")}')
    print(f'  Type: {info.get("type")}')
    print(f'  Valid: {info.get("is_valid")}')
    print(f'  Expires: {info.get("expires_at")}')
    print(f'  Scopes: {info.get("scopes", [])}')
    print(f'  Granular scopes: {info.get("granular_scopes", [])}')
except urllib.error.HTTPError as e:
    print(f'  Error: {json.loads(e.read())}')
