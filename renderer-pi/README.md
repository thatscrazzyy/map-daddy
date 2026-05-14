# Map Daddy Receiver

The native Raspberry Pi projection application for Map Daddy. 

## Features
- Hardware-accelerated perspective warping using OpenCV + Pygame.
- Internet-mode via WebSocket Relay using Pairing Codes.
- Native UI for easy configuration without a terminal.
- Fallback local polling mode.

## Installation

### Dependencies
Ensure you have the required system libraries installed on your Pi:
```bash
sudo apt update
sudo apt install -y python3-venv libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev
```

### Python Setup
```bash
cd renderer-pi
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Running
Start the graphical setup UI:
```bash
python3 mapdaddy_receiver.py
```

Connect directly to relay:
```bash
python3 mapdaddy_receiver.py --relay wss://your-relay.com --code MD-123456
```

Test mode (Windowed):
```bash
python3 mapdaddy_receiver.py --windowed
```

Old local polling mode:
```bash
python3 mapdaddy_receiver.py --server http://192.168.1.25:8000
```

## Keyboard Shortcuts
- **ENTER**: Connect/Submit
- **S**: Open Settings (from Pairing screen)
- **C**: Disconnect and return to Pairing screen
- **ESC**: Go back / Quit
- **F**: Toggle Fullscreen
- **H**: Show/Hide status overlay
- **R**: Clear media cache

## Auto-start on boot
To make the receiver launch automatically when the Pi boots:
```bash
# Edit mapdaddy-receiver.service if your username is not "pi" or folder is different
sudo cp mapdaddy-receiver.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mapdaddy-receiver.service
sudo systemctl start mapdaddy-receiver.service
```
