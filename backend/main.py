import os
import json
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil

app = FastAPI(title="Map Daddy API")

# Allow CORS for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MEDIA_DIR = "media"
PROJECTS_DIR = "projects"
SHARED_DIR = "../shared"
SCENE_FILE = os.path.join(SHARED_DIR, "scene_schema.json")

os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(PROJECTS_DIR, exist_ok=True)

# Mount media folder so renderer/frontend can access files
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

@app.get("/api/current-scene")
def get_current_scene():
    if os.path.exists(SCENE_FILE):
        with open(SCENE_FILE, "r") as f:
            return json.load(f)
    return {}

@app.post("/api/current-scene")
def save_current_scene(scene: dict):
    with open(SCENE_FILE, "w") as f:
        json.dump(scene, f, indent=2)
    return {"status": "success"}

@app.post("/api/media/upload")
async def upload_media(file: UploadFile = File(...)):
    file_path = os.path.join(MEDIA_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"/media/{file.filename}", "filename": file.filename}

# Mount frontend
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    print(f"Warning: Frontend dist not found at {FRONTEND_DIST}. Serve frontend separately or run 'npm run build' in frontend directory.")

if __name__ == "__main__":
    import uvicorn
    # Use environment variables if needed, defaulting to 8000
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
