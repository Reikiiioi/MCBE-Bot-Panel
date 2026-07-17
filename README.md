<div align="center">

# ⚡ MineDDoS v2

**The Ultimate Cloudflare-Themed Minecraft Bedrock Stress Testing Framework**

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Protocol](https://img.shields.io/badge/Bedrock_Protocol-0.14_--_1.26+-blue?style=for-the-badge&logo=minecraft)](https://github.com/PrismarineJS/bedrock-protocol)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

<br>

MineDDoS v2 is a highly optimized, modular, and cross-platform command-and-control (C2) web panel for stress-testing Minecraft Bedrock Edition servers. This major v2 update features a completely rewritten backend, a sleek monochrome "Dark Cloudflare" UI, and full support for all modern Bedrock versions.

> **Disclaimer:** This tool was created for educational purposes and authorized penetration testing. Do not use this software against servers without explicit permission from the owners.

---

## ✨ Key Features

- **🌐 Modern Web Panel:** A beautiful, responsive, monochrome UI with background animations and live interactive charts.
- **🚀 High Performance:** Powered by Node.js Worker Threads, enabling you to spawn hundreds of bots across multiple CPU cores without bottlenecking.
- **🌍 Full Localization:** Built-in dynamic i18n support for English and Russian.
- **🎮 All Bedrock Versions:** Full support for 50+ protocol versions, from `0.14.3` all the way to `1.26.30`.
- **🎨 Minecraft Color Parser:** Server logs, MOTDs, and chats are parsed and rendered with authentic `§` Minecraft colors right in your browser.
- **🤖 Manual Bot Control:** Connect a single bot manually to spy on the server chat and execute commands directly from the web panel.
- **🛡️ Crash Protection:** Enhanced RakNet connection handlers to prevent the bot pool from crashing against heavily modded or protected servers (e.g., WaterdogPE).

---

## 🛠️ Installation & Usage

**Prerequisites:**
You must have [Node.js](https://nodejs.org/) (Version 18 or higher) installed on your system.

**1. Clone the repository:**
```bash
git clone https://github.com/Reikiiioi/MineDDoS.git
cd MineDDoS
```

**2. Start the project:**
```bash
node start.js
```

**3. Interactive Setup:**
On the first launch, the installer will automatically:
- Ask for your preferred language (`en`/`ru`).
- Install all necessary `npm` dependencies.
- Prompt you to create a web panel password (or leave it blank for passwordless access).

**4. Access the Panel:**
Open your web browser and navigate to:
```
http://127.0.0.1:3000
```

---

## 📂 Architecture

MineDDoS v2 uses a strictly modular architecture:
```text
MineDDoS/
├── start.js          # Unified smart installer and launcher
├── src/
│   ├── web/          # Express.js API, Socket.io, and Web Server
│   ├── attack/       # Bot pool controller and Worker Thread logic
│   └── manual/       # Single bot module for manual chat control
├── public/           # Frontend (HTML/CSS/JS with Cloudflare aesthetics)
└── locales/          # i18n Translation files (en.json, ru.json)
```

---

## ⚙️ Optimization & Hardware Limits

Creating Minecraft client instances requires significant RAM and CPU.

- **Low-End Hardware (1 vCPU, 1GB RAM):**
  - Use 1-2 Threads.
  - Delay: 2-3 seconds minimum.
  - Recommended max bots: 20-30.
- **High-End Hardware:**
  - Use 4-8+ Threads.
  - Delay: 0.5 - 1 seconds.
  - Recommended max bots: 100+.

*Note: Servers protected by strict anti-DDoS proxies may instantly drop connections if you spawn too many bots from a single IP address.*

---

## 🤝 Credits

Developed and maintained by **[Reikiiioi](https://github.com/Reikiiioi)**.
