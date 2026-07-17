const { createClient } = require('bedrock-protocol');
const EventEmitter = require('events');

class SingleBot extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.connected = false;
    this.username = '';
    this.messages = [];
  }

  connect(options) {
    if (this.client) {
      try { this.client.close(); } catch (e) {}
    }

    this.connected = false;
    this.messages = [];
    this.username = options.username || 'Bot';

    try {
      this.client = createClient({
        host: options.host,
        port: parseInt(options.port) || 19132,
        username: this.username,
        offline: true,
        version: options.version || '1.21.80',
        skipValidation: true
      });

      this.client.on('join', () => {
        this.connected = true;
        this.emit('status', { connected: true, username: this.username });
        this.addMessage('system', `${this.username} joined the server`);
      });

      this.client.on('spawn', () => {
        this.addMessage('system', `${this.username} spawned`);
      });

      this.client.on('text', (packet) => {
        if (!packet) return;
        const name = packet.source_name || '';
        const text = packet.message || packet.text || '';
        if (text) {
          this.addMessage('chat', name ? `<${name}> ${text}` : text);
        }
      });

      this.client.on('disconnect', () => {
        this.connected = false;
        this.addMessage('system', 'Disconnected from server');
        this.emit('status', { connected: false });
      });

      this.client.on('error', (err) => {
        this.addMessage('error', err.message || 'Unknown error');
      });

      this.addMessage('system', `Connecting to ${options.host}:${options.port}...`);
    } catch (e) {
      this.addMessage('error', e.message);
    }
  }

  sendMessage(text) {
    if (!this.client || !this.connected) {
      this.addMessage('error', 'Bot not connected');
      return false;
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      this.addMessage('error', 'Enter a message');
      return false;
    }

    text = text.trim();

    try {
      this.client.queue('text', {
        type: 'chat',
        needs_translation: false,
        source_name: this.username,
        message: text,
        xuid: '',
        platform_chat_id: '',
        filtered_message: ''
      });
      this.addMessage('sent', text);
      return true;
    } catch (e) {
      this.addMessage('error', `Send error: ${e.message}`);
      return false;
    }
  }

  disconnect() {
    if (this.client) {
      try { this.client.close(); } catch (e) {}
    }
    this.connected = false;
    this.emit('status', { connected: false });
  }

  getStatus() {
    return {
      connected: this.connected,
      username: this.username
    };
  }

  getMessages(count = 100) {
    return this.messages.slice(-count);
  }

  addMessage(type, text) {
    const entry = { type, text, time: Date.now() };
    this.messages.push(entry);
    if (this.messages.length > 300) this.messages.shift();
    this.emit('message', entry);
  }
}

module.exports = SingleBot;
