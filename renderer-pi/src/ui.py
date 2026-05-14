import pygame


class UI:
    def __init__(self, screen_w, screen_h):
        pygame.font.init()
        self.font_large = pygame.font.SysFont(None, 72)
        self.font_medium = pygame.font.SysFont(None, 42)
        self.font_small = pygame.font.SysFont(None, 24)
        self.w = screen_w
        self.h = screen_h

    def draw_text(self, screen, text, font, color, y, center_x=True, x=0):
        surface = font.render(str(text), True, color)
        rect = surface.get_rect()
        if center_x:
            rect.centerx = self.w // 2
        else:
            rect.x = x
        rect.y = y
        screen.blit(surface, rect)

    def draw_input(self, screen, label, value, y, active=False, password=False):
        box_w, box_h = min(620, self.w - 80), 64
        x = self.w // 2 - box_w // 2
        color = (16, 185, 129) if active else (90, 90, 105)
        pygame.draw.rect(screen, (38, 38, 48), pygame.Rect(x, y, box_w, box_h))
        pygame.draw.rect(screen, color, pygame.Rect(x, y, box_w, box_h), 2)
        self.draw_text(screen, label, self.font_small, (170, 170, 180), y - 28, center_x=False, x=x)

        shown = "*" * len(value) if password else value
        if active and pygame.time.get_ticks() % 1000 < 500:
            shown += "_"
        self.draw_text(screen, shown, self.font_medium, (255, 255, 255), y + 14, center_x=False, x=x + 18)

    def draw_pairing_screen(self, screen, code, session_secret, relay_url, status_msg, active_field):
        screen.fill((20, 20, 25))
        self.draw_text(screen, "Map Daddy Receiver", self.font_large, (16, 185, 129), self.h // 2 - 220)
        self.draw_text(screen, "Enter the code and password from the controller", self.font_small, (190, 190, 200), self.h // 2 - 145)

        self.draw_input(screen, "Pairing Code", code, self.h // 2 - 90, active_field == 0)
        self.draw_input(screen, "Password / Session Key", session_secret, self.h // 2 + 15, active_field == 1, password=True)

        self.draw_text(screen, status_msg, self.font_medium, (100, 200, 255), self.h // 2 + 115)
        self.draw_text(screen, "Relay URL is in Settings", self.font_small, (150, 150, 150), self.h // 2 + 172)
        self.draw_text(screen, "ENTER connect | TAB switch field | F2 settings | F11 fullscreen | ESC quit", self.font_small, (100, 100, 100), self.h - 50)

    def draw_settings_screen(self, screen, config, active_field, resolution_text):
        screen.fill((20, 20, 25))
        self.draw_text(screen, "Settings", self.font_large, (255, 255, 255), 80)

        y = 190
        fields = [
            ("Relay URL", config['relay_url']),
            ("Auto Connect", str(config['auto_connect'])),
            ("Fullscreen", str(config['fullscreen'])),
            ("Show Overlay", str(config['show_status_overlay'])),
            ("Resolution", resolution_text),
            ("Clear Cache", "Press ENTER")
        ]

        for i, (label, val) in enumerate(fields):
            color = (16, 185, 129) if active_field == i else (210, 210, 220)
            prefix = "> " if active_field == i else "  "
            self.draw_text(screen, f"{prefix}{label}: {val}", self.font_medium, color, y, center_x=False, x=max(40, self.w // 2 - 420))
            y += 58

        self.draw_text(screen, "UP/DOWN select | type Relay URL or Resolution | ENTER toggle/apply | F1 pairing", self.font_small, (100, 100, 100), self.h - 50)

    def draw_status_overlay(self, screen, relay_url, code, status_msg, fps):
        overlay = pygame.Surface((390, 150))
        overlay.set_alpha(180)
        overlay.fill((10, 10, 15))
        screen.blit(overlay, (20, 20))

        self.draw_text(screen, "Map Daddy Receiver", self.font_small, (16, 185, 129), 30, center_x=False, x=30)
        self.draw_text(screen, f"Code: {code}", self.font_small, (255, 255, 255), 60, center_x=False, x=30)
        self.draw_text(screen, f"Status: {status_msg}", self.font_small, (200, 200, 200), 90, center_x=False, x=30)
        self.draw_text(screen, f"FPS: {fps:.1f}", self.font_small, (100, 100, 100), 120, center_x=False, x=30)
