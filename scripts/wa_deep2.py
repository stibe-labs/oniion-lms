import json, urllib.request, urllib.error, subprocess

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

# Check account mode
print('=== Account mode check ===')
r = api_get(f'https://graph.facebook.com/v21.0/{W}?fields=id,name,account_review_status,message_template_namespace')
print(json.dumps(r, indent=2))

# Check phone number with health_status
print('\n=== Phone health ===')
r = api_get(f'https://graph.facebook.com/v21.0/{P}?fields=verified_name,display_phone_number,quality_rating,status,account_mode,health_status,messaging_limit_tier,is_pin_enabled')
print(json.dumps(r, indent=2))

# Try via curl with -v for verbose headers
print('\n=== Curl with verbose ===')
payload = '{"messaging_product":"whatsapp","to":"917356072106","type":"text","text":{"body":"test"}}'
result = subprocess.run([
    'curl', '-s', '-w', '\\nHTTP_CODE:%{http_code}', '-X', 'POST',
    f'https://graph.facebook.com/v21.0/{P}/messages',
    '-H', f'Authorization: Bearer {T}',
    '-H', 'Content-Type: application/json',
    '-d', payload
], capture_output=True, text=True)
print(f'Response: {result.stdout}')

# Try v22.0
print('\n=== v22.0 test ===')
result2 = subprocess.run([
    'curl', '-s', '-X', 'POST',
    f'https://graph.facebook.com/v22.0/{P}/messages',
    '-H', f'Authorization: Bearer {T}',
    '-H', 'Content-Type: application/json',
    '-d', payload
], capture_output=True, text=True)
print(f'v22.0: {result2.stdout}')

# Try sending to a completely different number
print('\n=== Send to different number (919952693993) ===')
payload3 = '{"messaging_product":"whatsapp","to":"919952693993","type":"text","text":{"body":"stibe Learning test"}}'
result3 = subprocess.run([
    'curl', '-s', '-X', 'POST',
    f'https://graph.facebook.com/v21.0/{P}/messages',
    '-H', f'Authorization: Bearer {T}',
    '-H', 'Content-Type: application/json',
    '-d', payload3
], capture_output=True, text=True)
print(f'Result: {result3.stdout}')
