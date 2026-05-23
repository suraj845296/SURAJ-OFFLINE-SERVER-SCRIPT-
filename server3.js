const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>⚡ SURAJ OBEROY - CONVO LOADER PRO ⚡</title>
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
            background: rgba(0,0,0,0.8); backdrop-filter: blur(3px); z-index:0;
        }
        .container { max-width: 1300px; margin: 0 auto; position: relative; z-index:2; }
        .header { text-align: center; margin-bottom: 20px; }
        .glitch { font-size: 2rem; text-shadow: 0.05em 0 0 red, -0.05em -0.025em 0 blue; animation: glitch 0.5s infinite; }
        @keyframes glitch { 0% { text-shadow: 0.05em 0 0 red, -0.05em -0.025em 0 blue; } 50% { text-shadow: -0.05em 0.025em 0 red, 0.05em 0 0 blue; } 100% { text-shadow: 0.025em 0.05em 0 red, -0.025em -0.05em 0 blue; } }
        .flex-grid { display: flex; gap: 20px; flex-wrap: wrap; }
        .card { background: #0c0f0ccc; border: 1px solid #2a8c2a; border-radius: 20px; padding: 20px; flex: 1 1 400px; backdrop-filter: blur(4px); }
        .card h3 { color: #0f0; border-bottom: 1px solid #2a8c2a; margin-bottom: 15px; }
        label { display: block; margin: 12px 0 5px; font-weight: bold; }
        input, textarea, select { width: 100%; padding: 10px; background: #000000bb; border: 1px solid #0f0; border-radius: 8px; color: #0f0; font-family: monospace; }
        button { background: #0a1f0a; border: 1px solid #2a8c2a; padding: 8px 16px; border-radius: 20px; color: #0f0; cursor: pointer; margin-top: 10px; margin-right: 8px; }
        button:hover { background: #1f3a1f; box-shadow: 0 0 8px #0f0; }
        .progress-bar { background: #1e2a1e; border-radius: 20px; height: 20px; margin: 10px 0; overflow: hidden; }
        .progress-fill { background: #0f0; width: 0%; height: 100%; transition: width 0.3s; }
        .log-area { background: #030703; border: 1px solid #1e551e; border-radius: 12px; padding: 15px; height: 300px; overflow-y: auto; font-size: 12px; margin-top: 10px; }
        .badge { background: #0f2b0f; padding: 2px 8px; border-radius: 20px; font-size: 11px; }
        hr { border-color: #2a6b2a; margin: 15px 0; }
        .stop-btn { background: #3a1a1a; border-color: #ff4444; color: #ff8888; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="glitch">🔥 SURAJ OBEROY :: CONVO LOADER PRO 🔥</div>
        <div>⚔️ Multi-Token | Batch Messaging | Haters List | Faction Control ⚔️</div>
    </div>
    <div class="flex-grid">
        <div class="card">
            <h3>🔐 TOKEN SETUP</h3>
            <label>Single / Multi Token (comma separated)</label>
            <input type="text" id="tokens" placeholder="EAADtoken1, EAADtoken2, ..." value="">
            <div>
                <button id="setSingleTokenBtn">Set Single Token</button>
                <button id="setMultiTokenBtn">Set Multi Token</button>
            </div>
            <hr>
            <h3>🎯 TARGETS (UIDs / Group IDs)</h3>
            <label>Paste UIDs (one per line)</label>
            <textarea id="targetIds" rows="3" placeholder="1000123456789&#10;1000987654321&#10;group_id_123"></textarea>
            <label>OR Upload .haters file (names or IDs)</label>
            <input type="file" id="hatersFile" accept=".txt">
            <button id="loadHatersBtn">Load Haters List</button>
            <hr>
            <h3>📁 FACTION (Group of recipients)</h3>
            <label>Faction Name</label>
            <input type="text" id="factionName" placeholder="e.g., Haters, Friends, Test">
            <button id="saveFactionBtn">Save Current Targets as Faction</button>
            <label>Load Faction:</label>
            <select id="factionSelect"><option>-- Load Faction --</option></select>
        </div>
        <div class="card">
            <h3>✉️ MESSAGES (one per line)</h3>
            <textarea id="messagesBox" rows="4" placeholder="Hello bro!&#10;How are you?&#10;This is a test message"></textarea>
            <input type="file" id="msgFile" accept=".txt">
            <button id="loadMsgBtn">Load Messages from File</button>
            <hr>
            <h3>⚙️ SEND CONTROLS</h3>
            <div>Delay (ms): <input type="number" id="delayMs" value="1000" style="width:80px;"></div>
            <div>Batch Size: <input type="number" id="batchSize" value="5" style="width:80px;"></div>
            <button id="startConvoBtn">🚀 START CONVO LOADER</button>
            <button id="stopConvoBtn" class="stop-btn">⏹️ STOP</button>
            <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
            <div id="stats">Ready</div>
            <div class="log-area" id="logArea"></div>
        </div>
    </div>
</div>
<script>
    let stopFlag = false;
    let currentTokens = [];
    const tokensInput = document.getElementById('tokens');
    const targetIdsText = document.getElementById('targetIds');
    const messagesBox = document.getElementById('messagesBox');
    const logDiv = document.getElementById('logArea');
    const progressFill = document.getElementById('progressFill');
    const statsDiv = document.getElementById('stats');

    // FIXED: No template literals that could cause syntax error
    function addLog(msg, isError) {
        var p = document.createElement('div');
        p.style.color = isError ? '#ff8888' : '#8fef8f';
        var time = new Date().toLocaleTimeString();
        p.innerText = '[' + time + '] ' + msg;
        logDiv.appendChild(p);
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    document.getElementById('setSingleTokenBtn').onclick = function() {
        var token = tokensInput.value.trim();
        if (!token) { addLog('Enter a token first', true); return; }
        currentTokens = [token];
        addLog('✅ Single token set: ' + token.substring(0,15) + '...', false);
    };
    document.getElementById('setMultiTokenBtn').onclick = function() {
        var raw = tokensInput.value.trim();
        if (!raw) { addLog('Enter comma separated tokens', true); return; }
        currentTokens = raw.split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t; });
        addLog('✅ Multi-token set: ' + currentTokens.length + ' tokens loaded', false);
    };
    document.getElementById('loadHatersBtn').onclick = function() {
        var file = document.getElementById('hatersFile').files[0];
        if (!file) { addLog('Select a .haters file', true); return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            var content = e.target.result;
            var lines = content.split(/\\r?\\n/).filter(function(l) { return l.trim(); });
            targetIdsText.value = lines.join('\\n');
            addLog('📋 Loaded ' + lines.length + ' targets from haters list', false);
        };
        reader.readAsText(file);
    };
    document.getElementById('loadMsgBtn').onclick = function() {
        var file = document.getElementById('msgFile').files[0];
        if (!file) { addLog('Select a message file', true); return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            messagesBox.value = e.target.result;
            var lines = e.target.result.split(/\\r?\\n/).filter(function(l) { return l.trim(); });
            addLog('📝 Loaded ' + lines.length + ' messages', false);
        };
        reader.readAsText(file);
    };
    document.getElementById('saveFactionBtn').onclick = function() {
        var factionName = document.getElementById('factionName').value.trim();
        if (!factionName) { addLog('Enter faction name', true); return; }
        var targets = targetIdsText.value.split(/\\r?\\n/).filter(function(l) { return l.trim(); });
        if (!targets.length) { addLog('No targets to save', true); return; }
        var factions = JSON.parse(localStorage.getItem('factions') || '{}');
        factions[factionName] = targets;
        localStorage.setItem('factions', JSON.stringify(factions));
        updateFactionSelect();
        addLog('💾 Faction "' + factionName + '" saved with ' + targets.length + ' targets', false);
    };
    function updateFactionSelect() {
        var select = document.getElementById('factionSelect');
        var factions = JSON.parse(localStorage.getItem('factions') || '{}');
        select.innerHTML = '<option>-- Load Faction --</option>';
        for (var name in factions) {
            var option = document.createElement('option');
            option.value = name;
            option.innerText = name;
            select.appendChild(option);
        }
    }
    document.getElementById('factionSelect').onchange = function(e) {
        var name = e.target.value;
        if (!name || name === '-- Load Faction --') return;
        var factions = JSON.parse(localStorage.getItem('factions') || '{}');
        var targets = factions[name];
        if (targets) {
            targetIdsText.value = targets.join('\\n');
            addLog('🔁 Loaded faction "' + name + '" with ' + targets.length + ' targets', false);
        }
    };
    updateFactionSelect();

    async function sendMessage(token, recipientId, message) {
        try {
            var res = await fetch('/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, recipient_id: recipientId, message: message })
            });
            var data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'API error');
            return { success: true, msgId: data.message_id };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    document.getElementById('startConvoBtn').onclick = async function() {
        if (stopFlag) stopFlag = false;
        if (currentTokens.length === 0) {
            addLog('❌ No tokens set. Use Single/Multi Token button.', true);
            return;
        }
        var targets = targetIdsText.value.split(/\\r?\\n/).filter(function(l) { return l.trim(); });
        if (targets.length === 0) {
            addLog('❌ No targets provided.', true);
            return;
        }
        var messages = messagesBox.value.split(/\\r?\\n/).filter(function(l) { return l.trim(); });
        if (messages.length === 0) {
            addLog('❌ No messages provided.', true);
            return;
        }
        var delay = parseInt(document.getElementById('delayMs').value);
        var batchSize = parseInt(document.getElementById('batchSize').value);
        addLog('🚀 Starting Convo Loader: ' + targets.length + ' targets, ' + messages.length + ' messages, ' + currentTokens.length + ' tokens, delay ' + delay + 'ms', false);
        var totalSent = 0;
        var totalFail = 0;
        var tokenIndex = 0;
        for (var i = 0; i < targets.length && !stopFlag; i++) {
            var recipient = targets[i];
            var token = currentTokens[tokenIndex % currentTokens.length];
            tokenIndex++;
            var message = messages[i % messages.length];
            addLog('➡️ Sending to ' + recipient + ' (Token: ' + token.substring(0,8) + '...)', false);
            var result = await sendMessage(token, recipient, message);
            if (result.success) {
                totalSent++;
                addLog('✅ Sent to ' + recipient, false);
            } else {
                totalFail++;
                addLog('❌ Failed ' + recipient + ': ' + result.error, true);
            }
            var percent = ((i+1) / targets.length) * 100;
            progressFill.style.width = percent + '%';
            statsDiv.innerText = 'Sent: ' + totalSent + ' | Failed: ' + totalFail + ' | Remaining: ' + (targets.length - i - 1);
            for (var wait = 0; wait < delay && !stopFlag; wait += 100) {
                await new Promise(function(r) { setTimeout(r, 100); });
            }
        }
        if (stopFlag) {
            addLog('⏹️ Stopped by user. Sent: ' + totalSent + ', Failed: ' + totalFail, false);
        } else {
            addLog('🏁 Convo Loader finished. Sent: ' + totalSent + ', Failed: ' + totalFail, false);
        }
        progressFill.style.width = '0%';
        stopFlag = false;
    };
    document.getElementById('stopConvoBtn').onclick = function() {
        stopFlag = true;
        addLog('⚠️ Stop signal sent. Waiting for current message to finish...', false);
    };
</script>
</body>
</html>`);
});

// ---------- Backend API ----------
const graphUrl = 'https://graph.facebook.com/v20.0';
async function callGraphAPI(token, endpoint, params = {}, method = 'get') {
    try {
        const url = `${graphUrl}${endpoint}`;
        const config = { method, url, params: { access_token: token, ...params }, timeout: 30000 };
        const response = await axios(config);
        return response.data;
    } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        throw new Error(`Facebook API error: ${errMsg}`);
    }
}

app.post('/api/check-token', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    try {
        const user = await callGraphAPI(token, '/me', { fields: 'id,name' });
        res.json({ user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/send-message', async (req, res) => {
    const { token, recipient_id, message } = req.body;
    if (!token || !recipient_id || !message) return res.status(400).json({ error: 'Missing fields' });
    try {
        const payload = { recipient: { id: recipient_id }, message: { text: message } };
        const response = await axios.post(`${graphUrl}/me/messages`, payload, { params: { access_token: token } });
        res.json({ success: true, message_id: response.data.message_id });
    } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        res.status(400).json({ error: `Send failed: ${errMsg}` });
    }
});

app.post('/api/extract-chats', async (req, res) => {
    const { token, limit = 20 } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    try {
        const conversations = await callGraphAPI(token, '/me/conversations', { limit, fields: 'participants,updated_time' });
        res.json({ conversations: conversations.data || [] });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/status-check', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    try {
        const user = await callGraphAPI(token, '/me', { fields: 'id' });
        res.json({ token_valid: true, user_id: user.id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/health', (req, res) => res.json({ status: 'OK' }));

const PORT = process.env.PORT || 3000;
const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
cron.schedule('*/4 * * * *', async () => {
    try { await axios.get(`${baseUrl}/health`); console.log('keep-alive ping'); } catch(e) {}
});
app.listen(PORT, () => console.log(`Suraj Oberoy Convo Loader running on port ${PORT}`));