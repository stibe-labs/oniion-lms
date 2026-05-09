import json, re, urllib.request, urllib.error

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
TO='917356765036'
BASE='https://graph.facebook.com/v21.0'

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

# Fetch all templates
result = api_get(f'{BASE}/{W}/message_templates?limit=50')
templates = sorted(result.get('data',[]), key=lambda x: x['name'])
approved = [t for t in templates if t['status']=='APPROVED' and t['name']!='hello_world']
pending = [t for t in templates if t['status']=='PENDING']
rejected = [t for t in templates if t['status']=='REJECTED']

print('='*70)
print('TEMPLATE STATUS REPORT')
print('='*70)
for t in templates:
    s = t['status']
    icon = {'APPROVED':'Y','PENDING':'.','REJECTED':'X'}.get(s,'?')
    print(f'  [{icon}] {t["name"]:<35} {s:<10} {t.get("category","")}')
print(f'\nTotal: {len(templates)} | Approved: {len(approved)} | Pending: {len(pending)} | Rejected: {len(rejected)}')

# Sample values keyed by template name
SAMPLES = {
    'stibe_class_rescheduled': ['Arun','Physics Class','Mar 6','2:00 PM','Mar 7','3:00 PM'],
    'stibe_demo_confirmed': ['Arun','Mathematics','Mrs. Sharma','Mar 7 at 10:00 AM','stibelearning.online/demo/abc'],
    'stibe_demo_waiting': ['Arun','Mathematics'],
    'stibe_leave_impact': ['Arun','Mrs. Sharma','Mar 10-12, 2026','Classes rescheduled to next week'],
    'stibe_leave_req': ['Admin','Mrs. Sharma','Mar 10-12, 2026','Personal reasons'],
    'stibe_leave_update': ['Mrs. Sharma','Mar 10-12, 2026','Approved','Enjoy your leave'],
    'stibe_onboarding': ['Arun','student','stibelearning.online','info.pydart@gmail.com'],
    'stibe_payment_due': ['Arun','Rs. 5,000','March tuition fees','Mar 15, 2026','INV-2026-001'],
    'stibe_receipt': ['Arun','REC-2026-001','Rs. 5,000','Mar 6, 2026'],
    'stibe_request_update': ['Arun','Extra Physics class','Approved','Scheduled for Mar 10 at 3PM'],
    'stibe_weekly_schedule': ['Arun','Mar 7-13, 2026','Mon: Math 10AM, Wed: Science 2PM, Fri: English 4PM'],
}

print(f'\n{"="*70}')
print(f'SENDING {len(approved)} APPROVED TEMPLATES to {TO}')
print(f'{"="*70}')

sent = 0
failed = 0
for t in approved:
    name = t['name']
    lang = t.get('language','en')
    
    # Count body vars
    body_text = ''
    for comp in t.get('components',[]):
        if comp['type'] == 'BODY':
            body_text = comp.get('text','')
    num_vars = len(re.findall(r'\{\{(\d+)\}\}', body_text))
    
    # Get sample values
    if name in SAMPLES:
        params = SAMPLES[name]
    else:
        defaults = ['Arun','Value2','Value3','Value4','Value5','Value6']
        params = defaults[:num_vars]
    
    components = []
    if params:
        components.append({
            'type':'body',
            'parameters':[{'type':'text','text':p} for p in params]
        })
    
    payload = {
        'messaging_product':'whatsapp',
        'to':TO,
        'type':'template',
        'template':{
            'name':name,
            'language':{'code':lang},
            'components':components
        }
    }
    
    r = api_post(f'{BASE}/{P}/messages', payload)
    if 'messages' in r:
        mid = r['messages'][0].get('id','?')[:30]
        print(f'  Y  {name:<35} SENT ({num_vars} params)')
        sent += 1
    else:
        err = r.get('error',{}).get('message','?')[:50]
        print(f'  X  {name:<35} FAIL: {err}')
        failed += 1

print(f'\n{"="*70}')
print(f'Results: {sent} sent, {failed} failed out of {len(approved)} approved')
