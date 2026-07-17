const { createClient } = require('bedrock-protocol');
const fs = require('fs').promises;
const fsSync = require('fs');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

let configPath = process.argv[2];
let config;
if (configPath && fsSync.existsSync(configPath)) {
  config = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
}

async function log(message) {
  const timestamp = new Date().toISOString();
  let logMessage = `${timestamp}: ${message}`;
  try {
    await fs.appendFile('bot.log', `${logMessage}\n`, { encoding: 'utf8', flag: 'a' });
  } catch (e) {
    // Ignore logging errors to prevent crash loop
  }
}

process.on('uncaughtException', (err) => {
  console.log(`STATS:ERR:system:${err.message}`);
  log(`Global error: ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
  console.log(`STATS:ERR:system:promise_rejection`);
  log(`Global promise rejection: ${reason}`);
});

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateRandomPrefix() {
  const characters = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM0123456789';
  let prefix = '';
  for (let i = 0; i < 6; i++) {
    prefix += characters[Math.floor(Math.random() * characters.length)];
  }
  return prefix;
}

function generateUniqueIdentifiers() {
  const crypto = require('crypto');
  const clientID = crypto.randomUUID();
  const sessionID = crypto.randomBytes(16).toString('hex');
  const deviceID = crypto.randomBytes(8).toString('hex');
  const osList = ['Windows 10', 'Android 12', 'iOS 16', 'Linux Ubuntu'];
  const deviceOS = osList[Math.floor(Math.random() * osList.length)];
  const deviceModel = `Device-${Math.random().toString(36).substring(2, 8)}`;
  const xuid = crypto.randomBytes(8).toString('hex');
  return { clientID, sessionID, deviceID, deviceOS, deviceModel, xuid };
}

async function createBot(options) {
  let client;
  let retries = 3;
  const { clientID, sessionID, deviceID, deviceOS, deviceModel, xuid } = generateUniqueIdentifiers();

  while (retries > 0) {
    try {
      client = createClient({
        ...options,
        clientID,
        sessionID,
        xuid,
        profiles: {
          deviceID,
          deviceOS,
          deviceModel,
          xuid,
          userAgent: `Minecraft/${options.version} (${deviceOS})`
        }
      });
      break;
    } catch (e) {
      console.log(`STATS:ERR:${options.username}:connect_fail`);
      retries--;
      if (retries > 0) await sleep(1000);
    }
  }

  if (!client) return;

  client.on('raknet_connect', (packet) => {
    try {
      const extraInfo = packet?.extra?.toString();
      if (extraInfo) {
        const serverInfo = extraInfo.split(';');
        if (serverInfo.length >= 7) {
          log(`Server: ${serverInfo[1]}, Players: ${serverInfo[3]}/${serverInfo[4]}`);
        }
      }
    } catch (e) {
       console.log(`STATS:ERR:${options.username}:raknet_parse_error`);
    }
  });

  client.on('spawn', async () => {
    console.log(`STATS:SPAWN:${options.username}`);

    for (let i = 0; i < options.messages.length; i++) {
      try {
        const message = options.messages[i];
        client.queue('text', {
          type: 'chat',
          needs_translation: false,
          source_name: options.username,
          message: message,
          xuid: xuid,
          platform_chat_id: ''
        });
        console.log(`STATS:MSG:${options.username}:${message}`);
        if (i < options.messages.length - 1) {
          await sleep(i < 2 ? 3000 : 7000);
        }
      } catch (e) {
        console.log(`STATS:ERR:${options.username}:${e.message}`);
      }
    }
    
    // Config could be undefined if run manually without config, fallback to default 30
    const delay = config?.timing?.finalDelaySeconds || 30;
    await sleep(delay * 1000);
    client.close();
  });

  client.on('error', (err) => {
    console.log(`STATS:ERR:${options.username}:${err.message}`);
  });

  client.on('kick', (reason) => {
    console.log(`STATS:KICK:${options.username}`);
    // Optional: reconnect logic here
    // createBot(options);
  });

  client.on('packet_error', (err) => {
    // Suppress heavy logging to console to avoid lag, just log to file
    log(`Packet error for ${options.username}: ${err.message}`);
  });
}

if (!isMainThread) {
  const { botOptions, botCount, delaySeconds } = workerData;
  // Make config available in worker
  configPath = workerData.configPath;
  if (configPath && fsSync.existsSync(configPath)) {
    config = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
  }

  (async () => {
    for (let i = 0; i < botCount; i++) {
      const randomPrefix = generateRandomPrefix();
      const options = {
        ...botOptions,
        username: `${randomPrefix}${botOptions.baseUsername}`
      };
      await createBot(options);
      const randomDelay = delaySeconds * 1000 + Math.random() * 200;
      await sleep(randomDelay);
    }
    parentPort.postMessage('done');
  })();
} else {
  if (!config) {
    console.log("No config provided. Exiting.");
    process.exit(1);
  }

  (async () => {
    try {
      const botsPerThread = Math.ceil(config.bot.count / config.bot.threadCount);
      const workers = [];
      for (let t = 0; t < config.bot.threadCount; t++) {
        const count = Math.min(botsPerThread, config.bot.count - t * botsPerThread);
        if (count <= 0) break;
        workers.push(new Promise((resolve) => {
          const worker = new Worker(__filename, {
            workerData: {
              botOptions: {
                host: config.server.host,
                port: config.server.port,
                baseUsername: config.bot.baseUsername,
                offline: true,
                version: config.server.version,
                messages: config.messages
              },
              botCount: count,
              delaySeconds: config.timing.delayBetweenBotsSeconds,
              configPath: configPath
            }
          });
          worker.on('message', () => resolve());
          worker.on('error', (err) => {
            console.log(`STATS:ERR:thread_${t}:${err.message}`);
            resolve();
          });
        }));
      }
      await Promise.all(workers);
      console.log('All threads finished initiating bots');
    } catch (e) {
      console.error(`Main thread error: ${e.message}`);
    }
  })();
}
