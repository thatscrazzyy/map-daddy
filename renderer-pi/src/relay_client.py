import json
import threading
import time
import websocket


class RelayClient:
    def __init__(self, url, code, session_secret, callbacks):
        self.url = url
        self.code = code
        self.session_secret = session_secret
        self.callbacks = callbacks
        self.ws = None
        self.running = False
        self.thread = None

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.ws:
            self.ws.close()

    def send_status(self, status):
        if self.ws and self.ws.sock and self.ws.sock.connected:
            try:
                self.ws.send(json.dumps({
                    "type": "renderer:status",
                    "code": self.code,
                    "sessionSecret": self.session_secret,
                    "status": status
                }))
            except Exception:
                pass

    def _run(self):
        while self.running:
            self.callbacks.get('on_status', lambda s: None)("Connecting to relay...")

            def on_message(ws, message):
                try:
                    data = json.loads(message)
                    if data.get("type") == "joined":
                        self.callbacks.get('on_status', lambda s: None)("waiting_for_scene")
                        self.send_status("waiting_for_scene")
                    elif data.get("type") == "scene:update":
                        self.send_status("scene_received")
                        if 'on_scene' in self.callbacks:
                            self.callbacks['on_scene'](data.get("scene"))
                        self.send_status("rendering")
                    elif data.get("type") == "error":
                        msg = data.get("message", "Relay error")
                        self.callbacks.get('on_status', lambda s: None)(msg)
                        if 'on_error' in self.callbacks:
                            self.callbacks['on_error'](msg)
                    elif data.get("type") == "room:status":
                        pass
                except Exception as e:
                    print(f"[Map Daddy Receiver] WS Parse Error: {e}")

            def on_error(ws, error):
                print(f"[Map Daddy Receiver] WS Error: {error}")
                self.callbacks.get('on_status', lambda s: None)(f"Relay error: {error}")
                if 'on_error' in self.callbacks:
                    self.callbacks['on_error'](str(error))

            def on_close(ws, close_status_code, close_msg):
                print("[Map Daddy Receiver] WS Closed")
                if self.running:
                    self.callbacks.get('on_status', lambda s: None)("Disconnected. Reconnecting...")

            def on_open(ws):
                print("[Map Daddy Receiver] WS Connected")
                self.callbacks.get('on_status', lambda s: None)("Connected. Joining session...")
                ws.send(json.dumps({
                    "type": "join",
                    "role": "renderer",
                    "code": self.code,
                    "sessionSecret": self.session_secret
                }))

            self.ws = websocket.WebSocketApp(
                self.url,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )

            self.ws.run_forever()

            if self.running:
                time.sleep(3)
