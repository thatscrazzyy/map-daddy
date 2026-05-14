import os
import json
from datetime import datetime, timezone
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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(BASE_DIR, "media")
PROJECTS_DIR = os.path.join(BASE_DIR, "projects")
SHARED_DIR = os.path.abspath(os.path.join(BASE_DIR, "../shared"))
SCENE_FILE = os.path.join(PROJECTS_DIR, "current_scene.json")
EXAMPLE_SCENE_FILE = os.path.join(SHARED_DIR, "example_scene.json")

os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(PROJECTS_DIR, exist_ok=True)

# Mount media folder so renderer/frontend can access files
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

def _guess_source_type(url):
    lowered = (url or "").split("?")[0].lower()
    if lowered.endswith((".mp4", ".mov", ".mkv", ".avi", ".webm")):
        return "video"
    return "image"

def migrate_scene(scene: dict):
    scene = json.loads(json.dumps(scene or {}))
    canvas = scene.pop("canvas", {}) or {}
    output = scene.get("output") or {}
    scene["version"] = scene.get("version") or "0.2.0"
    scene["project_name"] = scene.get("project_name") or "Map Daddy Project"
    scene["output"] = {
        "width": int(output.get("width") or canvas.get("width") or 1920),
        "height": int(output.get("height") or canvas.get("height") or 1080),
        "background": output.get("background") or "#000000"
    }

    sources = list(scene.get("sources") or [])
    sources_by_url = {source.get("url"): source for source in sources if source.get("url")}
    for index, surface in enumerate(scene.get("surfaces") or []):
        surface.setdefault("type", "quad")
        surface.setdefault("visible", True)
        surface.setdefault("locked", False)
        surface.setdefault("opacity", 1.0)
        surface.setdefault("blend_mode", "normal")
        media_url = surface.pop("media", None)
        if media_url and not surface.get("source_id"):
            source = sources_by_url.get(media_url)
            if not source:
                source = {
                    "id": f"source_{index + 1}",
                    "name": f"{surface.get('name') or 'Surface'} Media",
                    "type": _guess_source_type(media_url),
                    "url": media_url,
                    "width": scene["output"]["width"],
                    "height": scene["output"]["height"],
                    "loop": True,
                    "muted": True
                }
                sources.append(source)
                sources_by_url[media_url] = source
            surface["source_id"] = source["id"]

    scene["sources"] = sources
    scene.setdefault("surfaces", [])
    metadata = scene.setdefault("metadata", {})
    metadata.setdefault("created_by", "Map Daddy")
    metadata.setdefault("created_at", "")
    metadata["updated_at"] = datetime.now(timezone.utc).isoformat()
    return scene

@app.get("/api/current-scene")
def get_current_scene():
    if os.path.exists(SCENE_FILE):
        with open(SCENE_FILE, "r") as f:
            return migrate_scene(json.load(f))
    if os.path.exists(EXAMPLE_SCENE_FILE):
        with open(EXAMPLE_SCENE_FILE, "r") as f:
            return json.load(f)
    return {}

@app.post("/api/current-scene")
def save_current_scene(scene: dict):
    scene = migrate_scene(scene)
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
