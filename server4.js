const express = require('express');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head><title>Suraj Oberoy - User Token Loader</title>
<style>
body { background: #0a0f0a; color: #0f0; font-family: monospace; padding: 20px; }
.card { background: #0c0f0c; border: 1px solid #0f0; border-radius: 20px; padding: 20px; max-width: 800px; margin: auto; }
input, textarea, button { width: 100%; margin: 10px 0; padding: 10px; background: #000; color: #0f0; border: 1px solid #0f0; }
button { cursor: pointer; }
.log { background: #030703; height: 200px; overflow-y: auto; padding: 10px; margin-top: 10px; }
</style>
</head>
<body>
<div class="card">
<h2>🔥 SURAJ OBEROY - USER TOKEN LOADER 🔥</h2>
<p><strong>Note:</strong> User token se group message bhejna official API mein possible nahi hai. Yeh sirf token check aur single message send kar sakta hai (apne profile se).</p>
<label>User Token (EAAD/EAAA):</label>
<input type="text" id="token" placeholder="Paste your token here">
<button id="checkBtn">🔍 Check Token</button>
<pre id="result" style="background:#000; padding:10px; overflow:auto;"></pre>
<hr>
<label>Recipient ID (User ID or Page ID):</label>
<input type="text" id="recipient" placeholder="e.g., 1000123456789">
<label>Message:</label>
<textarea id="message" rows="3"></textarea>
<button id="sendBtn">📤 Send Message</button>
<div id="log" class="log">✅ Ready. Paste your token and check first.</div>
</div>
<script>
const logDiv = document.getElementById('log');
function addLog(msg, isErr) {
  const p = document.createElement('div');
  p.style.color = isErr ? '#f88' : '#8f8';
  p.innerText = new Date().toLocaleTimeString() + ' ' + msg;
  logDiv.appendChild(p);
  logDiv.scrollTop = logDiv.scrollHeight;
}
document.getElementById('checkBtn').onclick = async () => {
  const token = document.getElementById('token').value.trim();
  if (!token) return addLog('❌ Enter token', true);
  addLog('🔍 Checking token...');
  try {
    const res = await fetch('/api/check-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('result').innerText = JSON.stringify(data, null, 2);
    addLog('✅ Token valid: ' + data.name);
  } catch(e) { addLog('❌ ' + e.message, true); }
};
document.getElementById('sendBtn').onclick = async () => {
  const token = document.getElementById('token').value.trim();
  const recipient = document.getElementById('recipient').value.trim();
  const message = document.getElementById('message').value.trim();
  if (!token || !recipient || !message) return addLog('❌ All fields required', true);
  addLog('📤 Sending message...');
  try {
    const res = await fetch('/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, recipient_id: recipient, message })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    addLog('✅ Message sent! ID: ' + (data.message_id || 'success'));
  } catch(e) { addLog('❌ Failed: ' + e.message, true); }
};
</script>
</body>
</html>`);
});

app.post('/api/check-token', async (req, res) => {
  const { token } = req.body;
  try {
    const { data } = await axios.get('https://graph.facebook.com/v20.0/me', {
      params: { access_token: token, fields: 'id,name,email' }
    });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

app.post('/api/send-message', async (req, res) => {
  const { token, recipient_id, message } = req.body;
  try {
    const payload = { recipient: { id: recipient_id }, message: { text: message } };
    const response = await axios.post('https://graph.facebook.com/v20.0/me/messages', payload, {
      params: { access_token: token }
    });
    res.json({ success: true, message_id: response.data.message_id });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'OK' }));

const PORT = process.env.PORT || 3000;
const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
cron.schedule('*/4 * * * *', async () => {
  try { await axios.get(`${baseUrl}/health`); console.log('keep-alive ping'); } catch(e) {}
});

app.listen(PORT, () => console.log(`🔥 Suraj Oberoy server running on port ${PORT}`));