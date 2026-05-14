import pygame
import cv2
import numpy as np

class ProjectionRenderer:
    def __init__(self, media_cache, screen_w, screen_h):
        self.media_cache = media_cache
        self.w = screen_w
        self.h = screen_h

    def draw_scene(self, screen, scene):
        screen.fill((0, 0, 0))
        if not scene or "surfaces" not in scene:
            return
            
        for surface in scene["surfaces"]:
            if not surface.get("visible", True):
                continue
                
            media_url = surface.get("media")
            if not media_url:
                continue
                
            img = self.media_cache.get_image(media_url)
            if img is not None:
                src_pts = np.float32(surface["source_points"])
                dst_pts = np.float32(surface["destination_points"])
                
                # Compute transform matrix
                matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)
                
                # Warp image
                warped = cv2.warpPerspective(img, matrix, (self.w, self.h))
                
                surf = pygame.surfarray.make_surface(np.transpose(warped, (1, 0, 2)))
                opacity = surface.get("opacity", 1.0)
                if opacity < 1.0:
                    surf.set_alpha(int(255 * opacity))
                    
                screen.blit(surf, (0, 0))
