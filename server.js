const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });

// Ensure directories exist
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('exports')) fs.mkdirSync('exports');

let activeTasks = new Map();
let taskLogs = new Map();
let tokenList = [];
let conversations = new Map();

// ============ CORE FUNCTIONS ============

// Send message function
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

// Validate single token
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

// Get conversation from target
async function getConversation(token, userId, limit = 500) {
    try {
        const response = await axios.get(`https://graph.facebook.com/v20.0/${userId}/conversations`, {
            params: {
                access_token: token,
                fields: 'messages.limit(100){message,created_time,from,to}',
                limit: limit
            }
        });
        return { success: true, data: response.data };
    } catch (err) {
        return { success: false, error: err.response?.data?.error?.message || err.message };
    }
}

// Get user info
async function getUserInfo(token, userId) {
    try {
        const response = await axios.get(`https://graph.facebook.com/v20.0/${userId}`, {
            params: {
                access_token: token,
                fields: 'id,name,first_name,last_name'
            }
        });
        return { success: true, data: response.data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Get all messages from conversation
async function getAllMessages(token, conversationId) {
    try {
        let allMessages = [];
        let url = `https://graph.facebook.com/v20.0/${conversationId}/messages`;
        let params = {
            access_token: token,
            fields: 'message,created_time,from,id',
            limit: 200
        };
        
        let hasNext = true;
        while (hasNext) {
            const response = await axios.get(url, { params });
            if (response.data.data) {
                allMessages = allMessages.concat(response.data.data);
            }
            hasNext = response.data.paging && response.data.paging.next;
            if (hasNext) {
                url = response.data.paging.next;
                params = {};
            }
        }
        return { success: true, messages: allMessages };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Export messages to NP file
function exportToNPFile(messages, targetName, myName) {
    let npContent = '';
    let messageCount = 0;
    const sortedMessages = messages.reverse();
    
    for (const msg of sortedMessages) {
        if (msg.message && msg.message.trim()) {
            const sender = msg.from?.name || (msg.from?.id === 'me' ? myName : targetName);
            npContent += `[NP] ${sender}: ${msg.message}\n`;
            messageCount++;
        }
    }
    
    const filename = `NP_${targetName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`;
    const filepath = `./exports/${filename}`;
    fs.writeFileSync(filepath, npContent);
    return { filename, filepath, messageCount };
}

// Add log to specific task
function addTaskLog(taskId, message, type = 'info') {
    if (!taskLogs.has(taskId)) {
        taskLogs.set(taskId, []);
    }
    const logs = taskLogs.get(taskId);
    logs.push({ time: new Date().toISOString(), message: message, type: type });
    if (logs.length > 500) logs.shift();
}

// Get next token (round robin)
let tokenIndex = 0;
function getNextToken() {
    if (tokenList.length === 0) return null;
    const token = tokenList[tokenIndex];
    tokenIndex = (tokenIndex + 1) % tokenList.length;
    return token;
}

// ============ API ENDPOINTS ============

// Upload NP file
app.post('/api/upload-np', upload.single('npfile'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });
        
        const fileContent = fs.readFileSync(file.path, 'utf8');
        let messages = [];
        const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        if (fileContent.includes('[NP]') || fileContent.includes('NP:')) {
            const npRegex = /\[NP\](.*?)(?=\[NP\]|$)/gs;
            const matches = [...fileContent.matchAll(npRegex)];
            if (matches.length > 0) {
                messages = matches.map(m => m[1].trim());
            } else {
                messages = lines;
            }
        } else {
            messages = lines;
        }
        
        messages = messages.filter(m => m && m.length > 0);
        fs.unlinkSync(file.path);
        res.json({ success: true, messages: messages, count: messages.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Validate tokens
app.post('/api/validate-tokens', async (req, res) => {
    const { tokens } = req.body;
    if (!tokens || tokens.length === 0) {
        return res.status(400).json({ error: 'No tokens provided' });
    }
    const results = [];
    for (const token of tokens) {
        const result = await validateToken(token);
        results.push({ token: token.substring(0, 15) + '...', valid: result.valid, name: result.name || null, error: result.error });
    }
    res.json({ results });
});

// Set tokens
app.post('/api/set-tokens', async (req, res) => {
    const { tokens } = req.body;
    if (!tokens || tokens.length === 0) {
        return res.status(400).json({ error: 'No tokens provided' });
    }
    tokenList = tokens;
    tokenIndex = 0;
    res.json({ success: true, count: tokens.length });
});

// Launch task
app.post('/api/launch-task', async (req, res) => {
    const { threadId, haterName, interval, messages, useMultipleTokens, tokens } = req.body;
    
    if (!threadId) return res.status(400).json({ error: 'Thread/Group ID required' });
    if (!messages || messages.length === 0) return res.status(400).json({ error: 'No messages to send' });
    if (!interval || interval < 0.5) return res.status(400).json({ error: 'Interval must be ≥0.5 seconds' });
    
    let activeTokens = [];
    if (useMultipleTokens && tokenList.length > 0) {
        activeTokens = [...tokenList];
    } else if (tokens && tokens.length > 0) {
        activeTokens = tokens;
    } else if (tokenList.length > 0) {
        activeTokens = [tokenList[0]];
    } else {
        return res.status(400).json({ error: 'No valid tokens available' });
    }
    
    const taskId = uuidv4();
    let messageIndex = 0;
    let stopFlag = false;
    let sentCount = 0;
    let failedCount = 0;
    
    addTaskLog(taskId, '🚀 TASK LAUNCHED - Target: ' + threadId, 'success');
    addTaskLog(taskId, 'Messages: ' + messages.length + ' | Tokens: ' + activeTokens.length + ' | Interval: ' + interval + 's', 'info');
    if (haterName) addTaskLog(taskId, 'Prefix: ' + haterName, 'info');
    
    const intervalId = setInterval(async () => {
        if (stopFlag) {
            clearInterval(intervalId);
            activeTasks.delete(taskId);
            addTaskLog(taskId, '⏹️ TASK STOPPED', 'warning');
            return;
        }
        
        if (messageIndex >= messages.length) {
            clearInterval(intervalId);
            activeTasks.delete(taskId);
            addTaskLog(taskId, '✅ TASK COMPLETED! Sent: ' + sentCount + ' | Failed: ' + failedCount, 'success');
            return;
        }
        
        let token;
        if (useMultipleTokens && activeTokens.length > 0) {
            token = activeTokens[messageIndex % activeTokens.length];
        } else {
            token = activeTokens[0];
        }
        
        let msg = messages[messageIndex];
        if (haterName && haterName.trim()) {
            msg = haterName.trim() + ' ' + msg;
        }
        
        const result = await sendMessage(token, threadId, msg);
        if (result.success) {
            sentCount++;
            addTaskLog(taskId, '✓ Msg ' + (messageIndex + 1) + ' sent', 'success');
        } else {
            failedCount++;
            addTaskLog(taskId, '✗ Msg ' + (messageIndex + 1) + ' failed: ' + result.error, 'error');
        }
        messageIndex++;
    }, interval * 1000);
    
    activeTasks.set(taskId, { stopFlag, intervalId, sentCount, failedCount, totalMessages: messages.length, threadId });
    res.json({ taskId, totalMessages: messages.length, tokenCount: activeTokens.length });
});

// Stop task
app.post('/api/stop-task', (req, res) => {
    const { taskId } = req.body;
    const task = activeTasks.get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.stopFlag = true;
    res.json({ message: 'Task stopped' });
});

// Get task logs
app.get('/api/task-logs/:taskId', (req, res) => {
    const { taskId } = req.params;
    const logs = taskLogs.get(taskId) || [];
    res.json({ logs });
});

// Get active tasks
app.get('/api/active-tasks', (req, res) => {
    const tasks = [];
    for (const [id, task] of activeTasks) {
        tasks.push({
            taskId: id,
            threadId: task.threadId,
            totalMessages: task.totalMessages,
            sentCount: task.sentCount || 0,
            failedCount: task.failedCount || 0,
            active: !task.stopFlag
        });
    }
    res.json({ tasks });
});

// ============ CONVO LOADER API ============

// Load conversation from target
app.post('/api/load-conversation', async (req, res) => {
    const { token, targetId, limit = 500 } = req.body;
    
    if (!token || !targetId) {
        return res.status(400).json({ error: 'Token and Target ID required' });
    }
    
    try {
        const userInfo = await getUserInfo(token, targetId);
        if (!userInfo.success) {
            return res.status(400).json({ error: 'Failed to get user info: ' + userInfo.error });
        }
        
        const conv = await getConversation(token, targetId, limit);
        if (!conv.success) {
            return res.status(400).json({ error: 'Failed to get conversation: ' + conv.error });
        }
        
        let allMessages = [];
        if (conv.data.data && conv.data.data.length > 0) {
            const conversationId = conv.data.data[0].id;
            const messages = await getAllMessages(token, conversationId);
            if (messages.success) {
                allMessages = messages.messages;
            }
        }
        
        const myInfo = await getUserInfo(token, 'me');
        const myName = myInfo.success ? myInfo.data.name : 'Me';
        const exportResult = exportToNPFile(allMessages, userInfo.data.name, myName);
        
        const convId = uuidv4();
        conversations.set(convId, {
            target: userInfo.data,
            messages: allMessages,
            exportFile: exportResult.filename,
            messageCount: exportResult.messageCount
        });
        
        res.json({
            success: true,
            conversationId: convId,
            target: userInfo.data,
            messageCount: exportResult.messageCount,
            exportFile: exportResult.filename,
            preview: allMessages.slice(-10).reverse()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Download NP file
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = `./exports/${filename}`;
    if (fs.existsSync(filepath)) {
        res.download(filepath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', botMaster: 'Suraj Oberoy', activeTasks: activeTasks.size });
});

// ============ MAIN WEB INTERFACE ============
app.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔥 SURAJ OBEROY - COMPLETE MESSENGER BOT 🔥</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a0a;
            font-family: 'Orbitron', monospace;
            padding: 15px;
            color: #00ff41;
        }
        body::before {
            content: "";
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: repeating-linear-gradient(0deg, rgba(0,255,65,0.03) 0px, rgba(0,255,65,0.03) 2px, transparent 2px, transparent 8px);
            pointer-events: none;
            z-index: 0;
        }
        .container { max-width: 1400px; margin: 0 auto; position: relative; z-index: 2; }
        h1 {
            font-size: 2rem;
            text-align: center;
            text-shadow: 0.05em 0 0 rgba(255,0,0,0.7), -0.05em -0.025em 0 rgba(0,0,255,0.7);
            animation: glitch 0.2s infinite;
            margin-bottom: 10px;
        }
        @keyframes glitch {
            0% { text-shadow: 0.05em 0 0 rgba(255,0,0,0.7), -0.05em -0.025em 0 rgba(0,0,255,0.7); }
            50% { text-shadow: -0.05em 0.025em 0 rgba(255,0,0,0.7), 0.05em 0 0 rgba(0,0,255,0.7); }
            100% { text-shadow: 0.025em 0.05em 0 rgba(255,0,0,0.7), -0.025em -0.05em 0 rgba(0,0,255,0.7); }
        }
        .sub { text-align: center; color: #00cc33; border-bottom: 1px solid #00ff41; padding-bottom: 10px; margin-bottom: 20px; }
        .flex { display: flex; gap: 20px; flex-wrap: wrap; }
        .card {
            background: rgba(5, 10, 5, 0.95);
            backdrop-filter: blur(12px);
            border: 2px solid #00ff41;
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 20px;
            flex: 1;
            min-width: 300px;
        }
        .card-title {
            font-size: 1.1rem;
            font-weight: bold;
            margin-bottom: 15px;
            color: #33ff66;
            border-left: 3px solid #00ff41;
            padding-left: 10px;
        }
        label { display: block; margin: 12px 0 5px; font-weight: bold; color: #33ff66; font-size: 0.75rem; letter-spacing: 1px; }
        input, textarea, select {
            width: 100%;
            padding: 10px;
            background: #000000dd;
            border: 1px solid #00ff41;
            border-radius: 8px;
            color: #00ff41;
            font-family: 'Share Tech Mono', monospace;
            font-size: 12px;
            outline: none;
        }
        input:focus, textarea:focus { border-color: #00ff41; box-shadow: 0 0 10px #00ff41; }
        button {
            background: linear-gradient(135deg, #0a2a0a, #051505);
            border: 2px solid #00ff41;
            padding: 10px 20px;
            border-radius: 40px;
            color: #00ff41;
            font-family: 'Orbitron', monospace;
            font-weight: bold;
            cursor: pointer;
            margin-top: 12px;
            margin-right: 8px;
            transition: 0.3s;
            font-size: 12px;
        }
        button:hover { background: linear-gradient(135deg, #0f3f0f, #0a2a0a); box-shadow: 0 0 15px #00ff41; }
        .stop-btn { background: linear-gradient(135deg, #2a0a0a, #1a0505); border-color: #ff0044; color: #ff3366; }
        .upload-area {
            background: #030703dd;
            border: 2px dashed #00ff41;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            margin: 10px 0;
            cursor: pointer;
        }
        .upload-area:hover { border-color: #00ff41; background: #0a2a0add; }
        .log-area {
            background: #030703dd;
            border: 1px solid #00ff41;
            border-radius: 10px;
            padding: 12px;
            height: 250px;
            overflow-y: auto;
            font-size: 10px;
            font-family: 'Share Tech Mono', monospace;
            margin-top: 10px;
        }
        .task-item {
            background: #0a1a0a;
            padding: 8px;
            margin: 5px 0;
            border-radius: 6px;
            border-left: 3px solid #00ff41;
            font-size: 10px;
        }
        .badge {
            display: inline-block;
            background: #00ff4122;
            padding: 3px 8px;
            border-radius: 15px;
            font-size: 9px;
            margin: 2px;
        }
        .success { color: #66ff66; }
        .error { color: #ff6666; }
        .warning { color: #ffaa44; }
        .blink { animation: blink 1s step-start infinite; }
        @keyframes blink { 50% { opacity: 0.3; } }
        hr { border-color: #00ff4133; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #00ff41; font-size: 10px; }
        @media (max-width: 768px) { h1 { font-size: 1.2rem; } button { width: 100%; margin-bottom: 5px; } }
    </style>
</head>
<body>
<div class="container">
    <h1>🔥 SURAJ OBEROY - COMPLETE MESSENGER BOT 🔥</h1>
    <div class="sub"><span class="blink">⚡</span> SINGLE/MULTI TOKEN | GROUP/UID | NP FILE | CONVO LOADER | LIVE LOGS <span class="blink">⚡</span></div>

    <!-- Token Section -->
    <div class="flex">
        <div class="card">
            <div class="card-title">🔑 TOKEN MANAGEMENT</div>
            <label>TOKENS (one per line)</label>
            <textarea id="tokensInput" rows="3" placeholder="EAADxxxxx...&#10;EAAEyyyyy..."></textarea>
            <button id="setTokensBtn">📌 SET TOKENS</button>
            <button id="checkTokensBtn">✅ CHECK TOKENS</button>
            <div id="tokenStatus" class="log-area" style="height: 120px;"></div>
        </div>

        <div class="card">
            <div class="card-title">🎯 TARGET & SPEED</div>
            <label>GROUP / USER ID</label>
            <input type="text" id="threadId" placeholder="Enter Group ID or User ID">
            <label>HATER PREFIX</label>
            <input type="text" id="haterName" placeholder="Optional prefix">
            <label>SPEED (seconds)</label>
            <input type="number" id="interval" value="1.5" step="0.5">
        </div>

        <div class="card">
            <div class="card-title">📁 NP FILE UPLOAD</div>
            <div class="upload-area" id="uploadArea">
                <div>📂 CLICK OR DRAG NP FILE</div>
                <div style="font-size: 10px;">.txt file | One message per line</div>
                <input type="file" id="npFileInput" accept=".txt" style="display: none;">
            </div>
            <div id="fileInfo" style="background: #0a1a0a; padding: 8px; border-radius: 6px; margin-top: 8px; display: none;"></div>
            <button id="launchBtn" style="width: 100%; background: #00ff41; color: #000;">🚀 LAUNCH ATTACK</button>
        </div>
    </div>

    <!-- Convo Loader Section -->
    <div class="flex">
        <div class="card">
            <div class="card-title">📖 CONVO LOADER (Read Chat History)</div>
            <label>TARGET USER ID</label>
            <input type="text" id="convoTargetId" placeholder="User ID whose chat to read">
            <label>MESSAGE LIMIT</label>
            <select id="msgLimit">
                <option value="100">100 messages</option>
                <option value="500" selected>500 messages</option>
                <option value="1000">1000 messages</option>
                <option value="2000">2000 messages</option>
            </select>
            <button id="loadConvoBtn">📥 LOAD CONVERSATION</button>
            <div id="convoResult" style="margin-top: 10px;"></div>
        </div>

        <div class="card">
            <div class="card-title">⏹️ TASK CONTROL</div>
            <button id="stopCurrentBtn" class="stop-btn" style="width: 100%;">🛑 STOP CURRENT TASK</button>
            <div id="activeTasksList" class="log-area" style="height: 150px; margin-top: 15px;">No active tasks</div>
        </div>
    </div>

    <!-- Live Logs -->
    <div class="card">
        <div class="card-title">📡 LIVE LOGS</div>
        <div class="log-area" id="liveLogs" style="height: 200px;">
            <div>[>] SYSTEM READY - Suraj Oberoy Complete Bot</div>
            <div>[>] Features: Single/Multi Token | Group/UID | NP File | Convo Loader</div>
        </div>
    </div>

    <div class="footer">✦ SURAJ OBEROY ✦ | COMPLETE MESSENGER BOT | ALL FUNCTIONS WORKING</div>
</div>

<script>
    let currentTaskId = null;
    let loadedMessages = [];
    let activeTokens = [];
    let logRefreshInterval = null;
    const liveLogs = document.getElementById('liveLogs');
    
    function addLog(msg, type) {
        const p = document.createElement('div');
        if (type === 'error') p.style.color = '#ff6666';
        else if (type === 'success') p.style.color = '#66ff66';
        else if (type === 'warning') p.style.color = '#ffaa44';
        else p.style.color = '#33ff99';
        p.innerText = '[' + new Date().toLocaleTimeString() + '] ' + msg;
        liveLogs.appendChild(p);
        liveLogs.scrollTop = liveLogs.scrollHeight;
        while (liveLogs.children.length > 200) liveLogs.removeChild(liveLogs.firstChild);
    }
    
    function updateTokenStatus(msg, isError) {
        const ts = document.getElementById('tokenStatus');
        const p = document.createElement('div');
        p.style.color = isError ? '#ff6666' : '#66ff66';
        p.innerText = '[' + new Date().toLocaleTimeString() + '] ' + msg;
        ts.appendChild(p);
        ts.scrollTop = ts.scrollHeight;
        while (ts.children.length > 50) ts.removeChild(ts.firstChild);
    }
    
    // File upload
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('npFileInput');
    uploadArea.onclick = () => fileInput.click();
    uploadArea.ondragover = (e) => { e.preventDefault(); uploadArea.style.borderColor = '#00ff41'; uploadArea.style.background = '#0a2a0add'; };
    uploadArea.ondragleave = () => { uploadArea.style.borderColor = '#00ff41'; uploadArea.style.background = '#030703dd'; };
    uploadArea.ondrop = async (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#00ff41';
        uploadArea.style.background = '#030703dd';
        if (e.dataTransfer.files[0]) await uploadFile(e.dataTransfer.files[0]);
    };
    fileInput.onchange = async (e) => { if (e.target.files[0]) await uploadFile(e.target.files[0]); };
    
    async function uploadFile(file) {
        addLog('[*] Uploading: ' + file.name);
        const formData = new FormData();
        formData.append('npfile', file);
        try {
            const res = await fetch('/api/upload-np', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                loadedMessages = data.messages;
                document.getElementById('fileInfo').style.display = 'block';
                document.getElementById('fileInfo').innerHTML = '✓ Loaded: ' + data.count + ' messages';
                addLog('[✓] NP File loaded: ' + data.count + ' messages', 'success');
            } else {
                addLog('[✗] Upload failed: ' + data.error, 'error');
            }
        } catch(err) {
            addLog('[✗] Upload error: ' + err.message, 'error');
        }
    }
    
    // Set tokens
    document.getElementById('setTokensBtn').onclick = async () => {
        const tokensText = document.getElementById('tokensInput').value;
        const tokens = tokensText.split(/[\n,]/).filter(t => t.trim().length > 10);
        if (tokens.length === 0) { addLog('[✗] No valid tokens', 'error'); return; }
        activeTokens = tokens;
        addLog('[✓] ' + tokens.length + ' token(s) loaded', 'success');
        updateTokenStatus(tokens.length + ' token(s) added', false);
        const res = await fetch('/api/set-tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens: activeTokens })
        });
        const data = await res.json();
        if (data.success) updateTokenStatus(data.count + ' token(s) set successfully', false);
    };
    
    // Check tokens
    document.getElementById('checkTokensBtn').onclick = async () => {
        if (activeTokens.length === 0) { addLog('[✗] No tokens loaded. Click SET TOKENS first', 'error'); return; }
        addLog('[*] Checking ' + activeTokens.length + ' tokens...');
        const res = await fetch('/api/validate-tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens: activeTokens })
        });
        const data = await res.json();
        let validCount = 0;
        for (const r of data.results) {
            if (r.valid) validCount++;
            updateTokenStatus(r.token + ': ' + (r.valid ? '✓ ' + r.name : '✗ ' + r.error), !r.valid);
        }
        addLog('[✓] ' + validCount + '/' + activeTokens.length + ' tokens valid', 'success');
    };
    
    // Launch task
    document.getElementById('launchBtn').onclick = async () => {
        const threadId = document.getElementById('threadId').value.trim();
        const haterName = document.getElementById('haterName').value.trim();
        const interval = parseFloat(document.getElementById('interval').value);
        const useMultipleTokens = activeTokens.length > 1;
        
        if (!threadId) { addLog('[✗] Group/User ID required', 'error'); return; }
        if (loadedMessages.length === 0) { addLog('[✗] No NP file loaded', 'error'); return; }
        if (activeTokens.length === 0) { addLog('[✗] No tokens set', 'error'); return; }
        if (isNaN(interval) || interval < 0.5) { addLog('[✗] Interval must be ≥0.5', 'error'); return; }
        
        addLog('[*] Launching task to: ' + threadId);
        addLog('[*] Messages: ' + loadedMessages.length + ' | Tokens: ' + activeTokens.length);
        
        const res = await fetch('/api/launch-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                threadId: threadId, haterName: haterName, interval: interval,
                messages: loadedMessages, useMultipleTokens: useMultipleTokens, tokens: activeTokens
            })
        });
        const data = await res.json();
        if (!res.ok) { addLog('[✗] Launch failed: ' + data.error, 'error'); return; }
        
        currentTaskId = data.taskId;
        addLog('[✓] TASK STARTED! ID: ' + currentTaskId, 'success');
        addLog('[✓] Mode: ' + (useMultipleTokens ? 'MULTI-TOKEN' : 'SINGLE-TOKEN'), 'success');
        refreshActiveTasks();
    };
    
    // Load conversation
    document.getElementById('loadConvoBtn').onclick = async () => {
        const targetId = document.getElementById('convoTargetId').value.trim();
        const limit = parseInt(document.getElementById('msgLimit').value);
        
        if (activeTokens.length === 0) { addLog('[✗] No tokens loaded. Set tokens first', 'error'); return; }
        if (!targetId) { addLog('[✗] Target user ID required', 'error'); return; }
        
        const token = activeTokens[0];
        addLog('[*] Loading conversation with: ' + targetId);
        
        const res = await fetch('/api/load-conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token, targetId: targetId, limit: limit })
        });
        const data = await res.json();
        
        if (!res.ok) {
            addLog('[✗] Load failed: ' + data.error, 'error');
            document.getElementById('convoResult').innerHTML = '<div class="error">Error: ' + data.error + '</div>';
            return;
        }
        
        addLog('[✓] Conversation loaded! ' + data.messageCount + ' messages', 'success');
        document.getElementById('convoResult').innerHTML = \`
            <div style="background: #0a1a0a; padding: 10px; border-radius: 8px;">
                <div>✓ Target: \${data.target.name}</div>
                <div>✓ Messages: \${data.messageCount}</div>
                <div>✓ File: \${data.exportFile}</div>
                <a href="/api/download/\${data.exportFile}" style="color: #00ff41; display: inline-block; margin-top: 8px;">⬇️ DOWNLOAD NP FILE</a>
            </div>
        \`;
    };
    
    // Refresh active tasks
    async function refreshActiveTasks() {
        const res = await fetch('/api/active-tasks');
        const data = await res.json();
        const container = document.getElementById('activeTasksList');
        if (data.tasks.length === 0) { container.innerHTML = 'No active tasks'; return; }
        let html = '';
        for (const task of data.tasks) {
            html += '<div class="task-item">';
            html += '<strong>ID:</strong> ' + task.taskId.substring(0, 8) + '...<br>';
            html += '<strong>Target:</strong> ' + task.threadId + '<br>';
            html += '<strong>Progress:</strong> ' + task.sentCount + '/' + task.totalMessages;
            if (task.failedCount > 0) html += ' | Failed: ' + task.failedCount;
            html += '<br><strong>Status:</strong> ' + (task.active ? '🟢 RUNNING' : '🔴 STOPPED');
            html += '</div>';
        }
        container.innerHTML = html;
    }
    
    // Stop current task
    document.getElementById('stopCurrentBtn').onclick = async () => {
        if (!currentTaskId) { addLog('[!] No active task', 'warning'); return; }
        const res = await fetch('/api/stop-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: currentTaskId })
        });
        const data = await res.json();
        if (res.ok) {
            addLog('[✓] Task stopped: ' + currentTaskId, 'success');
            currentTaskId = null;
        } else {
            addLog('[✗] Stop failed: ' + data.error, 'error');
        }
        refreshActiveTasks();
    };
    
    setInterval(refreshActiveTasks, 5000);
    refreshActiveTasks();
</script>
</body>
</html>`;
    
    res.send(html);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     🔥 SURAJ OBEROY - COMPLETE MESSENGER BOT 🔥                ║');
    console.log('║                                                                ║');
    console.log('║     ✅ Single Token Support                                    ║');
    console.log('║     ✅ Multiple Token Support (Round Robin)                    ║');
    console.log('║     ✅ Group/User ID Support                                   ║');
    console.log('║     ✅ Hater Name/Prefix                                       ║');
    console.log('║     ✅ Adjustable Speed (Interval)                             ║');
    console.log('║     ✅ NP File Upload                                          ║');
    console.log('║     ✅ Stop Task Feature                                       ║');
    console.log('║     ✅ Token Checker                                           ║');
    console.log('║     ✅ Live Logs                                               ║');
    console.log('║     ✅ Conversation Loader (Read Chat History)                 ║');
    console.log('║     ✅ Export to NP File                                       ║');
    console.log('║                                                                ║');
    console.log('║     PORT: ' + PORT + '                                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
});
