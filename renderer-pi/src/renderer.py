import pygame
import numpy as np
from .mapping import Mapper

class ProjectionRenderer:
    def __init__(self, media_cache, screen_w, screen_h):
        self.media_cache = media_cache
        self.w = screen_w
        self.h = screen_h
        self.mapper = None
        self.scene_fingerprint = None
        self.error = None

    def resize(self, screen_w, screen_h):
        self.w = screen_w
        self.h = screen_h
        self.scene_fingerprint = None

    def set_scene(self, scene):
        import json

        fingerprint = json.dumps(scene or {}, sort_keys=True)
        if fingerprint == self.scene_fingerprint:
            return

        if self.mapper:
            self.mapper.release()
        self.mapper = None
        self.error = None
        self.scene_fingerprint = fingerprint

        try:
            self.mapper = Mapper(scene, self.media_cache, output_size=(self.w, self.h))
        except Exception as exc:
            self.error = str(exc)
            print(f"[Map Daddy Receiver] Scene failed validation: {exc}")

    def draw_scene(self, screen, scene):
        if not scene:
            screen.fill((0, 0, 0))
            return

        self.set_scene(scene)
        if not self.mapper:
            screen.fill((0, 0, 0))
            return

        frame = self.mapper.render_frame()
        surf = pygame.surfarray.make_surface(np.transpose(frame, (1, 0, 2)))
        screen.blit(surf, (0, 0))
