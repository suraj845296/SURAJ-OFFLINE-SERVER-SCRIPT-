import os
import time
import threading
import uuid
from flask import Flask, render_template, request, jsonify
import requests

app = Flask(__name__)
app.secret_key = "Suraj_Oberoy_Ultra_Secure_Bot_Key_2026"

ACTIVE_TASKS = {}
LIVE_LOGS = {}

def add_log(task_id, message):
    if task_id not in LIVE_LOGS:
        LIVE_LOGS[task_id] = []
    timestamp = time.strftime("%H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    LIVE_LOGS[task_id].append(log_entry)
    print(f"[{task_id}] {log_entry}")

def suraj_message_engine(task_id, token, convo_id, hater_name, interval, messages):
    """सूरज ओबेरॉय डायरेक्ट मैसेंजर गेटवे इंजन"""
    ACTIVE_TASKS[task_id]["status"] = "Running"
    add_log(task_id, "🚀 Suraj Oberoy Loader Engine Started Successfully.")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Mobile Safari/537.36',
        'Accept': '*/*',
    }
    
    while ACTIVE_TASKS.get(task_id, {}).get("status") == "Running":
        for msg in messages:
            if ACTIVE_TASKS.get(task_id, {}).get("status") != "Running":
                break
                
            if not msg.strip():
                continue

            full_message = f"{hater_name} {msg.strip()}" if hater_name else msg.strip()
            
            # डायरेक्ट कंवो थ्रेड लिंक (बिना /me के ताकि शैडो ब्लॉक न हो)
            url = f"https://graph.facebook.com/v17.0/t_{convo_id}/messages"
            payload = {
                'body': full_message,
                'access_token': token
            }
            
            try:
                response = requests.post(url, data=payload, headers=headers, timeout=10)
                
                # अगर फेसबुक 200 देता है या रिस्पॉन्स में मैसेज ID आती है
                if response.status_code == 200 or "id" in response.text:
                    ACTIVE_TASKS[task_id]["sent_count"] += 1
                    add_log(task_id, f"✅ SENT -> {full_message} | Total: {ACTIVE_TASKS[task_id]['sent_count']}")
                else:
                    # अगर फेसबुक कोई एरर दिखाता है तो वो भी कंसोल में दिखेगा
                    err_res = response.text
                    add_log(task_id, f"❌ FB REFUSED -> {err_res[:100]}")
            except Exception as e:
                add_log(task_id, f"⚠️ NET ERROR -> {str(e)}")
                
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
        
        if not token or not convo_id or not msg_file:
            return jsonify({"status": "error", "message": "Required fields are empty!"}), 400
            
        messages = msg_file.read().decode('utf-8').splitlines()
        if not messages:
            return jsonify({"status": "error", "message": "Uploaded file is empty!"}), 400

        task_id = f"SO-{uuid.uuid4().hex[:6].upper()}"
        
        # बिना किसी वेरिफिकेशन के सीधे टास्क क्रिएट करना
        ACTIVE_TASKS[task_id] = {"status": "Starting", "sent_count": 0, "account_name": "Suraj Premium User"}
        LIVE_LOGS[task_id] = []
        
        add_log(task_id, "🔑 Bypass Mode Active. Bypassing Facebook Token Verification...")
        
        bot_thread = threading.Thread(
            target=suraj_message_engine, 
            args=(task_id, token, convo_id, hater_name, interval, messages),
            daemon=True
        )
        bot_thread.start()
        
        return jsonify({
            "status": "success", 
            "message": "Engine Started!", 
            "task_id": task_id
        })
        
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
                  
