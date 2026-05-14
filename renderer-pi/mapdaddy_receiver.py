import argparse
from src.app import MapDaddyReceiver

def main():
    parser = argparse.ArgumentParser(description="Map Daddy Receiver")
    parser.add_argument("--relay", type=str, help="Relay server URL (e.g. wss://relay.com)")
    parser.add_argument("--code", type=str, help="Pairing code")
    parser.add_argument("--server", type=str, help="Local backend URL for polling mode")
    parser.add_argument("--windowed", action="store_true", help="Run in a window instead of fullscreen")
    parser.add_argument("--width", type=int, help="Output/window width")
    parser.add_argument("--height", type=int, help="Output/window height")
    
    args = parser.parse_args()
    app = MapDaddyReceiver(args)
    app.run()

if __name__ == "__main__":
    main()
