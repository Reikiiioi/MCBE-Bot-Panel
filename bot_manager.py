import asyncio
import json
import random
import string
import time
from typing import Callable, Any
from r_python_bedrock_protocol import Bot, BotConfig, DeviceOS

def generate_random_prefix(length: int = 6) -> str:
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

def get_random_device() -> str:
    devices = [DeviceOS.WINDOWS, DeviceOS.ANDROID, DeviceOS.IOS, DeviceOS.NINTENDO]
    return random.choice(devices)

class BotMCBEController:
    def __init__(self):
        self.running = False
        self.stats = {
            "totalBots": 0,
            "online": 0,
            "kicked": 0,
            "messagesSent": 0,
            "errors": 0,
            "startTime": None,
            "status": "stopped"
        }
        self.logs = []
        self.max_logs = 500
        self.bots: list[Bot] = []
        self._tasks: list[asyncio.Task] = []
        self._listeners: list[Callable[[dict], None]] = []

    def add_listener(self, listener: Callable[[dict], None]):
        self._listeners.append(listener)

    def _emit(self, event_type: str, data: Any):
        payload = {"event": event_type, "data": data, "stats": self.get_status()}
        for listener in list(self._listeners):
            try:
                listener(payload)
            except Exception:
                pass

    def add_log(self, log_type: str, message: str):
        entry = {
            "type": log_type,
            "message": message,
            "time": time.strftime("%H:%M:%S")
        }
        self.logs.append(entry)
        if len(self.logs) > self.max_logs:
            self.logs.pop(0)
        self._emit("log", entry)

    def get_status( me ) -> dict:
        uptime = (time.time() - me.stats["startTime"]) if me.stats["startTime"] and me.running else 0
        res = dict(me.stats)
        res["uptime"] = round(uptime, 1)
        return res

    async def start(self, config_data: dict):
        if self.running:
            return {"error": "Already running"}

        host = config_data.get("host", "127.0.0.1")
        port = int(config_data.get("port", 19132))
        version = config_data.get("version", "1.20.80")
        base_username = config_data.get("baseUsername", "Bot")
        count = int(config_data.get("count", 10))
        delay_sec = float(config_data.get("delayBetweenBotsSeconds", 1.0))
        messages = config_data.get("messages", ["Hello!"])
        if isinstance(messages, str):
            messages = [m.strip() for m in messages.split("\n") if m.strip()]

        self.bots.clear()
        self._tasks.clear()
        self.stats = {
            "totalBots": count,
            "online": 0,
            "kicked": 0,
            "messagesSent": 0,
            "errors": 0,
            "startTime": time.time(),
            "status": "running"
        }
        self.running = True
        self.add_log("info", f"Запуск роя: {count} ботов на {host}:{port} (версия {version})")
        self._emit("update", self.get_status())

        for i in range(count):
            if not self.running:
                break
            prefix = generate_random_prefix(5)
            username = f"{prefix}_{base_username}"
            device = get_random_device()

            cfg = BotConfig(
                username=username,
                device=device,
                version=version,
                auto_reconnect=False,
                connect_timeout=10.0,
                log_level="ERROR"
            )

            bot = Bot(host, port, config=cfg)
            self.bots.append(bot)
            self._wire_bot_events(bot, username, messages)

            task = asyncio.create_task(bot.run())
            self._tasks.append(task)

            if i < count - 1 and delay_sec > 0:
                await asyncio.sleep(delay_sec)

        return {"success": True}

    def _wire_bot_events(self, bot: Bot, username: str, messages: list[str]):
        @bot.on("connect")
        def on_connect():
            self.add_log("info", f"[{username}] Подключен к серверу (RakNet)")

        @bot.on("join")
        async def on_join():
            self.stats["online"] += 1
            self.add_log("success", f"[{username}] Вход в мир выполнен!")
            self._emit("update", self.get_status())

            for msg in messages:
                if not self.running or not bot.is_connected:
                    break
                await asyncio.sleep(1.0)
                await bot.send_message(msg)
                self.stats["messagesSent"] += 1
                self.add_log("chat", f"[{username}] → {msg}")
                self._emit("update", self.get_status())

        @bot.on("disconnect")
        def on_disconnect(reason: str):
            if self.stats["online"] > 0:
                self.stats["online"] -= 1
            self.stats["kicked"] += 1
            self.add_log("warning", f"[{username}] Отключен: {reason or 'Сервер закрыл соединение'}")
            self._emit("update", self.get_status())

        @bot.on("error")
        def on_error(exc: Exception):
            self.stats["errors"] += 1
            self.add_log("error", f"[{username}] Ошибка: {exc}")
            self._emit("update", self.get_status())

    async def stop(self):
        if not self.running:
            return {"error": "Not running"}

        self.running = False
        self.add_log("warning", "Остановка роя ботов...")
        for bot in self.bots:
            try:
                await bot.stop()
            except Exception:
                pass
        for t in self._tasks:
            t.cancel()
        self.bots.clear()
        self._tasks.clear()

        self.stats["status"] = "stopped"
        self.stats["online"] = 0
        self.add_log("info", "Все боты остановлены.")
        self._emit("update", self.get_status())
        return {"success": True}
