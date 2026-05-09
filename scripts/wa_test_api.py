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
# Test 1: simple text
data=json.dumps({'messaging_product':'whatsapp','to':'917356072106','type':'text','text':{'body':'Test from stibe API'}}).encode()
req=urllib.request.Request('https://graph.facebook.com/v21.0/'+P+'/messages',data=data,method='POST',headers={'Authorization':'Bearer '+T,'Content-Type':'application/json'})
try:
    r=urllib.request.urlopen(req)
    print('TEXT OK:', json.loads(r.read()))
except urllib.error.HTTPError as e:
    print('TEXT FAIL:', json.loads(e.read()))

# Test 2: template with en_US
data2=json.dumps({'messaging_product':'whatsapp','to':'917356072106','type':'template','template':{'name':'stibe_receipt','language':{'code':'en_US'},'components':[{'type':'body','parameters':[{'type':'text','text':'John'},{'type':'text','text':'REC-001'},{'type':'text','text':'Rs. 5000'},{'type':'text','text':'2026-03-06'}]}]}}).encode()
req2=urllib.request.Request('https://graph.facebook.com/v21.0/'+P+'/messages',data=data2,method='POST',headers={'Authorization':'Bearer '+T,'Content-Type':'application/json'})
try:
    r2=urllib.request.urlopen(req2)
    print('TMPL en_US OK:', json.loads(r2.read()))
except urllib.error.HTTPError as e2:
    print('TMPL en_US FAIL:', json.loads(e2.read()))

# Test 3: template with en
data3=json.dumps({'messaging_product':'whatsapp','to':'917356072106','type':'template','template':{'name':'stibe_receipt','language':{'code':'en'},'components':[{'type':'body','parameters':[{'type':'text','text':'John'},{'type':'text','text':'REC-001'},{'type':'text','text':'Rs. 5000'},{'type':'text','text':'2026-03-06'}]}]}}).encode()
req3=urllib.request.Request('https://graph.facebook.com/v21.0/'+P+'/messages',data=data3,method='POST',headers={'Authorization':'Bearer '+T,'Content-Type':'application/json'})
try:
    r3=urllib.request.urlopen(req3)
    print('TMPL en OK:', json.loads(r3.read()))
except urllib.error.HTTPError as e3:
    print('TMPL en FAIL:', json.loads(e3.read()))
