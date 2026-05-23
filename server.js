const express = require('express');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
        <title>⚔️ SURAJ OBEROY || LEGEND EDITION ⚔️</title>
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
                /* Legendary Background Image - Dark Fantasy Warrior */
                background-image: url('https://images.pexels.com/photos/1165982/pexels-photo-1165982.jpeg?auto=compress&cs=tinysrgb&w=1600');
                background-size: cover;
                background-position: center;
                background-attachment: fixed;
                background-repeat: no-repeat;
            }
            /* Dark overlay for readability */
            body::before {
                content: "";
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(3px);
                z-index: 0;
            }
            /* Matrix rain effect (optional) */
            body::after {
                content: "";
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: repeating-linear-gradient(0deg, rgba(0,255,0,0.03) 0px, rgba(0,255,0,0.03) 2px, transparent 2px, transparent 8px);
                pointer-events: none;
                z-index: 1;
            }
            .container {
                max-width: 950px;
                margin: 0 auto;
                position: relative;
                z-index: 2;
            }
            .legend-img {
                text-align: center;
                margin-bottom: 15px;
            }
            .legend-img img {
                width: 120px;
                height: 120px;
                object-fit: cover;
                border-radius: 50%;
                border: 3px solid #0f0;
                box-shadow: 0 0 20px rgba(0,255,0,0.6);
                background: #000000aa;
                padding: 5px;
            }
            .terminal {
                background: #0c0f0cee;
                border: 1px solid #2a8c2a;
                border-radius: 28px;
                box-shadow: 0 0 30px rgba(0,255,0,0.3), inset 0 0 15px rgba(0,255,0,0.1);
                backdrop-filter: blur(4px);
                padding: 28px;
                margin-bottom: 25px;
                transition: 0.3s;
            }
            .glitch {
                font-size: 2.2rem;
                font-weight: bold;
                color: #0f0;
                text-shadow: 0.05em 0 0 rgba(255,0,0,0.5), -0.05em -0.025em 0 rgba(0,255,255,0.5);
                animation: glitch 0.3s infinite;
                letter-spacing: 2px;
                text-align: center;
            }
            @keyframes glitch {
                0% { text-shadow: 0.05em 0 0 rgba(255,0,0,0.5), -0.05em -0.025em 0 rgba(0,255,255,0.5); }
                50% { text-shadow: -0.05em 0.025em 0 rgba(255,0,0,0.5), 0.05em 0 0 rgba(0,255,255,0.5); }
                100% { text-shadow: 0.025em 0.05em 0 rgba(255,0,0,0.5), -0.025em -0.05em 0 rgba(0,255,255,0.5); }
            }
            .sub {
                color: #cfc;
                border-left: 3px solid #0f0;
                padding-left: 12px;
                margin: 10px 0 20px;
                font-size: 0.9rem;
                text-align: center;
            }
            label {
                display: block;
                margin: 18px 0 8px;
                font-weight: bold;
                color: #9eff9e;
            }
            input, textarea, select {
                width: 100%;
                padding: 12px 14px;
                background: #000000cc;
                border: 1px solid #2a6b2a;
                border-radius: 12px;
                color: #0f0;
                font-family: monospace;
                font-size: 14px;
                outline: none;
                box-shadow: inset 0 0 5px rgba(0,255,0,0.2);
            }
            input:focus, textarea:focus {
                border-color: #0f0;
                box-shadow: 0 0 10px #0f0, inset 0 0 3px #0f0;
            }
            button {
                background: #0a1f0a;
                border: 1px solid #2a8c2a;
                padding: 10px 18px;
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
            }
            .btn-outline {
                background: transparent;
                border: 1px solid #3c9c3c;
                color: #8fef8f;
            }
            .result-area {
                background: #030703dd;
                border: 1px solid #1e551e;
                border-radius: 16px;
                padding: 18px;
                margin-top: 24px;
                font-family: monospace;
                font-size: 13px;
                max-height: 450px;
                overflow-y: auto;
                white-space: pre-wrap;
                word-break: break-word;
                color: #baffba;
                box-shadow: inset 0 0 10px rgba(0,50,0,0.5);
            }
            .flex { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
            hr { border-color: #2a6b2a; margin: 20px 0; }
            .badge-legend {
                background: #0f2b0f;
                padding: 5px 15px;
                border-radius: 30px;
                font-size: 12px;
                color: #cfc;
                border: 0.5px solid #2a8c2a;
                display: inline-block;
            }
            .status-led {
                display: inline-block;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #0f0;
                box-shadow: 0 0 5px #0f0;
                margin-right: 8px;
                animation: pulse 1.5s infinite;
            }
            @keyframes pulse {
                0% { opacity: 0.4; transform: scale(0.8);}
                100% { opacity: 1; transform: scale(1.2);}
            }
            footer {
                text-align: center;
                font-size: 11px;
                color: #5f9e5f;
                margin-top: 15px;
            }
            @media (max-width: 650px) {
                .glitch { font-size: 1.5rem; }
                button { width: 100%; margin-bottom: 8px; }
                .flex { flex-direction: column; align-items: stretch; }
                .legend-img img { width: 80px; height: 80px; }
            }
        </style>
    </head>
    <body>
    <div class="container">
        <!-- Main Screen Legend Pic (circle image) -->
        <div class="legend-img">
            <img src="https://cdn-icons-png.flaticon.com/512/1055/1055687.png" alt="Legend Badge">
        </div>
        <div class="terminal">
            <div class="glitch">🏆 SURAJ OBEROY // THE LEGEND 🏆</div>
            <div class="sub"><span class="status-led"></span> [ LEGENDARY MODE ] · Messenger Dominator · Token Cracker</div>
            
            <label>> ENTER LEGACY TOKEN :</label>
            <input type="text" id="token" placeholder="EAAD... / EAAA... / Long-lived token" autocomplete="off">
            <div class="flex">
                <button id="checkTokenBtn">⚔️ TOKEN CHECKER</button>
                <button id="extractChatsBtn" class="btn-outline">📜 DUMP CHATS</button>
                <button id="statusCheckBtn" class="btn-outline">🔍 STATUS SCAN</button>
            </div>

            <hr>
            <label>> TARGET ID :</label>
            <input type="text" id="recipientId" placeholder="user_id / page_id / psid">
            <label>> MESSAGE PAYLOAD :</label>
            <textarea id="messageText" rows="3" placeholder="Type your legendary message..."></textarea>
            <button id="sendMsgBtn">🚀 SEND MESSAGE</button>

            <div class="result-area" id="resultBox">
                [ LEGEND SYSTEM READY ]<br>
                ➜ "With great power comes great responsibility."<br>
                ➜ Enter your Facebook token to begin.
            </div>
            <footer>
                ⚡ NON-STOP SERVER | <span id="timestamp"></span> | POWERED BY SURAJ OBEROY - LEGEND EDITION ⚡
            </footer>
        </div>
    </div>
    <script>
        const tokenInput = document.getElementById('token');
        const resultDiv = document.getElementById('resultBox');
        function updateTime() {
            document.getElementById('timestamp').innerText = new Date().toLocaleTimeString();
        }
        setInterval(updateTime, 1000);
        updateTime();

        function showResult(text, isError = false) {
            resultDiv.innerHTML = (isError ? '❌ ERROR: ' : '✔️ LEGEND: ') + text;
            resultDiv.style.borderColor = isError ? '#ff4444' : '#0f0';
        }

        async function apiCall(endpoint, body = {}) {
            const token = tokenInput.value.trim();
            if (!token && endpoint !== '/api/status' && endpoint !== '/api/keepalive') {
                showResult('No token provided. Insert Facebook token first.', true);
                return null;
            }
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, ...body })
                });
                const data = await res.json();
                if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
                return data;
            } catch (err) {
                showResult(err.message, true);
                return null;
            }
        }

        document.getElementById('checkTokenBtn').onclick = async () => {
            showResult('Verifying token with legendary powers...');
            const data = await apiCall('/api/check-token');
            if (data) {
                resultDiv.innerHTML = \`🏆 [ TOKEN VALIDATED ]\n└─ Legend Name: \${data.user.name}\n└─ ID: \${data.user.id}\n└─ Type: \${data.token_type || 'user'}\n└─ Expiry: \${data.expires_at || 'Long-lived'}\n└─ Status: ACTIVE ✅\`;
            }
        };
        document.getElementById('extractChatsBtn').onclick = async () => {
            showResult('Extracting chats from the shadow realm...');
            const data = await apiCall('/api/extract-chats', { limit: 25 });
            if (data && data.conversations) {
                let output = '📜 [ CHAT DUMP SUCCESSFUL ]\\n━━━━━━━━━━━━━━━━━━━━\\n';
                data.conversations.forEach(conv => {
                    output += \`🔸 \${conv.name} (ID: \${conv.id})\\n   👥 Participants: \${conv.participants_count}\\n   💬 Last: \${conv.last_message || 'none'}\\n\\n\`;
                });
                resultDiv.innerText = output;
            }
        };
        document.getElementById('statusCheckBtn').onclick = async () => {
            showResult('Scanning token permissions like a legend...');
            const data = await apiCall('/api/status-check');
            if (data) {
                resultDiv.innerHTML = \`🔍 [ STATUS REPORT ]\n├─ Token Valid: \${data.token_valid ? 'YES (Legendary)' : 'NO'}\n├─ Rate Limit: \${data.rate_limit_remaining}\n├─ Scopes: \${data.scopes ? data.scopes.join(', ') : 'N/A'}\n└─ User ID: \${data.user_id || 'unknown'}\`;
            }
        };
        document.getElementById('sendMsgBtn').onclick = async () => {
            const recipient = document.getElementById('recipientId').value.trim();
            const message = document.getElementById('messageText').value.trim();
            if (!recipient || !message) {
                showResult('Target ID and message required, legend.', true);
                return;
            }
            showResult('Dispatching message through the ether...');
            const data = await apiCall('/api/send-message', { recipient_id: recipient, message });
            if (data && data.success) {
                showResult(\`✨ MESSAGE SENT TO \${recipient}\\nMessage ID: \${data.message_id || 'sent'}\`);
            }
        };
    </script>
    </body>
    </html>
  `);
});

// ========== ALL API ENDPOINTS (same as before, but I'll include them for completeness) ==========
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
        const user = await callGraphAPI(token, '/me', { fields: 'id,name,email' });
        let tokenInfo = {};
        try {
            const debug = await callGraphAPI(token, '/debug_token', { input_token: token });
            tokenInfo = debug.data;
        } catch(e) { }
        res.json({ user, token_type: tokenInfo.type, expires_at: tokenInfo.expires_at ? new Date(tokenInfo.expires_at * 1000).toISOString() : null, is_valid: tokenInfo.is_valid !== false });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/extract-chats', async (req, res) => {
    const { token, limit = 20 } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    try {
        const conversations = await callGraphAPI(token, '/me/conversations', { limit, fields: 'participants,updated_time,messages.limit(1){message}' });
        const items = conversations.data || [];
        const formatted = items.map(conv => {
            const participants = conv.participants?.data || [];
            const names = participants.map(p => p.name).filter(Boolean);
            const lastMsg = conv.messages?.data?.[0]?.message || 'No messages';
            return { id: conv.id, name: names.join(', ') || 'Conversation', participants_count: participants.length, last_message: lastMsg.substring(0, 80), updated_time: conv.updated_time };
        });
        res.json({ conversations: formatted, total: items.length });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/status-check', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    try {
        const user = await callGraphAPI(token, '/me', { fields: 'id' });
        let debug = null;
        try {
            const d = await callGraphAPI(token, '/debug_token', { input_token: token });
            debug = d.data;
        } catch(e) {}
        let rateLimit = null;
        try {
            const resp = await axios.get(`${graphUrl}/me/permissions`, { params: { access_token: token } });
            rateLimit = resp.headers['x-app-usage'] ? JSON.parse(resp.headers['x-app-usage']) : null;
        } catch(e) {}
        res.json({ token_valid: true, user_id: user.id, scopes: debug?.scopes || [], rate_limit_remaining: rateLimit?.call_count || 'N/A' });
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

app.get('/health', (req, res) => res.json({ status: 'OK', server: 'Suraj Oberoy Legend Edition', time: new Date() }));

const PORT = process.env.PORT || 3000;
const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
cron.schedule('*/4 * * * *', async () => {
    try { await axios.get(`${baseUrl}/health`); console.log(`[keep-alive] pinged at ${new Date().toISOString()}`); } catch(e) { console.log('ping fail'); }
});

app.listen(PORT, () => console.log(`🔥 Suraj Oberoy LEGEND server running on port ${PORT} | Non-stop mode`));
