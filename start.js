const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const root = __dirname;
const configPath = path.join(root, 'config.json');
const localesDir = path.join(root, 'locales');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function run(cmd, cwd) {
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
  } catch (e) {}
}

function loadLocales() {
  try {
    return {
      en: JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8')),
      ru: JSON.parse(fs.readFileSync(path.join(localesDir, 'ru.json'), 'utf8'))
    };
  } catch (e) {
    console.error("Locales not found. Make sure locales/en.json and locales/ru.json exist.");
    process.exit(1);
  }
}

function isFirstRun() {
  return !fs.existsSync(configPath);
}

async function setup() {
  const locales = loadLocales();
  console.log("Welcome to MineDDoS / Добро пожаловать в MineDDoS");
  
  return new Promise((resolve) => {
    rl.question(locales.ru.setup.choose_lang, (langInput) => {
      const lang = (langInput.trim().toLowerCase() === 'ru') ? 'ru' : 'en';
      const t = locales[lang].setup;
      
      console.log(t.welcome);
      
      if (!fs.existsSync(path.join(root, 'node_modules'))) {
        console.log(t.deps_installing);
        run('npm install', root);
        console.log(t.deps_installed);
      }

      rl.question(t.pass_prompt, (password) => {
        const pwd = password ? password.trim() : "";
        if (!pwd) {
          console.log("No password set. The panel will be accessible without a password.");
        }
        
        const bcrypt = require('bcryptjs');
        const crypto = require('crypto');
        const salt = bcrypt.genSaltSync(10);
        
        const config = {
          lang: lang,
          panel: {
            port: 3000,
            passwordHash: pwd ? bcrypt.hashSync(pwd, salt) : "",
            sessionSecret: crypto.randomBytes(32).toString('hex')
          },
          botDefaults: {
            host: "localhost",
            port: 19132,
            version: "1.21.80",
            baseUsername: "Bot",
            count: 10,
            threadCount: 1,
            delayBetweenBotsSeconds: 1,
            finalDelaySeconds: 30,
            messages: ["Hello!"]
          }
        };
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(t.done);
        rl.close();
        resolve();
      });
    });
  });
}

(async () => {
  console.log('MineDDoS v2');

  if (isFirstRun()) {
    await setup();
  } else {
    if (!fs.existsSync(path.join(root, 'node_modules'))) {
      console.log('Installing missing dependencies...');
      run('npm install', root);
    }
  }

  const serverProcess = spawn('node', ['src/web/server.js'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env }
  });

  serverProcess.on('close', (code) => {
    console.log(`Server exited with code ${code}`);
    process.exit(code);
  });

  process.on('SIGINT', () => {
    serverProcess.kill('SIGINT');
    process.exit(0);
  });
})();