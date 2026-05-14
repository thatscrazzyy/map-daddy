import os
import requests
import cv2
import numpy as np

class MediaCache:
    def __init__(self):
        self.cache = {}
    
    def get_image(self, url):
        if url in self.cache:
            return self.cache[url]
        print(f"[Map Daddy] Fetching media: {url}")
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                image = np.asarray(bytearray(response.content), dtype="uint8")
                image = cv2.imdecode(image, cv2.IMREAD_COLOR)
                if image is not None:
                    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    self.cache[url] = rgb
                    return rgb
        except Exception as e:
            print(f"[Map Daddy] Error fetching media {url}: {e}")
        
        self.cache[url] = None
        return None

    def clear(self):
        self.cache.clear()
        print("[Map Daddy] Media cache cleared.")
