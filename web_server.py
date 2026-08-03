import asyncio
import json
import os
from aiohttp import web, WSMsgType
from bot_manager import BotMCBEController

class BotMCBEWebServer:
    def __init__(self, controller: BotMCBEController, port: int = 3000):
        self.controller = controller
        self.port = port
        self.app = web.Application()
        self.sockets = set()
        self._setup_routes()
        self.controller.add_listener(self._on_controller_event)

    def _setup_routes(self):
        self.app.router.add_get('/', self.handle_index)
        self.app.router.add_get('/ws', self.handle_ws)
        self.app.router.add_get('/api/status', self.handle_status)
        self.app.router.add_post('/api/start', self.handle_start)
        self.app.router.add_post('/api/stop', self.handle_stop)

    async def handle_index(self, request):
        path = os.path.join(os.path.dirname(__file__), 'web', 'index.html')
        return web.FileResponse(path)

    async def handle_status(self, request):
        return web.json_response(self.controller.get_status())

    async def handle_start(self, request):
        data = await request.json()
        res = await self.controller.start(data)
        return web.json_response(res)

    async def handle_stop(self, request):
        res = await self.controller.stop()
        return web.json_response(res)

    async def handle_ws(self, request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        self.sockets.add(ws)

        init_payload = {
            "event": "init",
            "stats": self.controller.get_status(),
            "logs": self.controller.logs[-100:]
        }
        await ws.send_str(json.dumps(init_payload))

        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    pass
        finally:
            self.sockets.discard(ws)
        return ws

    def _on_controller_event(self, payload: dict):
        msg_str = json.dumps(payload)
        for ws in list(self.sockets):
            if not ws.closed:
                asyncio.create_task(ws.send_str(msg_str))

    async def start_server(self):
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', self.port)
        await site.start()
        print(f"BotMCBE Web Dashboard (Python) started at http://localhost:{self.port}")
