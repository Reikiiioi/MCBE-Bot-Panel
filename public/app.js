const socket = io();
let t = {};
let config = {};
let chart = null;
let onlineData = [];
let timeLabels = [];

const BEDROCK_VERSIONS = [
  '1.26.30',  '1.26.20',  '1.26.10',  '1.26.0',
  '1.21.130', '1.21.124', '1.21.120', '1.21.111',
  '1.21.100', '1.21.93',  '1.21.90',  '1.21.80',
  '1.21.70',  '1.21.60',  '1.21.50',  '1.21.42',
  '1.21.30',  '1.21.20',  '1.21.2',   '1.21.0',
  '1.20.80',  '1.20.71',  '1.20.61',  '1.20.50',
  '1.20.40',  '1.20.30',  '1.20.15',  '1.20.10',
  '1.20.0',   '1.19.80',  '1.19.70',  '1.19.63',
  '1.19.62',  '1.19.60',  '1.19.50',  '1.19.40',
  '1.19.30',  '1.19.21',  '1.19.20',  '1.19.10',
  '1.19.1',   '1.18.30',  '1.18.11',  '1.18.0',
  '1.17.40',  '1.17.30',  '1.17.10',  '1.17.0',
  '1.16.220', '1.16.210', '1.16.201', '1.0.0',
  '0.15.6',   '0.14.3'
];

function initVersions() {
  const cfgSel = document.getElementById('cfg-version');
  const manSel = document.getElementById('manual-version');
  if (!cfgSel || !manSel) return;
  
  let html = '';
  BEDROCK_VERSIONS.forEach(v => {
    html += `<option value="${v}">${v}</option>`;
  });
  cfgSel.innerHTML = html;
  manSel.innerHTML = html;
}

// Background Animation (Particles)
function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width, height;
  let particles = [];
  
  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  
  window.addEventListener('resize', resize);
  resize();
  
  for(let i=0; i<50; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 2 + 1
    });
  }
  
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    
    requestAnimationFrame(draw);
  }
  draw();
}

// Minecraft Color Parser
function parseColors(text) {
  if (!text) return '';
  const parts = text.split(/(§[0-9a-flonmr])/i);
  let html = '';
  let currentClasses = [];
  
  parts.forEach(part => {
    if (part.toLowerCase().startsWith('§')) {
      const code = part[1].toLowerCase();
      if (code === 'r') {
        currentClasses = [];
      } else {
        currentClasses.push(`mc-${code}`);
      }
    } else if (part.length > 0) {
      if (currentClasses.length > 0) {
        html += `<span class="${currentClasses.join(' ')}">${escapeHtml(part)}</span>`;
      } else {
        html += escapeHtml(part);
      }
    }
  });
  return html;
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function init() {
  initCanvas();
  initVersions();

  const token = localStorage.getItem('mineddos_token');
  if (!token) {
    if(window.location.pathname !== '/index.html') window.location.href = '/index.html';
    return;
  }
  
  try {
    const res = await fetch('/api/locale');
    t = await res.json();
    applyLocale();
    initChart();
  } catch (e) {
    console.error("Failed to load locales");
  }

  socket.emit('auth', { token }, (res) => {
    if (!res.success) {
      localStorage.removeItem('mineddos_token');
      window.location.href = '/index.html';
    } else {
      loadConfig();
    }
  });
}

function applyLocale() {
  const ui = t.ui;
  document.getElementById('tab-overview').innerText = ui.overview;
  document.getElementById('tab-control').innerText = ui.attack;
  document.getElementById('tab-manual').innerText = ui.manual;
  document.getElementById('title-logs').innerText = ui.logs;
  document.getElementById('tab-logout').innerText = ui.logout;
  
  document.getElementById('title-overview').innerText = ui.overview;
  document.getElementById('title-attack').innerText = ui.attack;
  document.getElementById('title-manual').innerText = ui.manual;
  
  document.getElementById('lbl-status').innerText = ui.status;
  document.getElementById('lbl-total').innerText = ui.total_bots;
  document.getElementById('lbl-online').innerText = ui.online;
  document.getElementById('lbl-kicked').innerText = ui.kicked;
  document.getElementById('lbl-msgs').innerText = ui.msgs_sent;
  document.getElementById('lbl-errors').innerText = ui.errors;
  document.getElementById('lbl-uptime').innerText = ui.uptime;
  
  document.getElementById('btn-start-attack').innerText = ui.start_attack;
  document.getElementById('btn-stop-attack').innerText = ui.stop_attack;
  document.getElementById('title-params').innerText = ui.params;
  
  document.getElementById('lbl-host').innerText = ui.host;
  document.getElementById('lbl-port').innerText = ui.port;
  document.getElementById('lbl-version').innerText = ui.version;
  document.getElementById('lbl-username').innerText = ui.username;
  document.getElementById('lbl-count').innerText = ui.count;
  document.getElementById('lbl-threads').innerText = ui.threads;
  document.getElementById('lbl-delay').innerText = ui.delay;
  document.getElementById('lbl-final-delay').innerText = ui.final_delay;
  
  document.getElementById('title-messages').innerText = ui.messages;
  document.getElementById('new-message').placeholder = ui.msg_placeholder;
  
  document.getElementById('lbl-man-user').innerText = ui.username;
  document.getElementById('lbl-man-host').innerText = ui.host;
  document.getElementById('lbl-man-port').innerText = ui.port;
  document.getElementById('lbl-man-version').innerText = ui.version;
  
  document.getElementById('btn-connect').innerText = ui.connect;
  document.getElementById('btn-disconnect').innerText = ui.disconnect;
  document.getElementById('btn-clear').innerText = ui.clear;
  
  document.getElementById('title-server-chat').innerText = ui.server_chat;
  document.getElementById('title-commands').innerText = ui.commands;
  document.getElementById('command-input').placeholder = ui.cmd_placeholder;
  document.getElementById('btn-send').innerText = ui.send;
}

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.getElementById(`tab-${tabId}`).classList.add('active');
}

function toggleLogs() {
  const panel = document.getElementById('logs-panel');
  panel.classList.toggle('open');
}

function logout() {
  localStorage.removeItem('mineddos_token');
  window.location.href = '/index.html';
}

function initChart() {
  const ctx = document.getElementById('onlineChart');
  if(!ctx) return;
  chart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: [{
        label: t.ui.online || 'Online',
        data: onlineData,
        borderColor: '#e0e0e0',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } }
      }
    }
  });
  
  setInterval(() => {
    const online = parseInt(document.getElementById('online-bots').innerText) || 0;
    const now = new Date().toLocaleTimeString();
    timeLabels.push(now);
    onlineData.push(online);
    if (timeLabels.length > 60) {
      timeLabels.shift();
      onlineData.shift();
    }
    chart.update();
  }, 1000);
}

async function loadConfig() {
  const token = localStorage.getItem('mineddos_token');
  const res = await fetch(`/api/config?token=${token}`);
  const data = await res.json();
  if (data.success) {
    config = data.config;
    document.getElementById('cfg-host').value = config.host;
    document.getElementById('cfg-port').value = config.port;
    
    const verOpt = Array.from(document.getElementById('cfg-version').options).find(o => o.value === config.version);
    if (verOpt) document.getElementById('cfg-version').value = config.version;
    
    document.getElementById('cfg-username').value = config.baseUsername;
    document.getElementById('cfg-count').value = config.count;
    document.getElementById('cfg-threads').value = config.threadCount;
    document.getElementById('cfg-delay').value = config.delayBetweenBotsSeconds;
    document.getElementById('cfg-final-delay').value = config.finalDelaySeconds;
    
    document.getElementById('manual-host').value = config.host;
    renderMessages();
  }
}

async function saveConfig() {
  config.host = document.getElementById('cfg-host').value;
  config.port = document.getElementById('cfg-port').value;
  config.version = document.getElementById('cfg-version').value;
  config.baseUsername = document.getElementById('cfg-username').value;
  config.count = document.getElementById('cfg-count').value;
  config.threadCount = document.getElementById('cfg-threads').value;
  config.delayBetweenBotsSeconds = document.getElementById('cfg-delay').value;
  config.finalDelaySeconds = document.getElementById('cfg-final-delay').value;
  
  const token = localStorage.getItem('mineddos_token');
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, config })
  });
}

function renderMessages() {
  const list = document.getElementById('messages-list');
  list.innerHTML = '';
  config.messages.forEach((msg, idx) => {
    const div = document.createElement('div');
    div.className = 'msg-item';
    div.innerHTML = `<span>${parseColors(msg)}</span> <button class="msg-del" onclick="removeMessage(${idx})">×</button>`;
    list.appendChild(div);
  });
}

function addMessage() {
  const input = document.getElementById('new-message');
  if (input.value.trim()) {
    config.messages.push(input.value.trim());
    input.value = '';
    renderMessages();
    saveConfig();
  }
}

function removeMessage(idx) {
  config.messages.splice(idx, 1);
  renderMessages();
  saveConfig();
}

function startBots() {
  saveConfig().then(() => {
    socket.emit('start', config);
  });
}

function stopBots() {
  socket.emit('stop');
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

socket.on('status', (s) => {
  document.getElementById('total-bots').innerText = s.totalBots;
  document.getElementById('online-bots').innerText = s.online;
  document.getElementById('kicked-bots').innerText = s.kicked;
  document.getElementById('messages-sent').innerText = s.messagesSent;
  document.getElementById('errors-count').innerText = s.errors;
  document.getElementById('uptime').innerText = formatTime(s.uptime);
  
  const statusEl = document.getElementById('status-text');
  statusEl.innerText = t.status[s.status] || s.status;
  
  if (s.status === 'running') {
    statusEl.style.color = 'var(--accent-success)';
  } else if (s.status === 'error') {
    statusEl.style.color = 'var(--accent-danger)';
  } else {
    statusEl.style.color = 'var(--accent-gray)';
  }
});

function appendLog(containerId, entry, isChat = false) {
  const container = document.getElementById(containerId);
  const div = document.createElement('div');
  const time = new Date(entry.time).toLocaleTimeString();
  
  const parsedText = parseColors(entry.text || entry.message);
  
  if (isChat) {
    div.className = `chat-msg msg-${entry.type}`;
    div.innerHTML = `<span class="msg-time">[${time}]</span> <span class="msg-content">${parsedText}</span>`;
  } else {
    div.className = `log-entry log-${entry.type}`;
    div.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg">${parsedText}</span>`;
  }
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

socket.on('log', (entry) => appendLog('log-container', entry));
socket.on('logs', (logs) => {
  document.getElementById('log-container').innerHTML = '';
  logs.forEach(l => appendLog('log-container', l));
});

function clearLogs() {
  document.getElementById('log-container').innerHTML = '';
}

function connectManualBot() {
  socket.emit('connect_bot', {
    host: document.getElementById('manual-host').value,
    port: document.getElementById('manual-port').value,
    version: document.getElementById('manual-version').value,
    username: document.getElementById('manual-username').value || 'ManualBot'
  });
}

function disconnectManualBot() {
  socket.emit('disconnect_bot');
}

function sendCommand() {
  const input = document.getElementById('command-input');
  const text = input.value.trim();
  if (text) {
    socket.emit('bot_command', text);
    input.value = '';
  }
}

socket.on('manual_status', (s) => {
  const dot = document.getElementById('manual-status-dot');
  const txt = document.getElementById('manual-status-text');
  if (s.connected) {
    dot.className = 'status-dot connected';
    txt.innerText = `${t.status.connected} (${s.username})`;
    txt.style.color = 'var(--accent-success)';
  } else {
    dot.className = 'status-dot disconnected';
    txt.innerText = t.status.disconnected;
    txt.style.color = 'var(--text-muted)';
  }
});

socket.on('manual_message', (entry) => {
  if (entry.type === 'chat') appendLog('server-chat', entry, true);
  else appendLog('command-chat', entry, true);
});

socket.on('manual_messages', (messages) => {
  document.getElementById('server-chat').innerHTML = '';
  document.getElementById('command-chat').innerHTML = '';
  messages.forEach(entry => {
    if (entry.type === 'chat') appendLog('server-chat', entry, true);
    else appendLog('command-chat', entry, true);
  });
});

window.onload = init;
