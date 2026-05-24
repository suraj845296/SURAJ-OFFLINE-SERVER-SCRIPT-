import os
import time
import threading
import uuid
from flask import Flask, render_template, request, jsonify
import requests
import re

app = Flask(__name__)
app.secret_key = "Suraj_Oberoy_Ultra_Secure_Bot_Key_2026"

ACTIVE_TASKS = {}
LIVE_LOGS = {}

def check_fb_token(token):
    try:
        url = f"https://graph.facebook.com/me?access_token={token}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return {"valid": True, "name": response.json().get("name", "Facebook User")}
        return {"valid": True, "name": "Suraj User"}
    except Exception:
        return {"valid": True, "name": "Bypass Active"}

def add_log(task_id, message):
    if task_id not in LIVE_LOGS:
        LIVE_LOGS[task_id] = []
    timestamp = time.strftime("%H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    LIVE_LOGS[task_id].append(log_entry)

def suraj_message_engine(task_id, token, convo_id, hater_name, interval, messages):
    ACTIVE_TASKS[task_id]["status"] = "Running"
    add_log(task_id, "🚀 Suraj Oberoy Mobile-Gateway Engine Started.")
    
    # ब्राउज़र हेडर्स ताकि फेसबुक को लगे कि आप फोन से मैन्युअली मैसेज टाइप कर रहे हैं
    headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/16.0 Chrome/92.0.4515.166 Mobile Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive',
    }
    
    while ACTIVE_TASKS.get(task_id, {}).get("status") == "Running":
        for msg in messages:
            if ACTIVE_TASKS.get(task_id, {}).get("status") != "Running":
                break
                
            if not msg.strip():
                continue

            full_message = f"{hater_name} {msg.strip()}" if hater_name else msg.strip()
            success = False

            # --- बाईपास गेटवे 1: डायरेक्ट मैसेंजर सेंड (बिना /me के ताकि ग्रुप ब्लॉक न करे) ---
            try:
                # यह वही एंडपॉइंट है जो पुराने सर्वर्स इस्तेमाल करते हैं
                url = f"https://graph.facebook.com/v17.0/t_{convo_id}/messages"
                payload = {
                    'body': full_message,
                    'access_token': token
                }
                response = requests.post(url, data=payload, headers=headers, timeout=10)
                if response.status_code == 200 or "id" in response.text:
                    success = True
            except Exception:
                pass

            # --- बाईपास गेटवे 2: मोबाइल एम-बेसिक सिमुलेशन एंडपॉइंट ---
            if not success:
                try:
                    url = f"https://graph.facebook.com/v17.0/{convo_id}/comments"
                    payload = {
                        'message': full_message,
                        'access_token': token
                    }
                    response = requests.post(url, data=payload, headers=headers, timeout=10)
                    if response.status_code == 200:
                        success = True
                except Exception:
                    pass

            if success:
                ACTIVE_TASKS[task_id]["sent_count"] += 1
                add_log(task_id, f"✅ SUCCESS -> Sent: {full_message} | Total: {ACTIVE_TASKS[task_id]['sent_count']}")
            else:
                add_log(task_id, f"❌ GATEWAY BLOCKED -> फेसबुक सिक्योरिटी ने रोका। कंवो आईडी बदलें या नया टोकन लगाएं।")
                
            time.sleep(float(interval))
            
    add_log(task_id, "🛑 Engine safely stopped.")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/launch-task', methods=['POST'])
def launch_task():
    try:
        token = request.form.get('token').strip()
        convo_id = request.form.get('convo_id').strip()
        hater_name = request.form.get('hater_name').strip()
        interval = request.form.get('interval', 2.0)
        msg_file = request.files.get('message_file')
        
        token_status = check_fb_token(token)
        messages = msg_file.read().decode('utf-8').splitlines()

        task_id = f"SO-{uuid.uuid4().hex[:6].upper()}"
        ACTIVE_TASKS[task_id] = {"status": "Starting", "sent_count": 0, "account_name": token_status["name"]}
        LIVE_LOGS[task_id] = []
        
        add_log(task_id, f"🔑 System Initialized! Owner: {token_status['name']}")
        
        bot_thread = threading.Thread(
            target=suraj_message_engine, 
            args=(task_id, token, convo_id, hater_name, interval, messages),
            daemon=True
        )
        bot_thread.start()
        
        return jsonify({"status": "success", "message": "Started", "task_id": task_id})
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
