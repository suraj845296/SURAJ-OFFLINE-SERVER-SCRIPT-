import os
import time
import threading
import uuid
from flask import Flask, render_template, request, jsonify
import requests

app = Flask(__name__)
app.secret_key = "Suraj_Oberoy_Ultra_Secure_Bot_Key_2026"

# एक्टिव टास्क और लाइव लॉग्स को स्टोर करने के लिए ग्लोबल डिक्शनरी
ACTIVE_TASKS = {}
LIVE_LOGS = {}

def check_fb_token(token):
    """फेसबुक टोकन को चेक करने का सिस्टम (Live or Dead)"""
    try:
        url = f"https://graph.facebook.com/me?access_token={token}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return {"valid": True, "name": data.get("name", "Unknown Account")}
        return {"valid": False, "error": "Token expired or invalid"}
    except Exception as e:
        return {"valid": False, "error": str(e)}

def add_log(task_id, message):
    """लॉग्स को स्टोर करने का फंक्शन"""
    if task_id not in LIVE_LOGS:
        LIVE_LOGS[task_id] = []
    timestamp = time.strftime("%H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    LIVE_LOGS[task_id].append(log_entry)
    print(f"[{task_id}] {log_entry}")

def suraj_message_engine(task_id, token, convo_id, hater_name, interval, messages):
    """सूरज ओबेरॉय बोट इंजन - अपग्रेड किया हुआ वर्जन जो हर सर्वर की तरह काम करेगा"""
    ACTIVE_TASKS[task_id]["status"] = "Running"
    add_log(task_id, "🚀 Suraj Oberoy Engine Initialized Successfully.")
    
    # बाकी सर्वर्स की तरह यूनिवर्सल फेसबुक मैसेज एपीआई यूआरएल
    url = "https://graph.facebook.com/v17.0/me/messages"
    
    while ACTIVE_TASKS.get(task_id, {}).get("status") == "Running":
        for msg in messages:
            if ACTIVE_TASKS.get(task_id, {}).get("status") != "Running":
                break
                
            if not msg.strip():
                continue

            # नाम के साथ मैसेज तैयार करना
            full_message = f"{hater_name} {msg.strip()}" if hater_name else msg.strip()
            
            # यूनिवर्सल पेलोड स्ट्रक्चर जो बाकी सर्वर्स में इस्तेमाल होता है
            payload = {
                "recipient": {"id": convo_id},
                "message": {"text": full_message},
                "access_token": token
            }
            
            try:
                # डेटा भेजने के लिए json=payload का उपयोग (ताकि फेसबुक रिजेक्ट न करे)
                response = requests.post(url, json=payload, timeout=10)
                if response.status_code == 200:
                    ACTIVE_TASKS[task_id]["sent_count"] += 1
                    add_log(task_id, f"✅ SUCCESS -> Sent: {full_message} | Total: {ACTIVE_TASKS[task_id]['sent_count']}")
                else:
                    err_data = response.json()
                    err_msg = err_data.get('error', {}).get('message', 'Unknown API Error')
                    add_log(task_id, f"❌ API ERROR -> {err_msg}")
            except requests.exceptions.RequestException as e:
                add_log(task_id, f"⚠️ NETWORK ERROR -> {str(e)}")
                
            # मैसेजेस के बीच का टाइम गैप
            time.sleep(float(interval))
            
    add_log(task_id, "🛑 Task safely terminated by user.")

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
            
        token_status = check_fb_token(token)
        if not token_status["valid"]:
            return jsonify({"status": "error", "message": f"टोकन रिजेक्टेड: {token_status['error']}"}), 400
            
        messages = msg_file.read().decode('utf-8').splitlines()
        if not messages:
            return jsonify({"status": "error", "message": "Uploaded file is empty!"}), 400

        task_id = f"SO-{uuid.uuid4().hex[:6].upper()}"
        
        ACTIVE_TASKS[task_id] = {"status": "Starting", "sent_count": 0, "account_name": token_status["name"]}
        LIVE_LOGS[task_id] = []
        
        add_log(task_id, f"🔑 Token Verified! Account Owner: {token_status['name']}")
        
        bot_thread = threading.Thread(
            target=suraj_message_engine, 
            args=(task_id, token, convo_id, hater_name, interval, messages),
            daemon=True
        )
        bot_thread.start()
        
        return jsonify({
            "status": "success", 
            "message": f"बॉट चालू हो गया है! ({token_status['name']})", 
            "task_id": task_id
        })
        
    except Exception as e:
        return jsonify({"status": "error", "message": f"Server Error: {str(e)}"}), 500

@app.route('/get-logs/<task_id>', methods=['GET'])
def get_logs(task_id):
    logs = LIVE_LOGS.get(task_id, [])
    status = ACTIVE_TASKS.get(task_id, {}).get("status", "Stopped")
    sent_count = ACTIVE_TASKS.get(task_id, {}).get("sent_count", 0)
    account = ACTIVE_TASKS.get(task_id, {}).get("account_name", "N/A")
    return jsonify({"logs": logs, "status": status, "sent_count": sent_count, "account": account})

@app.route('/terminate-task', methods=['POST'])
def terminate_task():
    task_id = request.form.get('task_id').strip()
    if task_id in ACTIVE_TASKS and ACTIVE_TASKS[task_id]["status"] == "Running":
        ACTIVE_TASKS[task_id]["status"] = "Stopped"
        return jsonify({"status": "success", "message": f"Task {task_id} Stopped."})
    return jsonify({"status": "error", "message": "Invalid Task ID or already stopped."}), 404

if __name__ == '__main__':
    # Render के लिए डायनामिक पोर्ट बाइंडिंग
    port = int(os.environ.get("PORT", 8080))
    print("==================================================")
    print("      SURAJ OBEROY UNIVERSAL BOT ENGINE LIVE      ")
    print("==================================================")
    app.run(host='0.0.0.0', port=port)
  
