import json
import threading
import time
import websocket

class RelayClient:
    def __init__(self, url, code, callbacks):
        self.url = url
        self.code = code
        self.callbacks = callbacks # on_scene, on_status, on_error
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
                    "status": status
                }))
            except:
                pass

    def _run(self):
        while self.running:
            self.callbacks.get('on_status', lambda s: None)("Connecting to relay...")
            
            def on_message(ws, message):
                try:
                    data = json.loads(message)
                    if data.get("type") == "scene:update":
                        self.send_status("scene_received")
                        if 'on_scene' in self.callbacks:
                            self.callbacks['on_scene'](data.get("scene"))
                        self.send_status("rendering")
                    elif data.get("type") == "room:status":
                        pass
                except Exception as e:
                    print(f"[Map Daddy] WS Parse Error: {e}")

            def on_error(ws, error):
                print(f"[Map Daddy] WS Error: {error}")
                if 'on_error' in self.callbacks:
                    self.callbacks['on_error'](str(error))

            def on_close(ws, close_status_code, close_msg):
                print("[Map Daddy] WS Closed")
                if self.running:
                    self.callbacks.get('on_status', lambda s: None)("Disconnected. Reconnecting...")
            
            def on_open(ws):
                print("[Map Daddy] WS Connected")
                self.callbacks.get('on_status', lambda s: None)("Connected. Joining room...")
                ws.send(json.dumps({
                    "type": "join",
                    "role": "renderer",
                    "code": self.code
                }))
                self.send_status("waiting_for_scene")

            self.ws = websocket.WebSocketApp(
                self.url,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )
            
            self.ws.run_forever()
            
            if self.running:
                time.sleep(3) # Wait before reconnect
