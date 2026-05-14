import json
import os
import platform

DEFAULT_RELAY_URL = os.getenv("MAP_DADDY_DEFAULT_RELAY_URL", "wss://relay.mapdaddy.com")


def _config_dir():
    if platform.system().lower() == "windows":
        base = os.getenv("APPDATA") or os.path.expanduser("~")
        return os.path.join(base, "MapDaddy")
    return os.path.expanduser("~/.mapdaddy")


CONFIG_DIR = _config_dir()
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")


def _default_cache_dir():
    if platform.system().lower() == "windows":
        return os.path.join(CONFIG_DIR, "cache")
    return "~/.mapdaddy/cache"


DEFAULT_CONFIG = {
    "relay_url": DEFAULT_RELAY_URL,
    "last_pairing_code": "",
    "last_session_secret": "",
    "width": 1920,
    "height": 1080,
    "fullscreen": True,
    "auto_connect": False,
    "show_status_overlay": True,
    "media_cache_dir": _default_cache_dir()
}


def load_config():
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if not os.path.exists(CONFIG_FILE):
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        for k, v in DEFAULT_CONFIG.items():
            cfg.setdefault(k, v)
        return cfg
    except Exception as e:
        print(f"[Map Daddy Receiver] Error loading config: {e}")
        return DEFAULT_CONFIG.copy()


def save_config(config):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        print(f"[Map Daddy Receiver] Error saving config: {e}")


def save_runtime_config(config):
    cfg = config.copy()
    if not cfg.get("auto_connect"):
        cfg["last_session_secret"] = ""
    save_config(cfg)
