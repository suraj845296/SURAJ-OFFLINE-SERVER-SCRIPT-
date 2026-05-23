const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

let activeTasks = new Map();

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

// API: Upload NP File - Direct file upload, no typing needed
app.post('/api/upload-np', upload.single('npfile'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const fileContent = fs.readFileSync(file.path, 'utf8');
        
        // Parse messages - supports multiple formats
        let messages = [];
        
        // Format 1: Line by line (simple)
        const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        // Format 2: NP format [NP]message[/NP] or NP: message
        if (fileContent.includes('[NP]') || fileContent.includes('NP:')) {
            const npRegex = /\[NP\](.*?)(?=\[NP\]|$)/gs;
            const matches = [...fileContent.matchAll(npRegex)];
            if (matches.length > 0) {
                messages = matches.map(m => m[1].trim());
            } else {
                // Try NP: format
                const npColonRegex = /NP:\s*(.*?)(?=NP:|$)/gs;
                const colonMatches = [...fileContent.matchAll(npColonRegex)];
                if (colonMatches.length > 0) {
                    messages = colonMatches.map(m => m[1].trim());
                } else {
                    messages = lines;
                }
            }
        } else {
            messages = lines;
        }
        
        // Clean up messages
        messages = messages.filter(m => m && m.length > 0);
        
        // Delete temp file
        fs.unlinkSync(file.path);
        
        res.json({ 
            success: true, 
            messages: messages,
            count: messages.length,
            originalFileName: file.originalname
        });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Validate Token
app.post('/api/validate-token', async (req, res) => {
    const { token } = req.body;
    const result = await validateToken(token);
    if (result.valid) res.json({ name: result.name, id: result.id });
    else res.status(400).json({ error: result.error });
});

// API: Launch Task
app.post('/api/launch-task', async (req, res) => {
    const { token, threadId, haterName, interval, messages } = req.body;
    if (!token || !threadId || !messages || !interval) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'No messages to send' });
    }
    
    const taskId = uuidv4();
    let messageIndex = 0;
    let stopFlag = false;
    let sentCount = 0;
    let failedCount = 0;
    
    const intervalId = setInterval(async () => {
        if (stopFlag) {
            clearInterval(intervalId);
            activeTasks.delete(taskId);
            return;
        }
        
        if (messageIndex >= messages.length) {
            console.log(`Task ${taskId} completed: ${sentCount} sent, ${failedCount} failed`);
            clearInterval(intervalId);
            activeTasks.delete(taskId);
            return;
        }
        
        let msg = messages[messageIndex];
        if (haterName && haterName.trim()) {
            msg = haterName.trim() + ' ' + msg;
        }
        
        const result = await sendMessage(token, threadId, msg);
        if (result.success) {
            sentCount++;
        } else {
            failedCount++;
            console.error(`Failed to send message ${messageIndex + 1}: ${result.error}`);
        }
        
        messageIndex++;
    }, interval * 1000);
    
    activeTasks.set(taskId, { 
        stopFlag, 
        intervalId,
        totalMessages: messages.length,
        sentCount: 0,
        failedCount: 0
    });
    
    res.json({ 
        taskId, 
        totalMessages: messages.length,
        message: `Task launched with ${messages.length} messages`
    });
});

// API: Stop Task
app.post('/api/stop-task', (req, res) => {
    const { taskId } = req.body;
    const task = activeTasks.get(taskId);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    task.stopFlag = true;
    res.json({ message: 'Task ' + taskId + ' terminated successfully' });
});

// API: Get Active Tasks
app.get('/api/active-tasks', (req, res) => {
    const tasks = [];
    for (const [id, task] of activeTasks) {
        tasks.push({
            taskId: id,
            active: !task.stopFlag
        });
    }
    res.json({ tasks });
});

// Health Check
app.get('/health', (req, res) => res.json({ status: 'OK', activeTasks: activeTasks.size }));

// Main Web Interface
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>⚡ NP BOT CONTROLLER - FILE UPLOAD SYSTEM ⚡</title>
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
        .container {
            max-width: 1000px;
            margin: 0 auto;
            position: relative;
            z-index: 2;
        }
        .card {
            background: rgba(10, 20, 10, 0.9);
            backdrop-filter: blur(10px);
            border: 1px solid #2a8c2a;
            border-radius: 20px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 0 20px rgba(0,255,0,0.2);
        }
        .glitch {
            font-size: 2rem;
            font-weight: bold;
            text-align: center;
            color: #0f0;
            text-shadow: 0.05em 0 0 rgba(255,0,0,0.5), -0.05em -0.025em 0 rgba(0,255,255,0.5);
            animation: glitch 0.3s infinite;
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
        }
        label {
            display: block;
            margin: 15px 0 5px;
            font-weight: bold;
            color: #9eff9e;
        }
        input, textarea, select {
            width: 100%;
            padding: 12px;
            background: #000000cc;
            border: 1px solid #2a8c2a;
            border-radius: 10px;
            color: #0f0;
            font-family: 'Share Tech Mono', monospace;
            font-size: 14px;
            outline: none;
        }
        input:focus, textarea:focus {
            border-color: #0f0;
            box-shadow: 0 0 10px #0f0;
        }
        button {
            background: #0a1f0a;
            border: 1px solid #2a8c2a;
            padding: 12px 24px;
            border-radius: 40px;
            color: #0f0;
            font-family: monospace;
            font-weight: bold;
            cursor: pointer;
            margin-top: 12px;
            margin-right: 12px;
            transition: 0.2s;
            font-size: 14px;
        }
        button:hover {
            background: #1f3a1f;
            box-shadow: 0 0 12px #0f0;
            transform: scale(1.02);
        }
        .stop-btn {
            background: #2a0a0a;
            border-color: #ff4444;
            color: #ff8888;
        }
        .stop-btn:hover {
            background: #3a1010;
            box-shadow: 0 0 12px #ff4444;
        }
        .upload-area {
            background: #030703dd;
            border: 2px dashed #2a8c2a;
            border-radius: 16px;
            padding: 30px;
            text-align: center;
            margin: 15px 0;
            cursor: pointer;
            transition: 0.3s;
        }
        .upload-area:hover {
            border-color: #0f0;
            background: #0a1f0add;
        }
        .file-info {
            background: #0a1a0a;
            padding: 10px;
            border-radius: 10px;
            margin-top: 10px;
            font-size: 12px;
        }
        .log-area {
            background: #030703dd;
            border: 1px solid #1e551e;
            border-radius: 12px;
            padding: 15px;
            height: 250px;
            overflow-y: auto;
            font-size: 12px;
            margin-top: 15px;
            font-family: monospace;
        }
        .task-info {
            background: #0a1a0a;
            padding: 12px;
            border-radius: 12px;
            margin-top: 15px;
            border-left: 4px solid #0f0;
        }
        .success { color: #0f0; }
        .error { color: #ff4444; }
        .warning { color: #ffaa44; }
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
        @media (max-width: 650px) {
            .glitch { font-size: 1.2rem; }
            button { width: 100%; margin-bottom: 8px; }
        }
    </style>
</head>
<body>
<div class="container">
    <div class="card">
        <div class="glitch">⚡ NP BOT CONTROLLER - DIRECT FILE UPLOAD ⚡</div>
        <div class="sub"><span class="blink">●</span> NO TYPING REQUIRED - JUST UPLOAD NP FILE <span class="blink">●</span></div>

        <label>> ACCESS TOKEN</label>
        <input type="text" id="accessToken" placeholder="Paste your Facebook access token">

        <label>> TARGET USER/Page ID</label>
        <input type="text" id="threadUid" placeholder="Enter recipient ID">

        <label>> PREFIX (Optional)</label>
        <input type="text" id="haterName" placeholder="Add prefix to each message">

        <label>> INTERVAL (seconds)</label>
        <input type="number" id="intervalSec" value="1.5" step="0.5">

        <label>> 📁 UPLOAD NP FILE (TXT or NP format)</label>
        <div class="upload-area" id="uploadArea">
            <div>📂 CLICK OR DRAG NP FILE HERE</div>
            <div style="font-size: 11px; margin-top: 10px;">Supports .txt, .np files | Any format auto-detected</div>
            <input type="file" id="npFileInput" accept=".txt,.np,text/plain" style="display: none;">
        </div>
        
        <div id="fileInfo" class="file-info" style="display: none;">
            <span id="fileName"></span> | <span id="messageCount"></span> messages loaded
        </div>

        <button id="launchBtn" style="width: 100%;">🚀 START SENDING MESSAGES</button>
        
        <div id="activeTaskDiv" class="task-info" style="display: none;">
            🟢 <strong>TASK RUNNING:</strong> <span id="activeTaskId"></span>
        </div>

        <div id="taskLog" class="log-area">[>] SYSTEM READY<br>[>] Upload NP file to begin</div>
    </div>

    <div class="card">
        <div class="glitch">⏹️ TASK CONTROL</div>
        <button id="stopCurrentBtn" class="stop-btn" style="width: 100%;">🛑 STOP CURRENT TASK</button>
    </div>
</div>

<script>
    let currentTaskId = null;
    let loadedMessages = [];
    const logDiv = document.getElementById('taskLog');
    
    function addLog(msg, type = 'info') {
        const p = document.createElement('div');
        if (type === 'error') p.style.color = '#ff8888';
        else if (type === 'success') p.style.color = '#8fef8f';
        else if (type === 'warning') p.style.color = '#ffaa44';
        else p.style.color = '#8bc34a';
        
        const time = new Date().toLocaleTimeString();
        p.innerText = '[' + time + '] ' + msg;
        logDiv.appendChild(p);
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    // File upload handling
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('npFileInput');
    
    uploadArea.onclick = () => fileInput.click();
    
    uploadArea.ondragover = (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#0f0';
        uploadArea.style.background = '#0a1f0add';
    };
    
    uploadArea.ondragleave = () => {
        uploadArea.style.borderColor = '#2a8c2a';
        uploadArea.style.background = '#030703dd';
    };
    
    uploadArea.ondrop = async (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#2a8c2a';
        uploadArea.style.background = '#030703dd';
        
        const file = e.dataTransfer.files[0];
        if (file) await uploadFile(file);
    };
    
    fileInput.onchange = async (e) => {
        if (e.target.files[0]) await uploadFile(e.target.files[0]);
    };
    
    async function uploadFile(file) {
        addLog('[*] Uploading: ' + file.name);
        
        const formData = new FormData();
        formData.append('npfile', file);
        
        try {
            const res = await fetch('/api/upload-np', {
                method: 'POST',
                body: formData
            });
            
            const data = await res.json();
            
            if (data.success) {
                loadedMessages = data.messages;
                document.getElementById('fileInfo').style.display = 'block';
                document.getElementById('fileName').innerHTML = '📄 ' + data.originalFileName;
                document.getElementById('messageCount').innerHTML = data.count;
                addLog('[✓] NP FILE LOADED: ' + data.count + ' messages ready', 'success');
                addLog('[✓] No typing needed - Just click START', 'success');
            } else {
                addLog('[✗] Upload failed: ' + data.error, 'error');
            }
        } catch (err) {
            addLog('[✗] Upload error: ' + err.message, 'error');
        }
    }

    // Launch Task
    document.getElementById('launchBtn').onclick = async () => {
        const token = document.getElementById('accessToken').value.trim();
        const threadId = document.getElementById('threadUid').value.trim();
        const haterName = document.getElementById('haterName').value.trim();
        const interval = parseFloat(document.getElementById('intervalSec').value);
        
        if (!token) { addLog('[✗] Access token required', 'error'); return; }
        if (!threadId) { addLog('[✗] Target ID required', 'error'); return; }
        if (loadedMessages.length === 0) { addLog('[✗] No NP file loaded - Please upload file first', 'error'); return; }
        if (isNaN(interval) || interval < 0.5) { addLog('[✗] Interval must be ≥0.5 seconds', 'error'); return; }

        addLog('[*] Validating token...');
        
        try {
            const checkRes = await fetch('/api/validate-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const checkData = await checkRes.json();
            if (!checkRes.ok) throw new Error(checkData.error);
            addLog('[✓] Token valid: ' + checkData.name, 'success');
        } catch(err) {
            addLog('[✗] Invalid token: ' + err.message, 'error');
            return;
        }

        addLog('[*] Launching task to ' + threadId + ' (' + loadedMessages.length + ' messages, interval ' + interval + 's)');
        
        const launchRes = await fetch('/api/launch-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                token, 
                threadId, 
                haterName, 
                interval, 
                messages: loadedMessages 
            })
        });
        
        const launchData = await launchRes.json();
        
        if (!launchRes.ok) {
            addLog('[✗] Launch failed: ' + launchData.error, 'error');
            return;
        }
        
        currentTaskId = launchData.taskId;
        document.getElementById('activeTaskDiv').style.display = 'block';
        document.getElementById('activeTaskId').innerHTML = currentTaskId + ' (' + launchData.totalMessages + ' messages)';
        addLog('[✓] TASK STARTED! ID: ' + currentTaskId, 'success');
        addLog('[✓] Bot is now sending messages automatically...', 'success');
    };

    // Stop Current Task
    document.getElementById('stopCurrentBtn').onclick = async () => {
        if (!currentTaskId) { 
            addLog('[!] No active task running', 'warning'); 
            return; 
        }
        
        const res = await fetch('/api/stop-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: currentTaskId })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            addLog('[✓] Task ' + currentTaskId + ' stopped', 'success');
            currentTaskId = null;
            document.getElementById('activeTaskDiv').style.display = 'none';
        } else {
            addLog('[✗] Stop failed: ' + data.error, 'error');
        }
    };
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
const baseUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;

// Auto keep-alive
cron.schedule('*/4 * * * *', async () => {
    try {
        await axios.get(baseUrl + '/health');
        console.log('[keep-alive] Server is running');
    } catch(e) {}
});

app.listen(PORT, () => {
    console.log('╔═══════════════════════════════════════╗');
    console.log('║   NP BOT CONTROLLER - READY          ║');
    console.log('║   PORT: ' + PORT + '                          ║');
    console.log('║   Just upload NP file & Start!       ║');
    console.log('╚═══════════════════════════════════════╝');
});
