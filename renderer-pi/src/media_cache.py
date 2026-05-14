import hashlib
import os
import shutil
from urllib.parse import urljoin, urlparse

import requests

class MediaCache:
    def __init__(self, cache_dir=None, base_url=None):
        self.cache_dir = os.path.expanduser(cache_dir or "~/.mapdaddy/cache")
        self.base_url = base_url
        os.makedirs(self.cache_dir, exist_ok=True)

    def set_base_url(self, base_url):
        self.base_url = base_url

    def resolve_url(self, url):
        if not url:
            raise ValueError("empty media URL")
        if url.startswith("http://") or url.startswith("https://"):
            return url
        if self.base_url:
            return urljoin(self.base_url.rstrip("/") + "/", url.lstrip("/"))
        raise ValueError(f"relative media URL requires a base URL: {url}")

    def cache_path_for_url(self, url):
        resolved = self.resolve_url(url)
        parsed = urlparse(resolved)
        _, ext = os.path.splitext(parsed.path)
        ext = ext if ext else ".bin"
        digest = hashlib.sha256(resolved.encode("utf-8")).hexdigest()
        return resolved, os.path.join(self.cache_dir, f"{digest}{ext}")

    def get_file(self, url):
        resolved, path = self.cache_path_for_url(url)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            return path

        print(f"[Map Daddy Receiver] Downloading media: {resolved}")
        try:
            with requests.get(resolved, timeout=20, stream=True) as response:
                response.raise_for_status()
                tmp_path = f"{path}.tmp"
                with open(tmp_path, "wb") as file:
                    for chunk in response.iter_content(chunk_size=1024 * 256):
                        if chunk:
                            file.write(chunk)
                os.replace(tmp_path, path)
                return path
        except Exception as e:
            print(f"[Map Daddy Receiver] Error downloading media {resolved}: {e}")
            raise

    def clear(self):
        if os.path.exists(self.cache_dir):
            shutil.rmtree(self.cache_dir)
        os.makedirs(self.cache_dir, exist_ok=True)
        print("[Map Daddy Receiver] Media cache cleared.")
