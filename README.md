# Map Daddy

A lightweight, open-source projection mapping application optimized for Windows, Linux, and Raspberry Pi.

## Architecture
Map Daddy uses a split architecture:
- **Backend**: FastAPI (Python) serving scenes and handling media.
- **Frontend**: React (Vite) offering a dark-mode web control interface.
- **Renderer**: Native Python (Pygame + OpenCV) client that warps images to map to physical surfaces.

## Getting Started (Local Development)

### 1. Backend Setup
The backend serves the application data and provides endpoints to manipulate the mapping surfaces.
```bash
cd pimapper/backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/macOS
# source venv/bin/activate
pip install -r requirements.txt

# Run the backend (default port 8000)
python main.py
```

### 2. Frontend Setup
The frontend control UI lets you set up and configure projection zones interactively.
```bash
cd pimapper/frontend
npm install

# Start the development server
npm run dev
```
Visit `http://localhost:5173` in your browser.

### 3. Renderer Setup
The renderer fetches the scene from the backend and displays the mapped media in fullscreen.
```bash
cd pimapper/renderer
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/macOS
# source venv/bin/activate
pip install -r requirements.txt

# Ensure backend is running, then start renderer
python renderer.py
```

## Using Map Daddy
1. Open the frontend UI in your web browser.
2. Select a surface from the left menu.
3. Upload an image to map onto the surface.
4. Drag the four white circular corners to match the physical surface.
5. Click **Save Scene**.
6. Switch to the renderer window. Press `F` to toggle fullscreen.

## Running on Raspberry Pi
- Connect your projector to the Raspberry Pi.
- Clone the repository and install the backend and renderer dependencies.
- You can run the backend and the renderer locally on the Pi.
- Control the mapping from a smartphone or laptop on the same network by navigating to `<Raspberry_Pi_IP>:5173` (ensure you build the frontend using `npm run build` and serve it statically, or run Vite with `--host`).
