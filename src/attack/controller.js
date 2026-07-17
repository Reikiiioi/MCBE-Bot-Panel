const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

class BotController extends EventEmitter {
  constructor(config, locale) {
    super();
    this.config = config;
    this.t = locale;
    this.process = null;
    this.running = false;
    this.stats = {
      totalBots: 0,
      online: 0,
      kicked: 0,
      messagesSent: 0,
      errors: 0,
      startTime: null,
      status: 'stopped'
    };
    this.logs = [];
    this.maxLogs = 500;
  }

  start(botConfigData) {
    if (this.running) {
      return { error: 'Already running' };
    }

    const rootDir = path.join(__dirname, '..', '..');
    const botScript = path.join(__dirname, 'worker.js');
    
    // We pass config via environment variables or a temporary file. 
    // Writing to a temporary config file for the bot worker:
    const fs = require('fs');
    const tempConfigPath = path.join(rootDir, 'bot_runtime_config.json');
    
    const runtimeConfig = {
      server: {
        host: botConfigData.host,
        port: parseInt(botConfigData.port),
        version: botConfigData.version
      },
      bot: {
        baseUsername: botConfigData.baseUsername,
        count: parseInt(botConfigData.count),
        threadCount: parseInt(botConfigData.threadCount)
      },
      timing: {
        delayBetweenBotsSeconds: parseFloat(botConfigData.delayBetweenBotsSeconds),
        finalDelaySeconds: parseInt(botConfigData.finalDelaySeconds)
      },
      messages: botConfigData.messages
    };
    
    fs.writeFileSync(tempConfigPath, JSON.stringify(runtimeConfig, null, 2));

    this.stats = {
      totalBots: parseInt(botConfigData.count),
      online: 0,
      kicked: 0,
      messagesSent: 0,
      errors: 0,
      startTime: Date.now(),
      status: 'running'
    };
    this.running = true;

    this.process = spawn('node', [botScript, tempConfigPath], {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    this.process.stdout.on('data', (data) => {
      const text = data.toString().trim();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('STATS:')) {
          this.parseStats(line);
        } else if (line.trim().length > 0) {
          this.addLog('info', line);
        }
      }
    });

    this.process.stderr.on('data', (data) => {
      const text = data.toString().trim();
      this.addLog('error', text);
      this.stats.errors++;
      this.emit('update', this.getStatus());
    });

    this.process.on('close', (code) => {
      this.addLog('info', `Process exited with code ${code}`);
      this.running = false;
      this.stats.status = 'stopped';
      this.emit('update', this.getStatus());
      this.process = null;
    });

    this.process.on('error', (err) => {
      this.addLog('error', `Process error: ${err.message}`);
      this.running = false;
      this.stats.status = 'error';
      this.emit('update', this.getStatus());
    });

    this.addLog('success', this.t.bot.started);
    return { success: true };
  }

  stop() {
    if (!this.running || !this.process) {
      return { error: 'Not running' };
    }
    this.process.kill('SIGTERM');
    this.addLog('warning', this.t.bot.stopped);
    this.stats.status = 'stopped';
    this.running = false;
    this.emit('update', this.getStatus());
    return { success: true };
  }

  parseStats(line) {
    // Expected formats: STATS:SPAWN:username, STATS:KICK:username, STATS:MSG:username:msg, STATS:ERR:username:err
    const parts = line.split(':');
    if (parts.length < 2) return;
    const type = parts[1];
    
    switch (type) {
      case 'SPAWN':
        this.stats.online++;
        break;
      case 'KICK':
        this.stats.online = Math.max(0, this.stats.online - 1);
        this.stats.kicked++;
        break;
      case 'MSG':
        this.stats.messagesSent++;
        break;
      case 'ERR':
        this.stats.errors++;
        break;
    }
    this.emit('update', this.getStatus());
  }

  addLog(type, message) {
    const entry = {
      type,
      message,
      time: new Date().toISOString()
    };
    
    this.logs.push(entry);          
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();            
    }
    
    this.emit('log', entry);
  }

  getStatus() {
    return {
      ...this.stats,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0
    };
  }

  getLogs(count = 100) {
    return this.logs.slice(0, count);
  }
}

module.exports = BotController;
