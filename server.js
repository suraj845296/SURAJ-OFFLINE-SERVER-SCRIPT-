const express = require('express');
const fs = require('fs');
const login = require("irfan-fca");
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let api = null;

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SURAJ OBEROY - USER TOKEN GROUP LOADER</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0f0a;
            font-family: 'Courier New', monospace;
            padding: 20px;
            color: #0f0;
            background-image: url('https://images.pexels.com/photos/1165982/pexels-photo-1165982.jpeg?auto=compress&cs=tinysrgb&w=1600');
            background-size: cover;
            background-attachment: fixed;
        }
        body::before {
            content: ""; position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.85); backdrop-filter: blur(3px); z-index:0;
        }
        .container { max-width: 1000px; margin: 0 auto; position: relative; z-index:2; }
        .card { background: #0c0f0ccc; border: 1px solid #2a8c2a; border-radius: 20px; padding: 25px; margin-bottom: 20px; backdrop-filter: blur(4px); }
        h2 { color: #0f0; text-shadow: 0 0 5px #0f0; margin-bottom: 15px; }
        h3 { color: #9fef9f; margin: 10px 0; border-left: 3px solid #0f0; padding-left: 10px; }
        label { display: block; margin: 12px 0 5px; font-weight: bold; }
        input, textarea, select { width: 100%; padding: 10px; background: #000000bb; border: 1px solid #0f0; border-radius: 8px; color: #0f0; font-family: monospace; margin: 5px 0 10px; }
        button { background: #0a1f0a; border: 1px solid #2a8c2a; padding: 10px 20px; border-radius: 20px; color: #0f0; cursor: pointer; margin-top: 10px; margin-right: 10px; }
        button:hover { background: #1f3a1f; box-shadow: 0 0 8px #0f0; }
        .log-area { background: #030703; border: 1px solid #1e551e; border-radius: 12px; padding: 15px; height: 250px; overflow-y: auto; font-size: 12px; margin-top: 15px; }
        .flex-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .info { background: #1a2a1a; padding: 10px; border-radius: 12px; margin-bottom: 15px; font-size: 12px; }
        hr { border-color: #2a6b2a; margin: 20px 0; }
        .token-result { background: #000000aa; padding: 10px; border-radius: 8px; margin-top: 10px; font-size: 12px; border-left: 3px solid #0f0; }
    </style>
</head>
<body>
<div class="container">
    <!-- Card 1: User Token Checker (New) -->
    <div class="card">
        <h2>🔐 SURAJ OBEROY - USER TOKEN CHECKER</h2>
        <div class="info">
            ✅ <strong>User Access Token</strong> (EAAD / EAAA) – Check validity, expiry, permissions.
        </div>
        <label>📌 Enter User Token:</label>
        <div class="flex-row">
            <input type="text" id="userToken" placeholder="EAAD... or EAAA..." style="flex:1;">
            <button id="checkTokenBtn">✅ Check Token</button>
        </div>
        <div id="tokenResult" class="token-result">Waiting for token input...</div>
    </div>

    <!-- Card 2: Appstate Login & Group Loader -->
    <div class="card">
        <h2>🔥 SURAJ OBEROY - USER TOKEN GROUP LOADER</h2>
        <div class="info">
            ⚠️ <strong>Appstate JSON chahiye</strong> – Browser extension se nikalein.<br>
            📌 <strong>Group Thread ID</strong> – Messenger group ke URL se milega.<br>
            📁 <strong>Messages file</strong> – Ek line mein ek message.
        </div>

        <label>📁 1. Upload Appstate JSON</label>
        <div class="flex-row">
            <input type="file" id="appstateFile" accept=".json">
            <button id="loginBtn">🔑 Login & Load Session</button>
        </div>

        <hr>

        <label>📝 2. Group Thread ID</label>
        <input type="text" id="threadId" placeholder="Messenger group thread ID (e.g., 123456789012345)">

        <label>💬 3. Messages (one per line)</label>
        <textarea id="messagesBox" rows="5" placeholder="Message 1&#10;Message 2&#10;Message 3"></textarea>
        
        <div class="flex-row">
            <input type="file" id="msgFile" accept=".txt">
            <button id="loadMsgBtn">📂 Load Messages from File</button>
        </div>

        <label>⏱️ 4. Delay (ms) between messages</label>
        <input type="number" id="delay" value="2000" step="500">

        <button id="startBtn">🚀 START BULK SEND</button>
        <button id="stopBtn" style="background:#3a1a1a; border-color:#ff4444;">⏹️ STOP</button>

        <div id="logArea" class="log-area">Ready...</div>
    </div>
</div>

<script>
    let stopFlag = false;
    const logDiv = document.getElementById('logArea');
    const messagesBox = document.getElementById('messagesBox');

    function addLog(msg, isError) {
        const p = document.createElement('div');
        p.style.color = isError ? '#ff8888' : '#8fef8f';
        const time = new Date().toLocaleTimeString();
        p.innerText = '[' + time + '] ' + msg;
        logDiv.appendChild(p);
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    // ----- Token Checker -----
    document.getElementById('checkTokenBtn').onclick = async () => {
        const token = document.getElementById('userToken').value.trim();
        const resultDiv = document.getElementById('tokenResult');
        if (!token) {
            resultDiv.innerHTML = '❌ Please enter a user token.';
            resultDiv.style.borderColor = '#ff4444';
            return;
        }
        resultDiv.innerHTML = '🔄 Checking token...';
        resultDiv.style.borderColor = '#0f0';
        try {
            const res = await fetch('/api/check-user-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            let expiryInfo = data.expires_at ? new Date(data.expires_at).toLocaleString() : 'Long-lived (no expiry)';
            let perms = data.permissions ? data.permissions.join(', ') : 'Not available';
            resultDiv.innerHTML = \`
                ✅ <strong>Token is valid!</strong><br>
                👤 User: \${data.name} (ID: \${data.id})<br>
                📅 Expires: \${expiryInfo}<br>
                🔑 Scopes: \${perms}<br>
                🔧 Token type: \${data.token_type || 'User Access Token'}
            \`;
            resultDiv.style.borderColor = '#0f0';
        } catch (err) {
            resultDiv.innerHTML = '❌ Invalid token: ' + err.message;
            resultDiv.style.borderColor = '#ff4444';
        }
    };

    // ----- Load messages from file -----
    document.getElementById('loadMsgBtn').onclick = () => {
        const file = document.getElementById('msgFile').files[0];
        if (!file) { addLog('Select a message file (.txt)', true); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            messagesBox.value = content;
            const lines = content.split(/\\r?\\n/).filter(l => l.trim());
            addLog('📝 Loaded ' + lines.length + ' messages from file', false);
        };
        reader.readAsText(file);
    };

    // ----- Login with appstate -----
    document.getElementById('loginBtn').onclick = async () => {
        const file = document.getElementById('appstateFile').files[0];
        if (!file) { addLog('Select appstate.json file', true); return; }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const appstate = JSON.parse(e.target.result);
                addLog('🔐 Logging in...');
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appstate })
                });
                const data = await res.json();
                if (data.success) addLog('✅ Login successful! Ready to send.', false);
                else addLog('❌ Login failed: ' + data.error, true);
            } catch(err) {
                addLog('❌ Invalid appstate JSON', true);
            }
        };
        reader.readAsText(file);
    };

    // ----- Send messages in bulk -----
    let sendingActive = false;
    document.getElementById('startBtn').onclick = async () => {
        if (sendingActive) { addLog('Already sending...', true); return; }
        stopFlag = false;
        sendingActive = true;
        const threadId = document.getElementById('threadId').value.trim();
        const messages = messagesBox.value.split(/\\r?\\n/).filter(m => m.trim());
        const delay = parseInt(document.getElementById('delay').value);
        if (!threadId) { addLog('Group Thread ID required', true); sendingActive = false; return; }
        if (messages.length === 0) { addLog('No messages to send', true); sendingActive = false; return; }
        addLog('🚀 Starting bulk send to thread ' + threadId + ' (' + messages.length + ' messages)', false);
        let sent = 0, failed = 0;
        for (let i = 0; i < messages.length && !stopFlag; i++) {
            const msg = messages[i];
            addLog('➡️ Sending: ' + msg.substring(0, 50), false);
            try {
                const res = await fetch('/api/send-group-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ threadId, message: msg })
                });
                const data = await res.json();
                if (data.success) {
                    sent++;
                    addLog('✅ Sent: ' + msg.substring(0, 50), false);
                } else {
                    failed++;
                    addLog('❌ Failed: ' + msg.substring(0, 50) + ' - ' + data.error, true);
                }
            } catch(err) {
                failed++;
                addLog('❌ Network error: ' + err.message, true);
            }
            if (delay > 0 && i < messages.length - 1 && !stopFlag) {
                await new Promise(r => setTimeout(r, delay));
            }
        }
        if (stopFlag) addLog('⏹️ Stopped by user', false);
        else addLog('🏁 Finished. Sent: ' + sent + ', Failed: ' + failed, false);
        sendingActive = false;
    };

    document.getElementById('stopBtn').onclick = () => {
        stopFlag = true;
        addLog('⚠️ Stop signal sent. Will stop after current message.', false);
    };
</script>
</body>
</html>`);
});

// ---------- BACKEND APIs ----------

// 1. Check User Token (via Graph API)
app.post('/api/check-user-token', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    try {
        // Get user info
        const userRes = await axios.get('https://graph.facebook.com/v20.0/me', {
            params: { access_token: token, fields: 'id,name,email' }
        });
        // Get token debug info
        let debugInfo = {};
        let permissions = [];
        try {
            const debugRes = await axios.get('https://graph.facebook.com/v20.0/debug_token', {
                params: { input_token: token, access_token: token }
            });
            debugInfo = debugRes.data.data;
            permissions = debugInfo.scopes || [];
        } catch(e) {}
        res.json({
            id: userRes.data.id,
            name: userRes.data.name,
            email: userRes.data.email || 'N/A',
            expires_at: debugInfo.expires_at ? debugInfo.expires_at * 1000 : null,
            token_type: debugInfo.type || 'User',
            permissions: permissions
        });
    } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        res.status(400).json({ error: errMsg });
    }
});

// 2. Login with appstate (irfan-fca)
app.post('/api/login', (req, res) => {
    const { appstate } = req.body;
    if (!appstate) return res.status(400).json({ error: 'No appstate provided' });
    login({ appState: appstate }, (err, apiObj) => {
        if (err) return res.status(500).json({ error: err.toString() });
        api = apiObj;
        res.json({ success: true });
    });
});

// 3. Send message to group (using appstate session)
app.post('/api/send-group-message', (req, res) => {
    const { threadId, message } = req.body;
    if (!api) return res.status(400).json({ error: 'Not logged in' });
    api.sendMessage(message, threadId, (err, info) => {
        if (err) return res.status(500).json({ error: err.toString() });
        res.json({ success: true });
    });
});

// 4. Health check (for Render keep-alive)
app.get('/health', (req, res) => res.json({ status: 'OK' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔥 Suraj Oberoy User Token Loader running on port ${PORT}`));
