#!/bin/bash
# Map Daddy setup script for Raspberry Pi

echo "Setting up Map Daddy on Raspberry Pi..."

# Ensure we are in the project root
cd "$(dirname "$0")"
PROJECT_ROOT=$(pwd)

# Install system dependencies
sudo apt update
sudo apt install -y python3-pip python3-venv nodejs npm libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev libportmidi-dev libavformat-dev libswscale-dev libjpeg-dev libfreetype6-dev

# Build the frontend
echo "Building frontend..."
cd $PROJECT_ROOT/frontend
npm install
npm run build

# Setup backend venv
echo "Setting up backend..."
cd $PROJECT_ROOT/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Setup renderer venv
echo "Setting up renderer..."
cd $PROJECT_ROOT/renderer
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Create systemd service for backend
echo "Creating systemd service for Backend..."
cat << EOF | sudo tee /etc/systemd/system/mapdaddy-backend.service
[Unit]
Description=Map Daddy Backend
After=network.target

[Service]
User=$USER
WorkingDirectory=$PROJECT_ROOT/backend
Environment="PATH=$PROJECT_ROOT/backend/venv/bin"
ExecStart=$PROJECT_ROOT/backend/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for renderer
echo "Creating systemd service for Renderer..."
cat << EOF | sudo tee /etc/systemd/system/mapdaddy-renderer.service
[Unit]
Description=Map Daddy Renderer
After=graphical.target
Requires=graphical.target

[Service]
User=$USER
WorkingDirectory=$PROJECT_ROOT/renderer
Environment="PATH=$PROJECT_ROOT/renderer/venv/bin"
Environment="DISPLAY=:0"
ExecStart=$PROJECT_ROOT/renderer/venv/bin/python renderer.py
Restart=always

[Install]
WantedBy=graphical.target
EOF

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable mapdaddy-backend.service
sudo systemctl enable mapdaddy-renderer.service
sudo systemctl restart mapdaddy-backend.service
sudo systemctl restart mapdaddy-renderer.service

echo "Setup complete!"
echo "Map Daddy backend and renderer are now running as background services."
echo "You can access the control interface from any device on your Wi-Fi at:"
echo "http://$(hostname -I | awk '{print $1}'):8000"
