import asyncio
import json
import os
import sys
import webbrowser
from bot_manager import BotMCBEController
from web_server import BotMCBEWebServer

async def main():
    root = os.path.dirname(__file__)
    config_path = os.path.join(root, 'config.json')

    port = 3000
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
                port = cfg.get('panel', {}).get('port', 3000)
        except Exception:
            pass

    controller = BotMCBEController()
    server = BotMCBEWebServer(controller, port=port)

    print("=" * 60)
    print(f"  BotMCBE (Python Edition) — High-Performance Swarm Controller")
    print(f"  Web Panel: http://localhost:{port}")
    print("=" * 60)

    await server.start_server()

    try:
        webbrowser.open(f"http://localhost:{port}")
    except Exception:
        pass

    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("\nОстановка панели управления BotMCBE...")
        await controller.stop()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
