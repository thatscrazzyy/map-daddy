import os
import json

CONFIG_DIR = os.path.expanduser("~/.mapdaddy")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")

DEFAULT_CONFIG = {
    "relay_url": "ws://localhost:8080",
    "last_pairing_code": "",
    "width": 1920,
    "height": 1080,
    "fullscreen": True,
    "auto_connect": False,
    "show_status_overlay": True
}

def load_config():
    if not os.path.exists(CONFIG_DIR):
        os.makedirs(CONFIG_DIR)
    if not os.path.exists(CONFIG_FILE):
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r") as f:
            cfg = json.load(f)
            # Merge with defaults for missing keys
            for k, v in DEFAULT_CONFIG.items():
                if k not in cfg:
                    cfg[k] = v
            return cfg
    except Exception as e:
        print(f"[Map Daddy] Error loading config: {e}")
        return DEFAULT_CONFIG.copy()

def save_config(config):
    if not os.path.exists(CONFIG_DIR):
        os.makedirs(CONFIG_DIR)
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        print(f"[Map Daddy] Error saving config: {e}")
