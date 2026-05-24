import os
import time
import threading
import uuid
from flask import Flask, render_template, request, jsonify
import requests

app = Flask(__name__)
app.secret_key = "Suraj_Oberoy_Ultra_Premium_Cookie_Key_2026"

ACTIVE_TASKS = {}
LIVE_LOGS = {}

def add_log(task_id, message):
    if task_id not in LIVE_LOGS:
        LIVE_LOGS[task_id] = []
    timestamp = time.strftime("%H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    LIVE_LOGS[task_id].append(log_entry)
    print(f"[{task_id}] {log_entry}")

def parse_cookies(cookie_text):
    """कुकीज़ टेक्स्ट को डिक्शनरी फॉर्मेट में बदलने का सिस्टम"""
    cookies = {}
    try:
        # अगर कुकीज़ JSON फॉर्मेट में हैं
        if "[" in cookie_text and "]" in cookie_text:
            import json
            cookie_json = json.loads(cookie_text)
            for c in cookie_json:
                cookies[c['name']] = c['value']
        else:
            # अगर कुकीज़ नॉर्मल स्ट्रिंग फॉर्मेट में हैं (c_user=xxxx; xs=xxxx)
            pairs = cookie_text.split(';')
            for pair in pairs:
                if '=' in pair:
                    k, v = pair.split('=', 1)
                    cookies[k.strip()] = v.strip()
    except Exception:
        pass
    return cookies

def suraj_cookie_engine(task_id, cookie_raw, convo_id, hater_name, interval, messages):
    """सूरज ओबेरॉय कुकीज़ गेटवे - 1 महीने तक बिना रुके चलने वाला नॉन-स्टॉप इंजन"""
    ACTIVE_TASKS[task_id]["status"] = "Running"
    add_log(task_id, "🚀 SURAJ OBEROY ULTRA COOKIE ENGINE INITIALIZED.")
    
    my_cookies = parse_cookies(cookie_raw)
    if not my_cookies or 'xs' not in my_cookies:
        add_log(task_id, "❌ COOKIE ERROR -> कुकीज़ का फॉर्मेट गलत है या अमान्य है!")
        ACTIVE_TASKS[task_id]["status"] = "Stopped"
        return

    # ऑफिशियल फेसबुक एंड्रॉइड ऐप के हेडर्स ताकि स्पैम ब्लॉक न हो
    headers = {
        'authority': 'mbasic.facebook.com',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'max-age=0',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://mbasic.facebook.com',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Mobile Safari/537.36'
    }

    session = requests.Session()
    session.cookies.update(my_cookies)
    
    add_log(task_id, "🔑 Facebook Browser Session Established Safely.")

    while ACTIVE_TASKS.get(task_id, {}).get("status") == "Running":
        for msg in messages:
            if ACTIVE_TASKS.get(task_id, {}).get("status") != "Running":
                break
                
            if not msg.strip():
                continue

            full_message = f"{hater_name} {msg.strip()}" if hater_name else msg.strip()
            
            try:
                # स्टेप 1: सेंडिंग पेज से fb_dtsg (सिक्योरिटी टोकन) निकालना
                chat_url = f"https://mbasic.facebook.com/messages/read/?tid=cid.g.{convo_id}" if len(convo_id) > 12 else f"https://mbasic.facebook.com/messages/read/?tid={convo_id}"
                
                res = session.get(chat_url, headers=headers, timeout=10)
                
                # fb_dtsg और tids खोजना जो मैसेजेस भेजने के लिए अनिवार्य हैं
                import re
                fb_dtsg_match = re.search(r'name="fb_dtsg" value="(.*?)"', res.text)
                tids_match = re.search(r'name="tids" value="(.*?)"', res.text)
                
                # अगर mbasic थ्रेड डायरेक्ट नहीं मिलता, तो यूनिवर्सल मोबाइल लिंक यूज़ करेंगे
                if not fb_dtsg_match:
                    # अल्टरनेटिव ग्राफ बाईपास रूट फॉर कुकीज़
                    url = f"https://graph.facebook.com/v17.0/t_{convo_id}/messages"
                    # कुकीज़ वाले सेशन में एक्सेस टोकन के बिना भी कुकी से डायरेक्ट सेंडिंग
                    fb_dtsg_match = re.search(r'["\']DTSGInitialData["\'],\[\],{"token":"(.*?)"}', res.text)
                
                if fb_dtsg_match:
                    fb_dtsg = fb_dtsg_match.group(1)
                    
                    # सेंड एक्शन यूआरएल निकालना
                    action_match = re.search(r'action="/messages/send/\?icm=1(.*?)"', res.text)
                    action_url = "https://mbasic.facebook.com/messages/send/?icm=1" + action_match.group(1) if action_match else f"https://mbasic.facebook.com/messages/send/?icm=1"
                    
                    tids = tids_match.group(1) if tids_match else f"cid.g.{convo_id}"
                    
                    payload = {
                        'fb_dtsg': fb_dtsg,
                        'tids': tids,
                        'body': full_message,
                        'send': 'Send'
                    }
                    
                    response = session.post(action_url, data=payload, headers=headers, timeout=10)
                    
                    if response.status_code == 200:
                        ACTIVE_TASKS[task_id]["sent_count"] += 1
                        add_log(task_id, f"✅ GROUP INBOX HIT -> Sent: {full_message} | Total: {ACTIVE_TASKS[task_id]['sent_count']}")
                    else:
                        add_log(task_id, f"⚠️ RETRYING... -> Sending status processing.")
                else:
                    # अगर mbasic काम नहीं कर रहा, तो डायरेक्ट ग्राफ-कुकी चैनल हिट करेंगे
                    graph_url = f"https://graph.facebook.com/v17.0/t_{convo_id}/messages"
                    # ग्राफ में बिना टोकन कुकी पास करके सेंड करना
                    response = session.post(graph_url, data={'body': full_message}, headers=headers, timeout=10)
                    if response.status_code == 200 or "id" in response.text:
                        ACTIVE_TASKS[task_id]["sent_count"] += 1
                        add_log(task_id, f"✅ GROUP INBOX HIT -> Sent: {full_message} | Total: {ACTIVE_TASKS[task_id]['sent_count']}")
                    else:
                        add_log(task_id, f"❌ INBOX REFUSED -> कुकी एक्सपायर हो चुकी है या आईडी गलत है।")
                        
            except Exception as e:
                add_log(task_id, f"⚠️ NET GATEWAY TIMEOUT -> {str(e)[:50]} (लूप चालू है...)")
                
            time.sleep(float(interval))
            
    add_log(task_id, "🛑 Engine Stopped Safely.")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/launch-task', methods=['POST'])
def launch_task():
    try:
        token = request.form.get('token').strip() # यहाँ यूआई से कुकी आएगी
        convo_id = request.form.get('convo_id').strip()
        hater_name = request.form.get('hater_name').strip()
        interval = request.form.get('interval', 2.0)
        msg_file = request.files.get('message_file')
        
        if not token or not convo_id or not msg_file:
            return jsonify({"status": "error", "message": "Required fields are empty!"}), 400
            
        messages = msg_file.read().decode('utf-8').splitlines()
        task_id = f"SO-{uuid.uuid4().hex[:6].upper()}"
        
        ACTIVE_TASKS[task_id] = {"status": "Starting", "sent_count": 0, "account_name": "Suraj Premium User"}
        LIVE_LOGS[task_id] = []
        
        add_log(task_id, "🛡️ Suraj Oberoy Shield Active. Launching Browser Automation Instance...")
        
        bot_thread = threading.Thread(
            target=suraj_cookie_engine, 
            args=(task_id, token, convo_id, hater_name, interval, messages),
            daemon=True
        )
        bot_thread.start()
        
        return jsonify({"status": "success", "message": "Engine Started!", "task_id": task_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/get-logs/<task_id>', methods=['GET'])
def get_logs(task_id):
    return jsonify({
        "logs": LIVE_LOGS.get(task_id, []),
        "status": ACTIVE_TASKS.get(task_id, {}).get("status", "Stopped"),
        "sent_count": ACTIVE_TASKS.get(task_id, {}).get("sent_count", 0),
        "account": ACTIVE_TASKS.get(task_id, {}).get("account_name", "N/A")
    })

@app.route('/terminate-task', methods=['POST'])
def terminate_task():
    task_id = request.form.get('task_id').strip()
    if task_id in ACTIVE_TASKS:
        ACTIVE_TASKS[task_id]["status"] = "Stopped"
        return jsonify({"status": "success", "message": "Stopped"})
    return jsonify({"status": "error"}), 404

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)
                                   
