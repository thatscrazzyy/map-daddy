import pygame
import sys
import requests
import time
from .config import load_config, save_config
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
        
        self.clock = pygame.time.Clock()
        self.running = True

        if self.server_url:
            self.state = "WAITING_FOR_SCENE"
        elif cli_args.code or self.config['auto_connect']:
            if self.config['last_pairing_code']:
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

    def connect_relay(self):
        if not self.config['last_pairing_code']:
            self.status_msg = "Please enter a code"
            return
            
        save_config(self.config)
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
                elif event.key == pygame.K_f:
                    self.windowed = not self.windowed
                    self.config['fullscreen'] = not self.windowed
                    save_config(self.config)
                    self.setup_display()
                elif event.key == pygame.K_h:
                    self.config['show_status_overlay'] = not self.config['show_status_overlay']
                    save_config(self.config)
                elif event.key == pygame.K_s:
                    self.state = "SETTINGS"
                elif event.key == pygame.K_c:
                    if self.relay:
                        self.relay.stop()
                    self.state = "PAIRING"
                elif event.key == pygame.K_r:
                    self.media_cache.clear()
                
                elif self.state == "PAIRING":
                    if event.key == pygame.K_RETURN:
                        self.connect_relay()
                    elif event.key == pygame.K_BACKSPACE:
                        self.config['last_pairing_code'] = self.config['last_pairing_code'][:-1]
                    else:
                        if event.unicode.isalnum() or event.unicode in "-_":
                            self.config['last_pairing_code'] += event.unicode.upper()
                
                elif self.state == "SETTINGS":
                    if event.key == pygame.K_DOWN:
                        self.active_setting = (self.active_setting + 1) % 3
                    elif event.key == pygame.K_UP:
                        self.active_setting = (self.active_setting - 1) % 3
                    elif event.key == pygame.K_RETURN:
                        if self.active_setting == 1:
                            self.config['auto_connect'] = not self.config['auto_connect']
                        elif self.active_setting == 2:
                            self.config['show_status_overlay'] = not self.config['show_status_overlay']
                        save_config(self.config)
                        

    def run(self):
        last_poll = 0
        while self.running:
            self.handle_events()
            
            if self.state == "PAIRING":
                self.ui.draw_pairing_screen(self.screen, self.config['last_pairing_code'], self.config['relay_url'], self.status_msg)
            
            elif self.state == "SETTINGS":
                self.ui.draw_settings_screen(self.screen, self.config, self.active_setting)
                
            elif self.state == "CONNECTING":
                self.ui.draw_pairing_screen(self.screen, self.config['last_pairing_code'], self.config['relay_url'], self.status_msg)
                
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
