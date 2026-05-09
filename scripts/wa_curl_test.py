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

# Check for hidden characters in token
print(f'Token length: {len(T)}')
print(f'Token repr: {repr(T[:30])}...{repr(T[-10:])}')
print(f'Any non-ascii: {any(ord(c) > 127 for c in T)}')
print(f'Any whitespace: {any(c.isspace() for c in T)}')

# Try curl directly
print('\n--- curl test ---')
payload = json.dumps({
    'messaging_product': 'whatsapp',
    'to': '917356072106',
    'type': 'text',
    'text': {'body': 'stibe test'}
})
result = subprocess.run([
    'curl', '-s', '-X', 'POST',
    f'https://graph.facebook.com/v21.0/{P}/messages',
    '-H', f'Authorization: Bearer {T}',
    '-H', 'Content-Type: application/json',
    '-d', payload
], capture_output=True, text=True)
print(f'curl stdout: {result.stdout}')
print(f'curl stderr: {result.stderr}')

# Also try with v20.0
print('\n--- curl v20.0 ---')
result2 = subprocess.run([
    'curl', '-s', '-X', 'POST',
    f'https://graph.facebook.com/v20.0/{P}/messages',
    '-H', f'Authorization: Bearer {T}',
    '-H', 'Content-Type: application/json',
    '-d', payload
], capture_output=True, text=True)
print(f'curl stdout: {result2.stdout}')
