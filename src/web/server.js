const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const BotController = require('../attack/controller');
const SingleBot = require('../manual/single');

const rootDir = path.join(__dirname, '..', '..');
const configPath = path.join(rootDir, 'config.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Load locales
const locales = {
  en: JSON.parse(fs.readFileSync(path.join(rootDir, 'locales', 'en.json'), 'utf8')),
  ru: JSON.parse(fs.readFileSync(path.join(rootDir, 'locales', 'ru.json'), 'utf8'))
};
const lang = config.lang || 'en';
const t = locales[lang];

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const botCtrl = new BotController(config, t);
const singleBot = new SingleBot();

app.use(express.json());
app.use(express.static(path.join(rootDir, 'public')));

app.get('/api/locale', (req, res) => {
  res.json(t);
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  
  if (!config.panel.passwordHash) {
    return res.json({ success: true, token: 'auth_ok' });
  }

  if (!password) {
    return res.json({ success: false, error: 'Password required' });
  }
  if (bcrypt.compareSync(password, config.panel.passwordHash)) {
    return res.json({ success: true, token: 'auth_ok' });
  }
  return res.json({ success: false, error: 'Invalid password' });
});

app.get('/api/config', (req, res) => {
  const { token } = req.query;
  if (token !== 'auth_ok') return res.json({ success: false, error: 'Unauthorized' });
  return res.json({ success: true, config: config.botDefaults });
});

app.post('/api/config', (req, res) => {
  const { token, config: newConfig } = req.body;
  if (token !== 'auth_ok') return res.json({ success: false, error: 'Unauthorized' });
  config.botDefaults = { ...config.botDefaults, ...newConfig };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return res.json({ success: true });
});

singleBot.on('status', (status) => {
  io.emit('manual_status', status);
});

singleBot.on('message', (entry) => {
  io.emit('manual_message', entry);
});

io.on('connection', (socket) => {
  socket.on('auth', (data, callback) => {
    if (data && data.token === 'auth_ok') {
      socket.auth = true;
      socket.emit('status', botCtrl.getStatus());
      socket.emit('logs', botCtrl.getLogs(100));
      socket.emit('manual_status', singleBot.getStatus());
      socket.emit('manual_messages', singleBot.getMessages(100));
      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: false, error: 'Invalid token' });
    }
  });

  socket.on('start', (configData) => {
    if (!socket.auth) return;
    const result = botCtrl.start(configData || config.botDefaults);
    if (result.error) {
      socket.emit('log', { type: 'error', message: result.error, time: new Date().toISOString() });
    }
  });

  socket.on('stop', () => {
    if (!socket.auth) return;
    botCtrl.stop();
  });

  socket.on('getStatus', () => {
    if (!socket.auth) return;
    socket.emit('status', botCtrl.getStatus());
  });

  socket.on('connect_bot', (options) => {
    if (!socket.auth) return;
    singleBot.connect(options);
  });

  socket.on('disconnect_bot', () => {
    if (!socket.auth) return;
    singleBot.disconnect();
  });

  socket.on('bot_command', (text) => {
    if (!socket.auth) return;
    singleBot.sendMessage(text);
  });
});

botCtrl.on('update', (status) => {
  io.emit('status', status);
});

botCtrl.on('log', (entry) => {
  io.emit('log', entry);
});

server.listen(config.panel.port, '127.0.0.1', () => {
  console.log(`Panel started on http://127.0.0.1:${config.panel.port}`);
});
