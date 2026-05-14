import pygame
import sys
import requests
import time
from .config import load_config, save_runtime_config
from .media_cache import MediaCache
from .relay_client import RelayClient
from .renderer import ProjectionRenderer
from .ui import UI

class MapDaddyReceiver:
    def __init__(self, cli_args):
        pygame.init()
        self.config = load_config()
        
        # Override config with CLI
        if cli_args.relay:
            self.config['relay_url'] = cli_args.relay
        if cli_args.code:
            self.config['last_pairing_code'] = cli_args.code
        if getattr(cli_args, "session_secret", None):
            self.config['last_session_secret'] = cli_args.session_secret
        if cli_args.width:
            self.config['width'] = cli_args.width
        if cli_args.height:
            self.config['height'] = cli_args.height
            
        self.windowed = cli_args.windowed
        self.server_url = cli_args.server # Local polling mode fallback
        
        self.setup_display()
        
        self.ui = UI(self.w, self.h)
        self.media_cache = MediaCache(self.config.get('media_cache_dir'), base_url=self.server_url)
        self.renderer = ProjectionRenderer(self.media_cache, self.w, self.h)
        self.relay = None
        
        self.state = "STARTUP"
        self.scene = None
        self.status_msg = "Ready"
        self.active_setting = 0
        self.active_pairing_field = 0
        self.settings_resolution = f"{self.config['width']}x{self.config['height']}"
        
        self.clock = pygame.time.Clock()
        self.running = True

        if self.server_url:
            self.state = "WAITING_FOR_SCENE"
        elif (cli_args.code and getattr(cli_args, "session_secret", None)) or self.config['auto_connect']:
            if self.config['last_pairing_code'] and self.config.get('last_session_secret'):
                self.connect_relay()
            else:
                self.state = "PAIRING"
        else:
            self.state = "PAIRING"

    def setup_display(self):
        info = pygame.display.Info()
        fullscreen = (not self.windowed) and self.config.get('fullscreen', True)
        self.w = info.current_w if fullscreen else self.config['width']
        self.h = info.current_h if fullscreen else self.config['height']
        flags = pygame.FULLSCREEN if fullscreen else pygame.RESIZABLE
        self.screen = pygame.display.set_mode((self.w, self.h), flags)
        pygame.display.set_caption("Map Daddy Receiver")
        if hasattr(self, "renderer"):
            self.renderer.resize(self.w, self.h)
        if hasattr(self, "ui"):
            self.ui.w = self.w
            self.ui.h = self.h

    def connect_relay(self):
        if not self.config['last_pairing_code']:
            self.status_msg = "Please enter a code"
            return
        if not self.config.get('last_session_secret'):
            self.status_msg = "Please enter the password/session key"
            return
            
        save_runtime_config(self.config)
        self.state = "CONNECTING"
        
        if self.relay:
            self.relay.stop()
            
        def on_scene(scene_data):
            self.scene = scene_data
            self.state = "RENDERING"
            
        def on_status(msg):
            self.status_msg = msg
            if msg == "waiting_for_scene" and not self.scene:
                self.state = "WAITING_FOR_SCENE"
            elif msg.startswith("Disconnected") and not self.scene:
                self.state = "DISCONNECTED"
            
        self.relay = RelayClient(
            url=self.config['relay_url'],
            code=self.config['last_pairing_code'],
            session_secret=self.config.get('last_session_secret', ''),
            callbacks={
                'on_scene': on_scene,
                'on_status': on_status
            }
        )
        self.relay.start()

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                elif event.key == pygame.K_F11 or (event.key == pygame.K_f and self.state not in ("PAIRING", "SETTINGS")):
                    self.windowed = not self.windowed
                    self.config['fullscreen'] = not self.windowed
                    save_runtime_config(self.config)
                    self.setup_display()
                elif event.key == pygame.K_h and self.state not in ("PAIRING", "SETTINGS"):
                    self.config['show_status_overlay'] = not self.config['show_status_overlay']
                    save_runtime_config(self.config)
                elif event.key == pygame.K_F2 or (event.key == pygame.K_s and self.state not in ("PAIRING", "SETTINGS")):
                    self.state = "SETTINGS"
                elif event.key == pygame.K_F1 and self.state == "SETTINGS":
                    self.state = "PAIRING"
                elif event.key == pygame.K_c and self.state not in ("PAIRING", "SETTINGS"):
                    if self.relay:
                        self.relay.stop()
                    self.state = "PAIRING"
                elif event.key == pygame.K_r and self.state not in ("PAIRING", "SETTINGS"):
                    self.media_cache.clear()
                
                elif self.state == "PAIRING":
                    if event.key == pygame.K_RETURN:
                        self.connect_relay()
                    elif event.key in (pygame.K_TAB, pygame.K_DOWN):
                        self.active_pairing_field = (self.active_pairing_field + 1) % 2
                    elif event.key == pygame.K_UP:
                        self.active_pairing_field = (self.active_pairing_field - 1) % 2
                    elif event.key == pygame.K_BACKSPACE:
                        if self.active_pairing_field == 0:
                            self.config['last_pairing_code'] = self.config['last_pairing_code'][:-1]
                        else:
                            self.config['last_session_secret'] = self.config.get('last_session_secret', '')[:-1]
                    else:
                        if event.unicode and (event.unicode.isalnum() or event.unicode in "-_."):
                            if self.active_pairing_field == 0:
                                self.config['last_pairing_code'] += event.unicode.upper()
                            else:
                                self.config['last_session_secret'] += event.unicode
                
                elif self.state == "SETTINGS":
                    if event.key == pygame.K_DOWN:
                        self.active_setting = (self.active_setting + 1) % 6
                    elif event.key == pygame.K_UP:
                        self.active_setting = (self.active_setting - 1) % 6
                    elif event.key == pygame.K_BACKSPACE:
                        if self.active_setting == 0:
                            self.config['relay_url'] = self.config['relay_url'][:-1]
                        elif self.active_setting == 4:
                            self.settings_resolution = self.settings_resolution[:-1]
                    elif event.key == pygame.K_RETURN:
                        if self.active_setting == 1:
                            self.config['auto_connect'] = not self.config['auto_connect']
                        elif self.active_setting == 2:
                            self.config['fullscreen'] = not self.config['fullscreen']
                        elif self.active_setting == 3:
                            self.config['show_status_overlay'] = not self.config['show_status_overlay']
                        elif self.active_setting == 4:
                            self.apply_resolution_setting()
                        elif self.active_setting == 5:
                            self.media_cache.clear()
                            self.status_msg = "Cache cleared"
                        save_runtime_config(self.config)
                    else:
                        if self.active_setting == 0 and event.unicode and event.unicode.isprintable():
                            self.config['relay_url'] += event.unicode
                        elif self.active_setting == 4 and event.unicode and (event.unicode.isdigit() or event.unicode.lower() == "x"):
                            self.settings_resolution += event.unicode.lower()
                        
    def apply_resolution_setting(self):
        try:
            width, height = self.settings_resolution.lower().split("x", 1)
            width = int(width)
            height = int(height)
            if width >= 320 and height >= 240:
                self.config['width'] = width
                self.config['height'] = height
                self.status_msg = f"Resolution set to {width}x{height}"
        except Exception:
            self.status_msg = "Resolution must look like 1920x1080"

    def run(self):
        last_poll = 0
        while self.running:
            self.handle_events()
            
            if self.state == "PAIRING":
                self.ui.draw_pairing_screen(
                    self.screen,
                    self.config['last_pairing_code'],
                    self.config.get('last_session_secret', ''),
                    self.config['relay_url'],
                    self.status_msg,
                    self.active_pairing_field
                )
            
            elif self.state == "SETTINGS":
                self.ui.draw_settings_screen(self.screen, self.config, self.active_setting, self.settings_resolution)
                
            elif self.state == "CONNECTING":
                self.ui.draw_pairing_screen(
                    self.screen,
                    self.config['last_pairing_code'],
                    self.config.get('last_session_secret', ''),
                    self.config['relay_url'],
                    self.status_msg,
                    self.active_pairing_field
                )
                
            elif self.state in ["RENDERING", "WAITING_FOR_SCENE", "DISCONNECTED", "ERROR"]:
                if self.server_url:
                    now = time.time()
                    if now - last_poll > 2.0:
                        last_poll = now
                        try:
                            r = requests.get(f"{self.server_url}/api/current-scene", timeout=2)
                            if r.status_code == 200:
                                self.scene = r.json()
                                self.status_msg = "Polling successful"
                                self.state = "RENDERING"
                        except:
                            self.status_msg = "Polling failed"

                if self.scene:
                    self.renderer.draw_scene(self.screen, self.scene)
                else:
                    self.screen.fill((0, 0, 0))
                    self.ui.draw_text(self.screen, "Waiting for Scene...", self.ui.font_large, (100, 100, 100), self.h//2)
                    
                if self.config['show_status_overlay']:
                    self.ui.draw_status_overlay(self.screen, self.config['relay_url'], self.config['last_pairing_code'], self.status_msg, self.clock.get_fps())
                    
            pygame.display.flip()
            self.clock.tick(60)

        if self.relay:
            self.relay.stop()
        pygame.quit()
        sys.exit()
