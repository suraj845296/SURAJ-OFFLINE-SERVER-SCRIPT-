const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const upload = multer({ storage: multer.memoryStorage() });

let activeTasks = new Map();
let currentTaskId = null;

async function sendMessage(token, recipientId, message) {
    try {
        const response = await axios.post('https://graph.facebook.com/v20.0/me/messages',
            { recipient: { id: recipientId }, message: { text: message } },
            { params: { access_token: token } }
        );
        return { success: true, messageId: response.data.message_id };
    } catch (err) {
        const errorMsg = err.response?.data?.error?.message || err.message;
        return { success: false, error: errorMsg };
    }
}

async function validateToken(token) {
    try {
        const { data } = await axios.get('https://graph.facebook.com/v20.0/me', {
            params: { access_token: token, fields: 'id,name' }
        });
        return { valid: true, name: data.name, id: data.id };
    } catch (err) {
        return { valid: false, error: err.response?.data?.error?.message || err.message };
    }
}

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>⚡ SURAJ OBEROY :: HACKER TASK CONTROLLER ⚡</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #000;
            font-family: 'Share Tech Mono', monospace;
            min-height: 100vh;
            padding: 20px;
            color: #0f0;
            position: relative;
            overflow-x: hidden;
        }
        body::before {
            content: "";
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: repeating-linear-gradient(0deg, rgba(0,255,0,0.03) 0px, rgba(0,255,0,0.03) 2px, transparent 2px, transparent 8px);
            pointer-events: none;
            z-index: 1;
        }
        body::after {
            content: "";
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-image: url('https://images.pexels.com/photos/1165982/pexels-photo-1165982.jpeg?auto=compress&cs=tinysrgb&w=1600');
            background-size: cover;
            background-position: center;
            opacity: 0.15;
            z-index: 0;
            pointer-events: none;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            position: relative;
            z-index: 2;
        }
        .card {
            background: rgba(10, 20, 10, 0.85);
            backdrop-filter: blur(5px);
            border: 1px solid #2a8c2a;
            border-radius: 24px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 0 20px rgba(0,255,0,0.2), inset 0 0 10px rgba(0,255,0,0.05);
            transition: 0.3s;
        }
        .glitch {
            font-size: 2.2rem;
            font-weight: bold;
            text-align: center;
            color: #0f0;
            text-shadow: 0.05em 0 0 rgba(255,0,0,0.5), -0.05em -0.025em 0 rgba(0,255,255,0.5);
            animation: glitch 0.3s infinite;
            letter-spacing: 2px;
            margin-bottom: 10px;
        }
        @keyframes glitch {
            0% { text-shadow: 0.05em 0 0 rgba(255,0,0,0.5), -0.05em -0.025em 0 rgba(0,255,255,0.5); }
            50% { text-shadow: -0.05em 0.025em 0 rgba(255,0,0,0.5), 0.05em 0 0 rgba(0,255,255,0.5); }
            100% { text-shadow: 0.025em 0.05em 0 rgba(255,0,0,0.5), -0.025em -0.05em 0 rgba(0,255,255,0.5); }
        }
        .sub {
            text-align: center;
            color: #8bc34a;
            border-bottom: 1px dashed #2a6b2a;
            padding-bottom: 8px;
            margin-bottom: 20px;
            font-size: 0.9rem;
        }
        label {
            display: block;
            margin: 15px 0 5px;
            font-weight: bold;
            color: #9eff9e;
            letter-spacing: 1px;
        }
        input, textarea, select {
            width: 100%;
            padding: 12px;
            background: #000000cc;
            border: 1px solid #2a8c2a;
            border-radius: 12px;
            color: #0f0;
            font-family: 'Share Tech Mono', monospace;
            font-size: 14px;
            outline: none;
            transition: 0.2s;
            box-shadow: inset 0 0 5px rgba(0,255,0,0.2);
        }
        input:focus, textarea:focus, select:focus {
            border-color: #0f0;
            box-shadow: 0 0 12px #0f0, inset 0 0 3px #0f0;
        }
        button {
            background: #0a1f0a;
            border: 1px solid #2a8c2a;
            padding: 10px 20px;
            border-radius: 40px;
            color: #0f0;
            font-family: monospace;
            font-weight: bold;
            cursor: pointer;
            margin-top: 12px;
            margin-right: 12px;
            transition: 0.2s;
            font-size: 13px;
            box-shadow: 0 0 3px #0f0;
        }
        button:hover {
            background: #1f3a1f;
            box-shadow: 0 0 12px #0f0;
            transform: scale(1.02);
            border-color: #0f0;
        }
        .stop-btn {
            background: #2a0a0a;
            border-color: #ff4444;
            color: #ff8888;
            box-shadow: 0 0 3px #ff4444;
        }
        .stop-btn:hover {
            background: #3a1010;
            box-shadow: 0 0 12px #ff4444;
        }
        .file-label {
            background: #0a1f0a;
            display: inline-block;
            padding: 10px 18px;
            border-radius: 40px;
            cursor: pointer;
            border: 1px solid #2a8c2a;
            margin: 5px 0;
        }
        input[type="file"] { display: none; }
        .log-area {
            background: #030703dd;
            border: 1px solid #1e551e;
            border-radius: 16px;
            padding: 15px;
            height: 260px;
            overflow-y: auto;
            font-size: 12px;
            margin-top: 15px;
            font-family: monospace;
            box-shadow: inset 0 0 10px rgba(0,50,0,0.5);
        }
        .task-info {
            background: #0a1a0a;
            padding: 12px;
            border-radius: 16px;
            margin-top: 15px;
            border-left: 4px solid #0f0;
            font-size: 13px;
        }
        .task-id {
            font-family: monospace;
            background: #000;
            padding: 4px 10px;
            border-radius: 20px;
            color: #ffaa44;
            border: 1px solid #ffaa44;
        }
        hr {
            border-color: #2a6b2a;
            margin: 20px 0;
        }
        .blink {
            animation: blink 1s step-start infinite;
        }
        @keyframes blink {
            50% { opacity: 0.5; }
        }
        ::-webkit-scrollbar {
            width: 8px;
            background: #0a1f0a;
        }
        ::-webkit-scrollbar-thumb {
            background: #0f0;
            border-radius: 10px;
        }
        @media (max-width: 650px) {
            .glitch { font-size: 1.4rem; }
            button { width: 100%; margin-bottom: 8px; }
        }
    </style>
</head>
<body>
<div class="container">
    <div class="card">
        <div class="glitch">#!// SURAJ OBEROY // TASK CONTROLLER // HACKER EDITION</div>
        <div class="sub"><span class="blink">●</span> [ROOT ACCESS] :: MESSAGE BOT v2.0 <span class="blink">●</span></div>

        <label>> TOKEN_MODE</label>
        <select id="tokenMode"><option value="single">Single Token</option></select>

        <label>> ACCESS_TOKEN</label>
        <input type="text" id="accessToken" placeholder="EAAD... / EAAA... (paste token)">

        <label>> TARGET_UID (inbox/convo)</label>
        <input type="text" id="threadUid" placeholder="Enter user/page ID">

        <label>> HATER_PREFIX</label>
        <input type="text" id="haterName" placeholder="Optional: prefix each message">

        <label>> INTERVAL (seconds)</label>
        <input type="number" id="intervalSec" value="1.5" step="0.5">

        <label>> MESSAGE_FILE (NP_FILE)</label>
        <div>
            <input type="file" id="messageFile" accept=".txt">
            <button id="uploadMsgBtn" class="file-label">📂 LOAD MESSAGES</button>
        </div>
        <textarea id="messagesBox" rows="4" placeholder="Messages (one per line) will appear here"></textarea>

        <button id="launchBtn">⚡ LAUNCH TASK</button>
        <div id="launchResult" style="margin-top:10px;"></div>

        <div id="activeTaskDiv" class="task-info" style="display:none;">
            🟢 <strong>ACTIVE TASK_ID:</strong> <span id="activeTaskId" class="task-id">-</span>
        </div>

        <div id="taskLog" class="log-area">[>] SYSTEM READY. Initialize token & target.</div>
    </div>

    <div class="card">
        <div class="glitch">⏹️ TERMINATE TASK</div>
        <button id="stopCurrentBtn" class="stop-btn" style="width:100%;">🛑 STOP CURRENT TASK</button>
        <hr>
        <label>> MANUAL_TASK_ID</label>
        <input type="text" id="stopTaskId" placeholder="Paste task ID here">
        <button id="stopByIdBtn" class="stop-btn">❌ TERMINATE BY ID</button>
        <div id="stopResult" style="margin-top:10px;"></div>
    </div>
</div>

<script>
    let currentTaskId = null;
    const logDiv = document.getElementById('taskLog');
    function addLog(msg, isError) {
        const p = document.createElement('div');
        p.style.color = isError ? '#ff8888' : '#8fef8f';
        const time = new Date().toLocaleTimeString();
        p.innerText = '[' + time + '] ' + msg;
        logDiv.appendChild(p);
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    document.getElementById('uploadMsgBtn').onclick = () => {
        const file = document.getElementById('messageFile').files[0];
        if (!file) { addLog('[!] Select a .txt message file', true); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('messagesBox').value = e.target.result;
            const lines = e.target.result.split(/\\r?\\n/).filter(l => l.trim());
            addLog('[+] Loaded ' + lines.length + ' messages from file', false);
        };
        reader.readAsText(file);
    };

    document.getElementById('launchBtn').onclick = async () => {
        const token = document.getElementById('accessToken').value.trim();
        const threadId = document.getElementById('threadUid').value.trim();
        const haterName = document.getElementById('haterName').value.trim();
        const interval = parseFloat(document.getElementById('intervalSec').value);
        const messagesText = document.getElementById('messagesBox').value;
        const messages = messagesText.split(/\\r?\\n/).filter(m => m.trim());
        if (!token) { addLog('[!] Access token missing', true); return; }
        if (!threadId) { addLog('[!] Target UID missing', true); return; }
        if (messages.length === 0) { addLog('[!] No messages provided', true); return; }
        if (isNaN(interval) || interval < 0.5) { addLog('[!] Interval must be ≥0.5 seconds', true); return; }

        addLog('[*] Validating token...');
        try {
            const checkRes = await fetch('/api/validate-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const checkData = await checkRes.json();
            if (!checkRes.ok) throw new Error(checkData.error);
            addLog('[+] Token valid: ' + checkData.name + ' (ID: ' + checkData.id + ')', false);
        } catch(err) {
            addLog('[X] Invalid token: ' + err.message, true);
            return;
        }

        addLog('[*] Launching task to ' + threadId + ' (' + messages.length + ' msgs, interval ' + interval + 's)');
        const launchRes = await fetch('/api/launch-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, threadId, haterName, interval, messages })
        });
        const launchData = await launchRes.json();
        if (!launchRes.ok) {
            addLog('[X] Launch failed: ' + launchData.error, true);
            return;
        }
        currentTaskId = launchData.taskId;
        document.getElementById('activeTaskDiv').style.display = 'block';
        document.getElementById('activeTaskId').innerText = currentTaskId;
        document.getElementById('launchResult').innerHTML = '[+] Task ID: <span class="task-id">' + currentTaskId + '</span>';
        addLog('[+] Task started. ID: ' + currentTaskId, false);
    };

    document.getElementById('stopCurrentBtn').onclick = async () => {
        if (!currentTaskId) { addLog('[!] No active task', true); return; }
        const res = await fetch('/api/stop-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: currentTaskId })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('stopResult').innerHTML = '[+] ' + data.message;
            addLog('[X] Current task ' + currentTaskId + ' terminated', false);
            currentTaskId = null;
            document.getElementById('activeTaskDiv').style.display = 'none';
        } else {
            document.getElementById('stopResult').innerHTML = '[X] ' + data.error;
            addLog('[X] Stop failed: ' + data.error, true);
        }
    };

    document.getElementById('stopByIdBtn').onclick = async () => {
        const taskId = document.getElementById('stopTaskId').value.trim();
        if (!taskId) { addLog('[!] Enter task ID', true); return; }
        const res = await fetch('/api/stop-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('stopResult').innerHTML = '[+] ' + data.message;
            addLog('[X] Task ' + taskId + ' terminated', false);
            if (currentTaskId === taskId) {
                currentTaskId = null;
                document.getElementById('activeTaskDiv').style.display = 'none';
            }
        } else {
            document.getElementById('stopResult').innerHTML = '[X] ' + data.error;
            addLog('[X] Stop failed: ' + data.error, true);
        }
    };
</script>
</body>
</html>`);
});

app.post('/api/validate-token', async (req, res) => {
    const { token } = req.body;
    const result = await validateToken(token);
    if (result.valid) res.json({ name: result.name, id: result.id });
    else res.status(400).json({ error: result.error });
});

app.post('/api/launch-task', async (req, res) => {
    const { token, threadId, haterName, interval, messages } = req.body;
    if (!token || !threadId || !messages || !interval) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    const taskId = uuidv4();
    let messageIndex = 0;
    let stopFlag = false;
    const intervalId = setInterval(async () => {
        if (stopFlag) {
            clearInterval(intervalId);
            activeTasks.delete(taskId);
            return;
        }
        if (messageIndex >= messages.length) {
            clearInterval(intervalId);
            activeTasks.delete(taskId);
            return;
        }
        let msg = messages[messageIndex];
        if (haterName && haterName.trim()) msg = haterName.trim() + ' ' + msg;
        await sendMessage(token, threadId, msg);
        messageIndex++;
    }, interval * 1000);
    activeTasks.set(taskId, { stopFlag, intervalId });
    res.json({ taskId });
});

app.post('/api/stop-task', (req, res) => {
    const { taskId } = req.body;
    const task = activeTasks.get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.stopFlag = true;
    res.json({ message: 'Task ' + taskId + ' terminated' });
});

app.get('/health', (req, res) => res.json({ status: 'OK' }));
const PORT = process.env.PORT || 3000;
const baseUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;
cron.schedule('*/4 * * * *', async () => {
    try { await axios.get(baseUrl + '/health'); console.log('keep-alive ping'); } catch(e) {}
});
app.listen(PORT, () => console.log('🔥 HACKER TASK CONTROLLER running on port ' + PORT));