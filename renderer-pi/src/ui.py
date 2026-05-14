import pygame

class UI:
    def __init__(self, screen_w, screen_h):
        pygame.font.init()
        self.font_large = pygame.font.SysFont(None, 72)
        self.font_medium = pygame.font.SysFont(None, 48)
        self.font_small = pygame.font.SysFont(None, 24)
        self.w = screen_w
        self.h = screen_h

    def draw_text(self, screen, text, font, color, y, center_x=True, x=0):
        surface = font.render(text, True, color)
        rect = surface.get_rect()
        if center_x:
            rect.centerx = self.w // 2
        else:
            rect.x = x
        rect.y = y
        screen.blit(surface, rect)

    def draw_pairing_screen(self, screen, code, relay_url, status_msg):
        screen.fill((20, 20, 25))
        self.draw_text(screen, "Map Daddy Receiver", self.font_large, (16, 185, 129), self.h//2 - 150)
        self.draw_text(screen, "Enter Pairing Code:", self.font_medium, (200, 200, 200), self.h//2 - 50)
        
        # Draw code box
        box_w, box_h = 400, 80
        box_rect = pygame.Rect(self.w//2 - box_w//2, self.h//2, box_w, box_h)
        pygame.draw.rect(screen, (40, 40, 50), box_rect)
        pygame.draw.rect(screen, (16, 185, 129), box_rect, 2)
        
        # Render code text, cursor if typing
        code_text = code + ("_" if pygame.time.get_ticks() % 1000 < 500 else "")
        self.draw_text(screen, code_text, self.font_large, (255, 255, 255), self.h//2 + 15)
        
        self.draw_text(screen, f"Relay: {relay_url}", self.font_small, (150, 150, 150), self.h//2 + 120)
        self.draw_text(screen, status_msg, self.font_medium, (100, 200, 255), self.h//2 + 180)
        
        self.draw_text(screen, "Press ENTER to connect | S for Settings | ESC to Quit", self.font_small, (100, 100, 100), self.h - 50)

    def draw_settings_screen(self, screen, config, active_field):
        screen.fill((20, 20, 25))
        self.draw_text(screen, "Settings", self.font_large, (255, 255, 255), 100)
        
        y = 250
        fields = [
            ("Relay URL", config['relay_url']),
            ("Auto Connect", str(config['auto_connect'])),
            ("Show Overlay", str(config['show_status_overlay']))
        ]
        
        for i, (label, val) in enumerate(fields):
            color = (16, 185, 129) if active_field == i else (200, 200, 200)
            prefix = "> " if active_field == i else "  "
            self.draw_text(screen, f"{prefix}{label}: {val}", self.font_medium, color, y, center_x=False, x=self.w//2 - 300)
            y += 60
            
        self.draw_text(screen, "Press UP/DOWN to select | ENTER to toggle/edit | ESC to go back", self.font_small, (100, 100, 100), self.h - 50)

    def draw_status_overlay(self, screen, relay_url, code, status_msg, fps):
        overlay = pygame.Surface((350, 150))
        overlay.set_alpha(180)
        overlay.fill((10, 10, 15))
        screen.blit(overlay, (20, 20))
        
        self.draw_text(screen, "Map Daddy Receiver", self.font_small, (16, 185, 129), 30, center_x=False, x=30)
        self.draw_text(screen, f"Room: {code}", self.font_small, (255, 255, 255), 60, center_x=False, x=30)
        self.draw_text(screen, f"Status: {status_msg}", self.font_small, (200, 200, 200), 90, center_x=False, x=30)
        self.draw_text(screen, f"FPS: {fps:.1f}", self.font_small, (100, 100, 100), 120, center_x=False, x=30)
