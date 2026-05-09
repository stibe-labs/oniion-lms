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

print('Token prefix:', T[:20]+'...')
print('Phone ID:', P)
print('WABA ID:', W)

# Check /me
try:
    req=urllib.request.Request('https://graph.facebook.com/v21.0/me', headers={'Authorization':'Bearer '+T})
    r=urllib.request.urlopen(req)
    print('\n/me:', json.loads(r.read()))
except urllib.error.HTTPError as e:
    print('\n/me error:', json.loads(e.read()))

# Check phone number
try:
    req=urllib.request.Request('https://graph.facebook.com/v21.0/'+P, headers={'Authorization':'Bearer '+T})
    r=urllib.request.urlopen(req)
    print('\nPhone:', json.loads(r.read()))
except urllib.error.HTTPError as e:
    print('\nPhone error:', json.loads(e.read()))

# Check WABA
try:
    req=urllib.request.Request('https://graph.facebook.com/v21.0/'+W, headers={'Authorization':'Bearer '+T})
    r=urllib.request.urlopen(req)
    print('\nWABA:', json.loads(r.read()))
except urllib.error.HTTPError as e:
    print('\nWABA error:', json.loads(e.read()))

# Check phone numbers under WABA
try:
    req=urllib.request.Request('https://graph.facebook.com/v21.0/'+W+'/phone_numbers', headers={'Authorization':'Bearer '+T})
    r=urllib.request.urlopen(req)
    print('\nWABA phones:', json.loads(r.read()))
except urllib.error.HTTPError as e:
    print('\nWABA phones error:', json.loads(e.read()))
