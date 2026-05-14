import pygame
import cv2
import numpy as np
import requests
import time
import os

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

def fetch_scene():
    try:
        response = requests.get(f"{BACKEND_URL}/api/current-scene", timeout=2)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print("Error fetching scene:", e)
    return None

def fetch_image(url):
    try:
        if not url.startswith("http"):
            url = f"{BACKEND_URL}{url}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            image = np.asarray(bytearray(response.content), dtype="uint8")
            image = cv2.imdecode(image, cv2.IMREAD_COLOR)
            return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    except Exception as e:
        print("Error fetching image:", e)
    return None

def main():
    pygame.init()
    
    # Setup Display
    screen_info = pygame.display.Info()
    w, h = screen_info.current_w, screen_info.current_h
    # Start windowed, can toggle fullscreen
    screen = pygame.display.set_mode((w, h), pygame.RESIZABLE)
    pygame.display.set_caption("Map Daddy Renderer")
    
    clock = pygame.time.Clock()
    running = True
    fullscreen = False
    
    last_fetch_time = 0
    scene = None
    
    media_cache = {}

    while running:
        current_time = time.time()
        
        # Poll backend every 1 second
        if current_time - last_fetch_time > 1.0:
            new_scene = fetch_scene()
            if new_scene:
                scene = new_scene
            last_fetch_time = current_time

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                elif event.key == pygame.K_f:
                    fullscreen = not fullscreen
                    if fullscreen:
                        screen = pygame.display.set_mode((w, h), pygame.FULLSCREEN)
                    else:
                        screen = pygame.display.set_mode((w, h), pygame.RESIZABLE)
                        
        screen.fill((0, 0, 0))
        
        if scene and "surfaces" in scene:
            for surface in scene["surfaces"]:
                if not surface.get("visible", True):
                    continue
                    
                media_url = surface.get("media")
                if not media_url:
                    continue
                    
                # Load media if not in cache
                if media_url not in media_cache:
                    img = fetch_image(media_url)
                    if img is not None:
                        media_cache[media_url] = img
                
                img = media_cache.get(media_url)
                if img is not None:
                    # Perspective warp
                    src_pts = np.float32(surface["source_points"])
                    dst_pts = np.float32(surface["destination_points"])
                    
                    # Compute transform matrix
                    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)
                    
                    # Warp image
                    warped = cv2.warpPerspective(img, matrix, (w, h))
                    
                    # Create pygame surface
                    # opencv image is HxWxC, pygame requires WxH
                    surf = pygame.surfarray.make_surface(np.transpose(warped, (1, 0, 2)))
                    # Render with opacity if needed
                    opacity = surface.get("opacity", 1.0)
                    if opacity < 1.0:
                        surf.set_alpha(int(255 * opacity))
                        
                    screen.blit(surf, (0, 0))
                    
        pygame.display.flip()
        clock.tick(60)

    pygame.quit()

if __name__ == "__main__":
    main()
