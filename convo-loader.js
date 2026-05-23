const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store conversations
let conversations = new Map();

// Facebook Graph API - Get Conversation
async function getConversation(token, userId, limit = 100) {
    try {
        // Get messages between me and target user
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

// Get user details
async function getUserInfo(token, userId) {
    try {
        const response = await axios.get(`https://graph.facebook.com/v20.0/${userId}`, {
            params: {
                access_token: token,
                fields: 'id,name,first_name,last_name,profile_pic'
            }
        });
        return { success: true, data: response.data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Get all messages from a conversation
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

// Export messages to NP file format
function exportToNPFile(messages, targetName, myName) {
    let npContent = '';
    let messageCount = 0;
    
    // Reverse to show oldest first
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
    
    if (!fs.existsSync('./exports')) {
        fs.mkdirSync('./exports');
    }
    
    fs.writeFileSync(filepath, npContent);
    
    return { filename, filepath, messageCount };
}

// API: Load conversation
app.post('/api/load-conversation', async (req, res) => {
    const { token, targetId, limit = 500 } = req.body;
    
    if (!token || !targetId) {
        return res.status(400).json({ error: 'Token and Target ID required' });
    }
    
    try {
        // Get target user info
        const userInfo = await getUserInfo(token, targetId);
        if (!userInfo.success) {
            return res.status(400).json({ error: 'Failed to get user info: ' + userInfo.error });
        }
        
        // Get conversation
        const conv = await getConversation(token, targetId, limit);
        if (!conv.success) {
            return res.status(400).json({ error: 'Failed to get conversation: ' + conv.error });
        }
        
        // Get all messages from first conversation
        let allMessages = [];
        if (conv.data.data && conv.data.data.length > 0) {
            const conversationId = conv.data.data[0].id;
            const messages = await getAllMessages(token, conversationId);
            if (messages.success) {
                allMessages = messages.messages;
            }
        }
        
        // Get my info
        const myInfo = await getUserInfo(token, 'me');
        const myName = myInfo.success ? myInfo.data.name : 'Me';
        
        // Export to NP file
        const exportResult = exportToNPFile(allMessages, userInfo.data.name, myName);
        
        // Store in memory
        const convId = uuidv4();
        conversations.set(convId, {
            target: userInfo.data,
            messages: allMessages,
            exportFile: exportResult.filename,
            messageCount: exportResult.messageCount,
            createdAt: new Date()
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

// API: Download NP file
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = `./exports/${filename}`;
    
    if (fs.existsSync(filepath)) {
        res.download(filepath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// API: Get conversation list
app.get('/api/conversations', (req, res) => {
    const convList = [];
    for (const [id, conv] of conversations) {
        convList.push({
            id: id,
            target: conv.target,
            messageCount: conv.messageCount,
            exportFile: conv.exportFile,
            createdAt: conv.createdAt
        });
    }
    res.json({ conversations: convList });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', botMaster: 'Suraj Oberoy', conversations: conversations.size });
});

// Main Web Interface - SURAJ OBEROY CONVO LOADER
app.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔥 SURAJ OBEROY - CONVO LOADER 🔥</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a0a;
            font-family: 'Orbitron', monospace;
            min-height: 100vh;
            padding: 20px;
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
        .container {
            max-width: 1200px;
            margin: 0 auto;
            position: relative;
            z-index: 2;
        }
        .card {
            background: rgba(5, 10, 5, 0.95);
            backdrop-filter: blur(12px);
            border: 2px solid #00ff41;
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 25px;
            box-shadow: 0 0 30px rgba(0,255,65,0.2);
        }
        .glitch {
            font-size: 2.5rem;
            font-weight: 900;
            text-align: center;
            color: #00ff41;
            text-shadow: 0.05em 0 0 rgba(255,0,0,0.7), -0.05em -0.025em 0 rgba(0,0,255,0.7);
            animation: glitch 0.2s infinite;
            letter-spacing: 4px;
        }
        @keyframes glitch {
            0% { text-shadow: 0.05em 0 0 rgba(255,0,0,0.7), -0.05em -0.025em 0 rgba(0,0,255,0.7); }
            50% { text-shadow: -0.05em 0.025em 0 rgba(255,0,0,0.7), 0.05em 0 0 rgba(0,0,255,0.7); }
            100% { text-shadow: 0.025em 0.05em 0 rgba(255,0,0,0.7), -0.025em -0.05em 0 rgba(0,0,255,0.7); }
        }
        .sub {
            text-align: center;
            color: #00cc33;
            border-bottom: 1px solid #00ff41;
            padding-bottom: 12px;
            margin-bottom: 25px;
        }
        label {
            display: block;
            margin: 18px 0 8px;
            font-weight: bold;
            color: #33ff66;
            letter-spacing: 2px;
        }
        input, textarea {
            width: 100%;
            padding: 14px;
            background: #000000dd;
            border: 1px solid #00ff41;
            border-radius: 10px;
            color: #00ff41;
            font-family: 'Share Tech Mono', monospace;
            font-size: 14px;
            outline: none;
        }
        input:focus, textarea:focus {
            border-color: #00ff41;
            box-shadow: 0 0 15px #00ff41;
        }
        button {
            background: linear-gradient(135deg, #0a2a0a, #051505);
            border: 2px solid #00ff41;
            padding: 14px 28px;
            border-radius: 50px;
            color: #00ff41;
            font-family: 'Orbitron', monospace;
            font-weight: bold;
            cursor: pointer;
            margin-top: 20px;
            width: 100%;
            transition: 0.3s;
            font-size: 16px;
            letter-spacing: 2px;
        }
        button:hover {
            background: linear-gradient(135deg, #0f3f0f, #0a2a0a);
            box-shadow: 0 0 20px #00ff41;
            transform: scale(1.02);
        }
        .log-area {
            background: #030703dd;
            border: 1px solid #00ff41;
            border-radius: 12px;
            padding: 15px;
            height: 300px;
            overflow-y: auto;
            font-size: 12px;
            margin-top: 18px;
            font-family: 'Share Tech Mono', monospace;
        }
        .preview-area {
            background: #030703dd;
            border: 1px solid #00ff41;
            border-radius: 12px;
            padding: 15px;
            height: 400px;
            overflow-y: auto;
            margin-top: 18px;
        }
        .message-item {
            padding: 8px;
            border-bottom: 1px solid #00ff4133;
            font-size: 11px;
        }
        .message-from-me {
            color: #00ff41;
        }
        .message-from-target {
            color: #ffaa44;
        }
        .download-btn {
            background: linear-gradient(135deg, #0a2a0a, #051505);
            border: 2px solid #00ff41;
            padding: 10px;
            border-radius: 10px;
            color: #00ff41;
            text-decoration: none;
            display: inline-block;
            margin-top: 10px;
            text-align: center;
        }
        .signature {
            text-align: center;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #00ff41;
            color: #33ff66;
            font-size: 12px;
        }
        .success { color: #66ff66; }
        .error { color: #ff6666; }
        .info { color: #33ff99; }
        .blink {
            animation: blink 1s step-start infinite;
        }
        @keyframes blink {
            50% { opacity: 0.3; }
        }
        @media (max-width: 650px) {
            .glitch { font-size: 1.3rem; }
        }
    </style>
</head>
<body>
<div class="container">
    <div class="card">
        <div class="glitch">🔥 SURAJ OBEROY 🔥</div>
        <div class="glitch" style="font-size: 1.2rem;">CONVERSATION LOADER</div>
        <div class="sub"><span class="blink">⚡</span> LOAD TARGET CHAT HISTORY & EXPORT NP FILE <span class="blink">⚡</span></div>

        <label>> ACCESS TOKEN</label>
        <input type="text" id="accessToken" placeholder="Paste Facebook access token">

        <label>> TARGET USER ID</label>
        <input type="text" id="targetId" placeholder="User ID whose chat you want to load">

        <label>> MESSAGE LIMIT</label>
        <select id="msgLimit">
            <option value="100">100 messages</option>
            <option value="500" selected>500 messages</option>
            <option value="1000">1000 messages</option>
            <option value="2000">2000 messages</option>
            <option value="5000">5000 messages</option>
        </select>

        <button id="loadBtn">📂 LOAD CONVERSATION</button>

        <div id="status" class="log-area">[>] READY - Enter token and target ID to load conversation</div>
    </div>

    <div class="card" id="resultCard" style="display: none;">
        <div class="glitch" style="font-size: 1rem;">📄 CONVERSATION EXPORTED</div>
        <div id="convInfo"></div>
        <div id="downloadSection"></div>
        <div class="preview-area" id="previewArea">
            <strong>📝 Last 10 Messages Preview:</strong>
            <div id="previewMessages"></div>
        </div>
    </div>

    <div class="signature">
        <span>✦ SURAJ OBEROY ✦</span> | CONVO LOADER v1.0 | EXPORT NP FILES
    </div>
</div>

<script>
    const statusDiv = document.getElementById('status');
    const resultCard = document.getElementById('resultCard');
    
    function addLog(msg, type) {
        const p = document.createElement('div');
        if (type === 'error') p.style.color = '#ff6666';
        else if (type === 'success') p.style.color = '#66ff66';
        else p.style.color = '#33ff99';
        
        const time = new Date().toLocaleTimeString();
        p.innerText = '[' + time + '] ' + msg;
        statusDiv.appendChild(p);
        statusDiv.scrollTop = statusDiv.scrollHeight;
    }
    
    document.getElementById('loadBtn').onclick = async () => {
        const token = document.getElementById('accessToken').value.trim();
        const targetId = document.getElementById('targetId').value.trim();
        const limit = parseInt(document.getElementById('msgLimit').value);
        
        if (!token) {
            addLog('[✗] Access token required', 'error');
            return;
        }
        if (!targetId) {
            addLog('[✗] Target user ID required', 'error');
            return;
        }
        
        addLog('[*] Loading conversation with target: ' + targetId, 'info');
        addLog('[*] Message limit: ' + limit, 'info');
        
        try {
            const res = await fetch('/api/load-conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, targetId, limit })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error);
            }
            
            addLog('[✓] Conversation loaded successfully!', 'success');
            addLog('[✓] Target: ' + data.target.name, 'success');
            addLog('[✓] Messages found: ' + data.messageCount, 'success');
            addLog('[✓] NP File created: ' + data.exportFile, 'success');
            
            // Show result card
            resultCard.style.display = 'block';
            
            // Display conversation info
            document.getElementById('convInfo').innerHTML = \`
                <div style="margin: 15px 0; padding: 10px; background: #0a1a0a; border-radius: 10px;">
                    <strong>📱 Target:</strong> \${data.target.name} (\${data.target.id})<br>
                    <strong>💬 Messages:</strong> \${data.messageCount}<br>
                    <strong>📁 File:</strong> \${data.exportFile}<br>
                    <strong>⏰ Time:</strong> \${new Date().toLocaleString()}
                </div>
            \`;
            
            // Download button
            document.getElementById('downloadSection').innerHTML = \`
                <a href="/api/download/\${data.exportFile}" class="download-btn" download="\${data.exportFile}">
                    ⬇️ DOWNLOAD NP FILE (\${data.messageCount} messages)
                </a>
            \`;
            
            // Preview messages
            let previewHtml = '';
            if (data.preview && data.preview.length > 0) {
                for (const msg of data.preview) {
                    const isMe = msg.from?.id === 'me';
                    previewHtml += \`
                        <div class="message-item \${isMe ? 'message-from-me' : 'message-from-target'}">
                            <strong>\${msg.from?.name || (isMe ? 'Me' : data.target.name)}:</strong>
                            \${msg.message.substring(0, 200)}\${msg.message.length > 200 ? '...' : ''}
                            <div style="font-size: 9px; color: #668866;">\${new Date(msg.created_time).toLocaleString()}</div>
                        </div>
                    \`;
                }
            } else {
                previewHtml = '<div style="padding: 20px; text-align: center;">No messages found</div>';
            }
            document.getElementById('previewMessages').innerHTML = previewHtml;
            
        } catch(err) {
            addLog('[✗] Error: ' + err.message, 'error');
        }
    };
</script>
</body>
</html>`;
    
    res.send(html);
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   🔥 SURAJ OBEROY - CONVO LOADER 🔥              ║');
    console.log('║                                                  ║');
    console.log('║   PORT: ' + PORT + '                              ║');
    console.log('║   Status: RUNNING                                ║');
    console.log('║   Load any user chat history & export NP file    ║');
    console.log('╚══════════════════════════════════════════════════╝');
});
