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

// API: Upload NP File
app.post('/api/upload-np', upload.single('npfile'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const fileContent = fs.readFileSync(file.path, 'utf8');
        
        let messages = [];
        const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        if (fileContent.includes('[NP]') || fileContent.includes('NP:')) {
            const npRegex = /\[NP\](.*?)(?=\[NP\]|$)/gs;
            const matches = [...fileContent.matchAll(npRegex)];
            if (matches.length > 0) {
                messages = matches.map(m => m[1].trim());
            } else {
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
        
        messages = messages.filter(m => m && m.length > 0);
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
    if (result.valid) {
        res.json({ name: result.name, id: result.id });
    } else {
        res.status(400).json({ error: result.error });
    }
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
        if (haterName && haterName.trim()) {
            msg = haterName.trim() + ' ' + msg;
        }
        
        await sendMessage(token, threadId, msg);
        messageIndex++;
    }, interval * 1000);
    
    activeTasks.set(taskId, { stopFlag, intervalId });
    
    res.json({ 
        taskId, 
        totalMessages: messages.length,
        message: 'Task launched with ' + messages.length + ' messages'
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
        tasks.push({ taskId: id, active: !task.stopFlag });
    }
    res.json({ tasks: tasks });
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', activeTasks: activeTasks.size, botMaster: 'Suraj Oberoy' });
});

// Main Web Interface - SURAJ OBEROY EDITION
app.get('/', (req, res) => {
    const html = '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'    <meta charset="UTF-8">\n' +
'    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'    <title>🔥 SURAJ OBEROY - NP BOT CONTROLLER 🔥</title>\n' +
'    <style>\n' +
'        @import url(\'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap\');\n' +
'        * { margin: 0; padding: 0; box-sizing: border-box; }\n' +
'        body {\n' +
'            background: #0a0a0a;\n' +
'            font-family: \'Orbitron\', monospace;\n' +
'            min-height: 100vh;\n' +
'            padding: 20px;\n' +
'            color: #00ff41;\n' +
'            position: relative;\n' +
'        }\n' +
'        body::before {\n' +
'            content: "";\n' +
'            position: fixed;\n' +
'            top: 0; left: 0;\n' +
'            width: 100%; height: 100%;\n' +
'            background: \n' +
'                repeating-linear-gradient(0deg, rgba(0,255,65,0.03) 0px, rgba(0,255,65,0.03) 2px, transparent 2px, transparent 8px),\n' +
'                url(\'https://images.pexels.com/photos/1165982/pexels-photo-1165982.jpeg?auto=compress&cs=tinysrgb&w=1600\');\n' +
'            background-size: cover, cover;\n' +
'            background-position: center;\n' +
'            opacity: 0.1;\n' +
'            pointer-events: none;\n' +
'            z-index: 0;\n' +
'        }\n' +
'        .container {\n' +
'            max-width: 1100px;\n' +
'            margin: 0 auto;\n' +
'            position: relative;\n' +
'            z-index: 2;\n' +
'        }\n' +
'        .card {\n' +
'            background: rgba(5, 10, 5, 0.95);\n' +
'            backdrop-filter: blur(12px);\n' +
'            border: 2px solid #00ff41;\n' +
'            border-radius: 20px;\n' +
'            padding: 30px;\n' +
'            margin-bottom: 25px;\n' +
'            box-shadow: 0 0 30px rgba(0,255,65,0.3), inset 0 0 20px rgba(0,255,65,0.05);\n' +
'        }\n' +
'        .suraj-header {\n' +
'            text-align: center;\n' +
'            margin-bottom: 20px;\n' +
'        }\n' +
'        .glitch {\n' +
'            font-size: 2.5rem;\n' +
'            font-weight: 900;\n' +
'            text-align: center;\n' +
'            color: #00ff41;\n' +
'            text-shadow: \n' +
'                0.05em 0 0 rgba(255,0,0,0.7),\n' +
'                -0.05em -0.025em 0 rgba(0,0,255,0.7);\n' +
'            animation: glitch 0.2s infinite;\n' +
'            letter-spacing: 4px;\n' +
'        }\n' +
'        @keyframes glitch {\n' +
'            0% { text-shadow: 0.05em 0 0 rgba(255,0,0,0.7), -0.05em -0.025em 0 rgba(0,0,255,0.7); }\n' +
'            50% { text-shadow: -0.05em 0.025em 0 rgba(255,0,0,0.7), 0.05em 0 0 rgba(0,0,255,0.7); }\n' +
'            100% { text-shadow: 0.025em 0.05em 0 rgba(255,0,0,0.7), -0.025em -0.05em 0 rgba(0,0,255,0.7); }\n' +
'        }\n' +
'        .sub {\n' +
'            text-align: center;\n' +
'            color: #00cc33;\n' +
'            border-bottom: 1px solid #00ff41;\n' +
'            padding-bottom: 12px;\n' +
'            margin-bottom: 25px;\n' +
'            font-size: 0.9rem;\n' +
'            letter-spacing: 2px;\n' +
'        }\n' +
'        .sub .blink {\n' +
'            animation: blink 1s step-start infinite;\n' +
'            color: #ff0044;\n' +
'        }\n' +
'        @keyframes blink {\n' +
'            50% { opacity: 0.3; }\n' +
'        }\n' +
'        label {\n' +
'            display: block;\n' +
'            margin: 18px 0 8px;\n' +
'            font-weight: bold;\n' +
'            color: #33ff66;\n' +
'            letter-spacing: 2px;\n' +
'            font-size: 0.85rem;\n' +
'        }\n' +
'        input, textarea, select {\n' +
'            width: 100%;\n' +
'            padding: 14px;\n' +
'            background: #000000dd;\n' +
'            border: 1px solid #00ff41;\n' +
'            border-radius: 10px;\n' +
'            color: #00ff41;\n' +
'            font-family: \'Share Tech Mono\', monospace;\n' +
'            font-size: 14px;\n' +
'            outline: none;\n' +
'            transition: 0.2s;\n' +
'        }\n' +
'        input:focus, textarea:focus {\n' +
'            border-color: #00ff41;\n' +
'            box-shadow: 0 0 15px #00ff41;\n' +
'            background: #001100dd;\n' +
'        }\n' +
'        button {\n' +
'            background: linear-gradient(135deg, #0a2a0a, #051505);\n' +
'            border: 2px solid #00ff41;\n' +
'            padding: 14px 28px;\n' +
'            border-radius: 50px;\n' +
'            color: #00ff41;\n' +
'            font-family: \'Orbitron\', monospace;\n' +
'            font-weight: bold;\n' +
'            cursor: pointer;\n' +
'            margin-top: 15px;\n' +
'            margin-right: 12px;\n' +
'            transition: 0.3s;\n' +
'            font-size: 14px;\n' +
'            letter-spacing: 2px;\n' +
'        }\n' +
'        button:hover {\n' +
'            background: linear-gradient(135deg, #0f3f0f, #0a2a0a);\n' +
'            box-shadow: 0 0 20px #00ff41;\n' +
'            transform: scale(1.02);\n' +
'            text-shadow: 0 0 5px #00ff41;\n' +
'        }\n' +
'        .stop-btn {\n' +
'            background: linear-gradient(135deg, #2a0a0a, #1a0505);\n' +
'            border-color: #ff0044;\n' +
'            color: #ff3366;\n' +
'        }\n' +
'        .stop-btn:hover {\n' +
'            background: linear-gradient(135deg, #3a1010, #2a0a0a);\n' +
'            box-shadow: 0 0 20px #ff0044;\n' +
'        }\n' +
'        .upload-area {\n' +
'            background: #030703dd;\n' +
'            border: 2px dashed #00ff41;\n' +
'            border-radius: 16px;\n' +
'            padding: 35px;\n' +
'            text-align: center;\n' +
'            margin: 15px 0;\n' +
'            cursor: pointer;\n' +
'            transition: 0.3s;\n' +
'        }\n' +
'        .upload-area:hover {\n' +
'            border-color: #00ff41;\n' +
'            background: #0a2a0add;\n' +
'            box-shadow: 0 0 20px rgba(0,255,65,0.3);\n' +
'        }\n' +
'        .file-info {\n' +
'            background: #0a1a0a;\n' +
'            padding: 12px;\n' +
'            border-radius: 10px;\n' +
'            margin-top: 12px;\n' +
'            font-size: 12px;\n' +
'            border-left: 3px solid #00ff41;\n' +
'        }\n' +
'        .log-area {\n' +
'            background: #030703dd;\n' +
'            border: 1px solid #00ff41;\n' +
'            border-radius: 12px;\n' +
'            padding: 15px;\n' +
'            height: 260px;\n' +
'            overflow-y: auto;\n' +
'            font-size: 12px;\n' +
'            margin-top: 18px;\n' +
'            font-family: \'Share Tech Mono\', monospace;\n' +
'        }\n' +
'        .task-info {\n' +
'            background: #0a1a0a;\n' +
'            padding: 14px;\n' +
'            border-radius: 12px;\n' +
'            margin-top: 18px;\n' +
'            border-left: 4px solid #00ff41;\n' +
'            font-size: 13px;\n' +
'        }\n' +
'        .signature {\n' +
'            text-align: center;\n' +
'            margin-top: 20px;\n' +
'            padding-top: 15px;\n' +
'            border-top: 1px solid #00ff41;\n' +
'            color: #33ff66;\n' +
'            font-size: 12px;\n' +
'            letter-spacing: 2px;\n' +
'        }\n' +
'        .signature span {\n' +
'            color: #ff0044;\n' +
'            font-weight: bold;\n' +
'        }\n' +
'        hr {\n' +
'            border-color: #00ff41;\n' +
'            margin: 20px 0;\n' +
'        }\n' +
'        @media (max-width: 650px) {\n' +
'            .glitch { font-size: 1.3rem; letter-spacing: 2px; }\n' +
'            button { width: 100%; margin-bottom: 10px; }\n' +
'        }\n' +
'    </style>\n' +
'</head>\n' +
'<body>\n' +
'<div class="container">\n' +
'    <div class="card">\n' +
'        <div class="suraj-header">\n' +
'            <div class="glitch">🔥 SURAJ OBEROY 🔥</div>\n' +
'            <div class="glitch" style="font-size: 1.2rem; margin-top: 5px;">NP BOT CONTROLLER</div>\n' +
'        </div>\n' +
'        <div class="sub"><span class="blink">⚡</span> DIRECT NP FILE UPLOAD - NO TYPING REQUIRED <span class="blink">⚡</span></div>\n' +
'\n' +
'        <label>> ACCESS TOKEN</label>\n' +
'        <input type="text" id="accessToken" placeholder="Paste your Facebook access token here">\n' +
'\n' +
'        <label>> TARGET USER/Page ID</label>\n' +
'        <input type="text" id="threadUid" placeholder="Enter recipient ID">\n' +
'\n' +
'        <label>> PREFIX (Optional)</label>\n' +
'        <input type="text" id="haterName" placeholder="Add prefix to each message">\n' +
'\n' +
'        <label>> INTERVAL (seconds)</label>\n' +
'        <input type="number" id="intervalSec" value="1.5" step="0.5">\n' +
'\n' +
'        <label>> 📁 UPLOAD NP FILE</label>\n' +
'        <div class="upload-area" id="uploadArea">\n' +
'            <div style="font-size: 2rem;">📂</div>\n' +
'            <div>CLICK OR DRAG NP FILE HERE</div>\n' +
'            <div style="font-size: 11px; margin-top: 12px; color: #88ff88;">Supports .txt, .np files | Auto-detect format</div>\n' +
'            <input type="file" id="npFileInput" accept=".txt,.np,text/plain" style="display: none;">\n' +
'        </div>\n' +
'        \n' +
'        <div id="fileInfo" class="file-info" style="display: none;">\n' +
'            <span id="fileName"></span> | <span id="messageCount"></span> messages loaded\n' +
'        </div>\n' +
'\n' +
'        <button id="launchBtn" style="width: 100%;">🚀 LAUNCH ATTACK</button>\n' +
'        \n' +
'        <div id="activeTaskDiv" class="task-info" style="display: none;">\n' +
'            🟢 <strong>ACTIVE TASK:</strong> <span id="activeTaskId"></span>\n' +
'        </div>\n' +
'\n' +
'        <div id="taskLog" class="log-area">[>] SYSTEM READY - SURAJ OBEROY EDITION<br>[>] Upload NP file to begin</div>\n' +
'    </div>\n' +
'\n' +
'    <div class="card">\n' +
'        <div class="glitch" style="font-size: 1.2rem;">⏹️ TERMINATE TASK</div>\n' +
'        <button id="stopCurrentBtn" class="stop-btn" style="width: 100%;">🛑 STOP CURRENT TASK</button>\n' +
'    </div>\n' +
'    \n' +
'    <div class="signature">\n' +
'        <span>✦ SURAJ OBEROY ✦</span> | HACKER EDITION v2.0 | NP BOT CONTROLLER\n' +
'    </div>\n' +
'</div>\n' +
'\n' +
'<script>\n' +
'    let currentTaskId = null;\n' +
'    let loadedMessages = [];\n' +
'    const logDiv = document.getElementById(\'taskLog\');\n' +
'    \n' +
'    function addLog(msg, type) {\n' +
'        const p = document.createElement(\'div\');\n' +
'        if (type === \'error\') p.style.color = \'#ff6666\';\n' +
'        else if (type === \'success\') p.style.color = \'#66ff66\';\n' +
'        else if (type === \'warning\') p.style.color = \'#ffaa44\';\n' +
'        else p.style.color = \'#33ff99\';\n' +
'        \n' +
'        const time = new Date().toLocaleTimeString();\n' +
'        p.innerText = \'[\' + time + \'] \' + msg;\n' +
'        logDiv.appendChild(p);\n' +
'        logDiv.scrollTop = logDiv.scrollHeight;\n' +
'    }\n' +
'\n' +
'    const uploadArea = document.getElementById(\'uploadArea\');\n' +
'    const fileInput = document.getElementById(\'npFileInput\');\n' +
'    \n' +
'    uploadArea.onclick = function() { fileInput.click(); };\n' +
'    \n' +
'    uploadArea.ondragover = function(e) {\n' +
'        e.preventDefault();\n' +
'        uploadArea.style.borderColor = \'#00ff41\';\n' +
'        uploadArea.style.background = \'#0a2a0add\';\n' +
'    };\n' +
'    \n' +
'    uploadArea.ondragleave = function() {\n' +
'        uploadArea.style.borderColor = \'#00ff41\';\n' +
'        uploadArea.style.background = \'#030703dd\';\n' +
'    };\n' +
'    \n' +
'    uploadArea.ondrop = async function(e) {\n' +
'        e.preventDefault();\n' +
'        uploadArea.style.borderColor = \'#00ff41\';\n' +
'        uploadArea.style.background = \'#030703dd\';\n' +
'        \n' +
'        const file = e.dataTransfer.files[0];\n' +
'        if (file) await uploadFile(file);\n' +
'    };\n' +
'    \n' +
'    fileInput.onchange = async function(e) {\n' +
'        if (e.target.files[0]) await uploadFile(e.target.files[0]);\n' +
'    };\n' +
'    \n' +
'    async function uploadFile(file) {\n' +
'        addLog(\'[*] Uploading: \' + file.name, \'info\');\n' +
'        \n' +
'        const formData = new FormData();\n' +
'        formData.append(\'npfile\', file);\n' +
'        \n' +
'        try {\n' +
'            const res = await fetch(\'/api/upload-np\', {\n' +
'                method: \'POST\',\n' +
'                body: formData\n' +
'            });\n' +
'            \n' +
'            const data = await res.json();\n' +
'            \n' +
'            if (data.success) {\n' +
'                loadedMessages = data.messages;\n' +
'                document.getElementById(\'fileInfo\').style.display = \'block\';\n' +
'                document.getElementById(\'fileName\').innerHTML = \'📄 \' + data.originalFileName;\n' +
'                document.getElementById(\'messageCount\').innerHTML = data.count;\n' +
'                addLog(\'[✓] NP FILE LOADED: \' + data.count + \' messages ready\', \'success\');\n' +
'                addLog(\'[✓] Ready to launch - Click START\', \'success\');\n' +
'            } else {\n' +
'                addLog(\'[✗] Upload failed: \' + data.error, \'error\');\n' +
'            }\n' +
'        } catch(err) {\n' +
'            addLog(\'[✗] Upload error: \' + err.message, \'error\');\n' +
'        }\n' +
'    }\n' +
'\n' +
'    document.getElementById(\'launchBtn\').onclick = async function() {\n' +
'        const token = document.getElementById(\'accessToken\').value.trim();\n' +
'        const threadId = document.getElementById(\'threadUid\').value.trim();\n' +
'        const haterName = document.getElementById(\'haterName\').value.trim();\n' +
'        const interval = parseFloat(document.getElementById(\'intervalSec\').value);\n' +
'        \n' +
'        if (!token) { addLog(\'[✗] Access token required\', \'error\'); return; }\n' +
'        if (!threadId) { addLog(\'[✗] Target ID required\', \'error\'); return; }\n' +
'        if (loadedMessages.length === 0) { addLog(\'[✗] No NP file loaded - Upload file first\', \'error\'); return; }\n' +
'        if (isNaN(interval) || interval < 0.5) { addLog(\'[✗] Interval must be ≥0.5 seconds\', \'error\'); return; }\n' +
'\n' +
'        addLog(\'[*] Validating token...\', \'info\');\n' +
'        \n' +
'        try {\n' +
'            const checkRes = await fetch(\'/api/validate-token\', {\n' +
'                method: \'POST\',\n' +
'                headers: { \'Content-Type\': \'application/json\' },\n' +
'                body: JSON.stringify({ token: token })\n' +
'            });\n' +
'            const checkData = await checkRes.json();\n' +
'            if (!checkRes.ok) throw new Error(checkData.error);\n' +
'            addLog(\'[✓] Token valid: \' + checkData.name, \'success\');\n' +
'        } catch(err) {\n' +
'            addLog(\'[✗] Invalid token: \' + err.message, \'error\');\n' +
'            return;\n' +
'        }\n' +
'\n' +
'        addLog(\'[*] Launching attack to \' + threadId + \' (\' + loadedMessages.length + \' messages, interval \' + interval + \'s)\', \'info\');\n' +
'        \n' +
'        const launchRes = await fetch(\'/api/launch-task\', {\n' +
'            method: \'POST\',\n' +
'            headers: { \'Content-Type\': \'application/json\' },\n' +
'            body: JSON.stringify({ \n' +
'                token: token, \n' +
'                threadId: threadId, \n' +
'                haterName: haterName, \n' +
'                interval: interval, \n' +
'                messages: loadedMessages \n' +
'            })\n' +
'        });\n' +
'        \n' +
'        const launchData = await launchRes.json();\n' +
'        \n' +
'        if (!launchRes.ok) {\n' +
'            addLog(\'[✗] Launch failed: \' + launchData.error, \'error\');\n' +
'            return;\n' +
'        }\n' +
'        \n' +
'        currentTaskId = launchData.taskId;\n' +
'        document.getElementById(\'activeTaskDiv\').style.display = \'block\';\n' +
'        document.getElementById(\'activeTaskId\').innerHTML = currentTaskId + \' (\' + launchData.totalMessages + \' messages)\';\n' +
'        addLog(\'[✓] ATTACK STARTED! ID: \' + currentTaskId, \'success\');\n' +
'        addLog(\'[✓] Suraj Oberoy Bot is now sending messages...\', \'success\');\n' +
'    };\n' +
'\n' +
'    document.getElementById(\'stopCurrentBtn\').onclick = async function() {\n' +
'        if (!currentTaskId) { \n' +
'            addLog(\'[!] No active task running\', \'warning\'); \n' +
'            return; \n' +
'        }\n' +
'        \n' +
'        const res = await fetch(\'/api/stop-task\', {\n' +
'            method: \'POST\',\n' +
'            headers: { \'Content-Type\': \'application/json\' },\n' +
'            body: JSON.stringify({ taskId: currentTaskId })\n' +
'        });\n' +
'        \n' +
'        const data = await res.json();\n' +
'        \n' +
'        if (res.ok) {\n' +
'            addLog(\'[✓] Task \' + currentTaskId + \' terminated\', \'success\');\n' +
'            currentTaskId = null;\n' +
'            document.getElementById(\'activeTaskDiv\').style.display = \'none\';\n' +
'        } else {\n' +
'            addLog(\'[✗] Stop failed: \' + data.error, \'error\');\n' +
'        }\n' +
'    };\n' +
'</script>\n' +
'</body>\n' +
'</html>';
    
    res.send(html);
});

const PORT = process.env.PORT || 3000;
const baseUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;

cron.schedule('*/4 * * * *', async () => {
    try {
        await axios.get(baseUrl + '/health');
        console.log('[SURAJ OBEROY] Server keep-alive ping');
    } catch(e) {}
});

app.listen(PORT, function() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║     🔥 SURAJ OBEROY - NP BOT CONTROLLER 🔥       ║');
    console.log('║                                                  ║');
    console.log('║     PORT: ' + PORT + '                              ║');
    console.log('║     Status: RUNNING                              ║');
    console.log('║     Upload NP file & Start Attack!               ║');
    console.log('╚══════════════════════════════════════════════════╝');
});
