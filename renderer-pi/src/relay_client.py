import json
import threading
import time
import logging
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
import websocket

logger = logging.getLogger("MapDaddy.Receiver")

class RelayClient:
    def __init__(self, url, code, session_secret, callbacks, debug=False):
        self.url = url
        self.code = code
        self.session_secret = session_secret
        self.callbacks = callbacks
        self.debug = debug
        self.ws = None
        self.running = False
        self.thread = None
        self.fatal_error = False

    def start(self):
        if self.running:
            return
        self.running = True
        self.fatal_error = False
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.ws:
            self.ws.close()
        if self.thread and self.thread != threading.current_thread():
            self.thread.join(timeout=2.0)

    def send_status(self, status):
        if self.ws and self.ws.sock and self.ws.sock.connected:
            try:
                self.ws.send(json.dumps({
                    "type": "renderer:status",
                    "code": self.code,
                    "sessionSecret": self.session_secret,
                    "status": status
                }))
            except Exception as e:
                logger.error(f"Error sending status: {e}")

    def _connection_url(self):
        parsed = urlparse(self.url)
        query = parse_qs(parsed.query)
        if self.code and "code" not in query:
            query["code"] = [self.code]
        return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))

    def _run(self):
        if self.debug:
            websocket.enableTrace(True)
        else:
            websocket.enableTrace(False)
            
        backoff = 2.0
        max_backoff = 60.0
        
        while self.running and not self.fatal_error:
            self.callbacks.get('on_status', lambda s: None)("Connecting to relay...")
            logger.info(f"Connecting to {self._connection_url()}")

            connection_start_time = time.time()

            def on_message(ws, message):
                try:
                    data = json.loads(message)
                    msg_type = data.get("type")
                    if msg_type == "joined":
                        logger.info("Successfully joined session")
                        self.callbacks.get('on_status', lambda s: None)("waiting_for_scene")
                        self.send_status("waiting_for_scene")
                    elif msg_type == "scene:update":
                        logger.info("Received scene update")
                        self.send_status("scene_received")
                        if 'on_scene' in self.callbacks:
                            self.callbacks['on_scene'](data.get("scene"))
                        self.send_status("rendering")
                    elif msg_type == "error":
                        msg = data.get("message", "Relay error")
                        logger.error(f"Relay error: {msg}")
                        self.callbacks.get('on_status', lambda s: None)(msg)
                        if 'on_error' in self.callbacks:
                            self.callbacks['on_error'](msg)
                            
                        # Detect fatal errors
                        if "Invalid" in msg or "expired" in msg.lower():
                            logger.error("Fatal session error detected. Aborting reconnect loop.")
                            self.fatal_error = True
                            if 'on_fatal_error' in self.callbacks:
                                self.callbacks['on_fatal_error'](msg)
                            ws.close()
                    elif msg_type == "room:status":
                        pass
                except Exception as e:
                    logger.error(f"WS Parse Error: {e}")

            def on_error(ws, error):
                logger.error(f"WS Error: {error}")
                self.callbacks.get('on_status', lambda s: None)(f"Relay error: {error}")
                if 'on_error' in self.callbacks:
                    self.callbacks['on_error'](str(error))

            def on_close(ws, close_status_code, close_msg):
                logger.info(f"WS Closed. Code: {close_status_code}, Msg: {close_msg}")
                if self.running and not self.fatal_error:
                    self.callbacks.get('on_status', lambda s: None)("Disconnected. Reconnecting...")

            def on_open(ws):
                logger.info("WS Connected")
                self.callbacks.get('on_status', lambda s: None)("Connected. Joining session...")
                ws.send(json.dumps({
                    "type": "join",
                    "role": "renderer",
                    "code": self.code,
                    "sessionSecret": self.session_secret
                }))

            self.ws = websocket.WebSocketApp(
                self._connection_url(),
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )

            import ssl
            sslopt = {}
            if self.url.startswith("wss://"):
                sslopt = {"cert_reqs": ssl.CERT_NONE}
                
            self.ws.run_forever(
                sslopt=sslopt,
                ping_interval=30,
                ping_timeout=10
            )

            if self.running and not self.fatal_error:
                # If we were connected for more than 10 seconds, reset the backoff
                if time.time() - connection_start_time > 10.0:
                    backoff = 2.0
                    
                logger.info(f"Waiting {backoff} seconds before reconnecting...")
                # Sleep in small chunks so we can interrupt if self.running becomes False
                sleep_end = time.time() + backoff
                while time.time() < sleep_end and self.running and not self.fatal_error:
                    time.sleep(0.5)
                
                # Exponential backoff
                backoff = min(backoff * 2, max_backoff)
