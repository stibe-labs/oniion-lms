#!/usr/bin/env python3
"""Check all WhatsApp template statuses and optionally send test messages for approved ones."""
import json, os, sys, urllib.request, urllib.error

# Read from .env.local
env_path = '/var/www/stibe-portal/.env.local'
env = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k] = v

TOKEN = env.get('WHATSAPP_API_TOKEN', '') or env.get('WHATSAPP_ACCESS_TOKEN', '')
WABA_ID = env.get('WHATSAPP_BUSINESS_ACCOUNT_ID', '')
PHONE_ID = env.get('WHATSAPP_PHONE_NUMBER_ID', '')
TEST_PHONE = '917356072106'  # Business phone for testing

BASE = 'https://graph.facebook.com/v21.0'

def api_get(url):
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {TOKEN}'})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def api_post(url, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method='POST',
                                headers={'Authorization': f'Bearer {TOKEN}',
                                         'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

# Template param counts (for sending test messages)
TEMPLATE_PARAMS = {
    'stibe_alert': ['User', 'This is a test alert from stibe'],
    'stibe_class_reminder': ['Student', 'Mathematics', '10:00 AM', 'Mr. Kumar', 'Batch A'],
    'stibe_teacher_class': ['Teacher', 'Room 101', 'Physics', '2026-03-06', '2:00 PM', '60 min'],
    'stibe_student_class': ['Student', 'Room 101', 'Physics', '2026-03-06', '2:00 PM', '60 min'],
    'stibe_class_cancelled': ['Student', 'Physics Class', '2026-03-06', '2:00 PM'],
    'stibe_class_rescheduled': ['Student', 'Physics Class', 'Mar 6', '2:00 PM', 'Mar 7', '3:00 PM'],
    'stibe_class_live': ['Student', 'Mathematics', 'Mr. Kumar', 'stibelearning.online'],
    'stibe_payment_confirm': ['Parent', 'Rs. 5,000', 'TXN123456', '2026-03-06'],
    'stibe_payment_due': ['Parent', 'Rs. 5,000', 'March tuition', '2026-03-15', 'INV-2026-001'],
    'stibe_invoice': ['Parent', 'INV-2026-001', 'Rs. 5,000', '2026-03-15'],
    'stibe_receipt': ['Parent', 'REC-2026-001', 'Rs. 5,000', '2026-03-06'],
    'stibe_exam_result': ['Student', 'Mathematics Mid-Term', '85/100', 'Grade A'],
    'stibe_onboarding': ['Student', 'stibe Learning', 'stibelearning.online', 'your coordinator'],
    'stibe_batch_assign': ['Student', 'JEE Advanced Batch', 'student', 'Physics, Chemistry, Maths'],
    'stibe_daily_schedule': ['Teacher', '2026-03-06', '3 classes today: Math 10AM, Physics 2PM, Chem 4PM'],
    'stibe_weekly_schedule': ['Teacher', 'Mar 2-8', '15 classes: Mon-Fri schedule attached'],
    'stibe_session_request': ['Coordinator', 'Extra Physics class', 'Mr. Kumar', '2026-03-10'],
    'stibe_request_update': ['Teacher', 'Extra Physics class', 'approved', 'Scheduled for Mar 10'],
    'stibe_session_moved': ['Student', 'Physics class', 'Mar 6 2PM', 'Mar 7 3PM'],
    'stibe_session_cancel': ['Student', 'Physics class', '2026-03-06', 'Teacher unavailable'],
    'stibe_leave_req': ['Coordinator', 'Mr. Kumar', 'Mar 10-12', 'Personal reasons'],
    'stibe_leave_update': ['Teacher', 'Mar 10-12', 'approved', 'Classes will be covered'],
    'stibe_leave_impact': ['Student', 'Mr. Kumar', 'Mar 10-12', 'Substitute: Ms. Sharma'],
    'stibe_payslip': ['Teacher', 'February 2026', '20', 'Rs. 25,000'],
    'stibe_coord_summary': ['Coordinator', 'Physics Room', '2026-03-06', 'Mr. Kumar - 30 students attended'],
    'stibe_demo_req': ['Coordinator', 'John Doe', 'Mathematics', '2026-03-07'],
    'stibe_demo_confirmed': ['Parent', 'Mathematics', '2026-03-07', '10:00 AM', 'Mr. Kumar'],
    'stibe_demo_waiting': ['Parent', 'We are reviewing your demo request and will confirm shortly'],
    'hello_world': [],
}

def list_templates():
    url = f'{BASE}/{WABA_ID}/message_templates?limit=50'
    data = api_get(url)
    if 'error' in data:
        print(f"Error: {data['error'].get('message','unknown')}")
        return []
    
    templates = sorted(data.get('data', []), key=lambda x: x['name'])
    approved = []
    
    print(f"\n{'Template Name':<32} {'Status':<12} {'Category'}")
    print('-' * 70)
    for t in templates:
        status = t['status']
        marker = ' ✓' if status == 'APPROVED' else ''
        print(f"{t['name']:<32} {status:<12} {t.get('category','')}{marker}")
        if status == 'APPROVED':
            approved.append(t['name'])
    
    print(f'\nTotal: {len(templates)} | Approved: {len(approved)} | Pending: {sum(1 for t in templates if t["status"]=="PENDING")} | Rejected: {sum(1 for t in templates if t["status"]=="REJECTED")}')
    return approved

def send_test(template_name, lang='en'):
    params = TEMPLATE_PARAMS.get(template_name, [])
    
    components = []
    if params:
        components.append({
            'type': 'body',
            'parameters': [{'type': 'text', 'text': p} for p in params]
        })
    
    payload = {
        'messaging_product': 'whatsapp',
        'to': TEST_PHONE,
        'type': 'template',
        'template': {
            'name': template_name,
            'language': {'code': lang},
        }
    }
    if components:
        payload['template']['components'] = components
    
    url = f'{BASE}/{PHONE_ID}/messages'
    result = api_post(url, payload)
    
    if 'messages' in result:
        mid = result['messages'][0].get('id', 'ok')
        return True, mid
    else:
        err = result.get('error', {}).get('message', str(result))
        return False, err

if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else 'list'
    
    if action == 'list':
        list_templates()
    
    elif action == 'send':
        approved = list_templates()
        if not approved:
            print("\nNo approved templates to send.")
            sys.exit(0)
        
        print(f"\n{'='*70}")
        print(f"Sending test messages for {len(approved)} approved templates to {TEST_PHONE}...")
        print('='*70)
        
        for name in approved:
            ok, msg = send_test(name)
            status = '✓ SENT' if ok else '✗ FAIL'
            print(f"  {status}: {name:<32} {msg[:50] if not ok else ''}")
    
    elif action == 'send-one':
        if len(sys.argv) < 3:
            print("Usage: wa_check_status.py send-one <template_name>")
            sys.exit(1)
        name = sys.argv[2]
        ok, msg = send_test(name)
        print(f"{'✓ SENT' if ok else '✗ FAIL'}: {name} - {msg}")
