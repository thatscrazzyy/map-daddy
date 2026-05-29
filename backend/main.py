import os
import json
import urllib.error
import urllib.request
from pathlib import Path
from datetime import datetime, timezone
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import shutil
import re
import time
from collections import defaultdict
from uuid import uuid4

app = FastAPI(title="Map Daddy API")

class RateLimitMiddleware(BaseHTTPMiddleware):
    _instances = []

    def __init__(self, app, limit: int = 100, window: int = 60):
        super().__init__(app)
        self.limit = limit
        self.window = window
        self.requests = defaultdict(list)
        self.upload_limit = 5
        self.upload_requests = defaultdict(list)
        RateLimitMiddleware._instances.append(self)

    @classmethod
    def reset_all(cls):
        for inst in cls._instances:
            inst.requests.clear()
            inst.upload_requests.clear()

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/"):
            client_ip = request.client.host if request.client else "unknown"
            now = time.time()
            
            if request.url.path == "/api/media/upload" and request.method == "POST":
                self.upload_requests[client_ip] = [t for t in self.upload_requests[client_ip] if now - t < self.window]
                if len(self.upload_requests[client_ip]) >= self.upload_limit:
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Too many uploads. Please try again later."}
                    )
                self.upload_requests[client_ip].append(now)
            else:
                self.requests[client_ip] = [t for t in self.requests[client_ip] if now - t < self.window]
                if len(self.requests[client_ip]) >= self.limit:
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Too many requests. Please try again later."}
                    )
                self.requests[client_ip].append(now)
                
        response = await call_next(request)
        return response

def _cors_origins():
    configured = os.getenv("CORS_ORIGINS", "*")
    if configured == "*":
        return ["*"]
    return [origin.strip() for origin in configured.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware, limit=100, window=60)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.abspath(os.getenv("MAP_DADDY_MEDIA_DIR", os.path.join(BASE_DIR, "media")))
PROJECTS_DIR = os.path.abspath(os.getenv("MAP_DADDY_PROJECTS_DIR", os.path.join(BASE_DIR, "projects")))
SHARED_DIR = os.path.abspath(os.path.join(BASE_DIR, "../shared"))
SCENE_FILE = os.path.join(PROJECTS_DIR, "current_scene.json")
EXAMPLE_SCENE_FILE = os.path.join(SHARED_DIR, "example_scene.json")

os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(PROJECTS_DIR, exist_ok=True)

# Mount media folder so renderer/frontend can access files
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

def _relay_session_url():
    configured = os.getenv("MAP_DADDY_RELAY_SESSION_URL")
    if configured:
        return configured
    relay_url = os.getenv("PUBLIC_RELAY_URL") or os.getenv("VITE_MAP_DADDY_RELAY_URL") or "ws://localhost:8080"
    if relay_url.startswith("wss://"):
        relay_url = "https://" + relay_url[len("wss://"):]
    elif relay_url.startswith("ws://"):
        relay_url = "http://" + relay_url[len("ws://"):]
    return relay_url.rstrip("/") + "/sessions"

def _guess_source_type(url):
    lowered = (url or "").split("?")[0].lower()
    if lowered.endswith((".mp4", ".mov", ".mkv", ".avi", ".webm")):
        return "video"
    return "image"

def _safe_upload_name(filename: str):
    name = Path(filename or "upload.bin").name
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    if not name:
        name = "upload.bin"
    stem = Path(name).stem[:80] or "upload"
    suffix = Path(name).suffix[:16]
    return f"{int(datetime.now(timezone.utc).timestamp())}_{stem}{suffix}"

SCENE_VERSION = "0.3.0"

def _safe_project_id(project_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", project_id or ""):
        raise HTTPException(status_code=400, detail="Invalid project id")
    return project_id

def _project_file(project_id: str):
    return os.path.join(PROJECTS_DIR, f"{_safe_project_id(project_id)}.project.json")

def _default_project(name: str = "Untitled Project", project_id = None):
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": project_id or f"project_{uuid4().hex[:12]}",
        "name": name or "Untitled Project",
        "canvas": {
            "width": 1920,
            "height": 1080,
            "backgroundColor": "#000000"
        },
        "media": [],
        "surfaces": [],
        "updatedAt": now
    }

def _normalize_project(project: dict):
    now = datetime.now(timezone.utc).isoformat()
    project_id = project.get("id") or f"project_{uuid4().hex[:12]}"
    canvas = project.get("canvas") or {}
    normalized = {
        "id": _safe_project_id(project_id),
        "name": project.get("name") or "Untitled Project",
        "canvas": {
            "width": int(canvas.get("width") or 1920),
            "height": int(canvas.get("height") or 1080),
            "backgroundColor": canvas.get("backgroundColor") or "#000000"
        },
        "media": [],
        "surfaces": [],
        "updatedAt": project.get("updatedAt") or now
    }
    for index, item in enumerate(project.get("media") or []):
        normalized["media"].append({
            "id": item.get("id") or f"media_{index + 1}",
            "type": "video" if item.get("type") == "video" else "image",
            "url": item.get("url") or "",
            "name": item.get("name") or item.get("id") or f"Media {index + 1}"
        })
    for index, surface in enumerate(project.get("surfaces") or []):
        source = surface.get("sourceRect") or {}
        quad = surface.get("destinationQuad") or []
        if len(quad) != 4:
            width = normalized["canvas"]["width"]
            height = normalized["canvas"]["height"]
            quad = [
                {"x": round(width * 0.25), "y": round(height * 0.25)},
                {"x": round(width * 0.75), "y": round(height * 0.25)},
                {"x": round(width * 0.75), "y": round(height * 0.75)},
                {"x": round(width * 0.25), "y": round(height * 0.75)},
            ]
        normalized["surfaces"].append({
            "id": surface.get("id") or f"surface_{index + 1}",
            "name": surface.get("name") or f"Surface {index + 1}",
            "mediaId": surface.get("mediaId") or "",
            "visible": surface.get("visible", True),
            "opacity": float(surface.get("opacity", 1)),
            "blendMode": surface.get("blendMode") or "source-over",
            "sourceRect": {
                "x": float(source.get("x", 0)),
                "y": float(source.get("y", 0)),
                "width": float(source.get("width") or normalized["canvas"]["width"]),
                "height": float(source.get("height") or normalized["canvas"]["height"]),
            },
            "destinationQuad": [{"x": float(point.get("x", 0)), "y": float(point.get("y", 0))} for point in quad[:4]]
        })
    return normalized

def _project_summary(project: dict):
    return {
        "id": project.get("id"),
        "name": project.get("name"),
        "updatedAt": project.get("updatedAt"),
        "surfaceCount": len(project.get("surfaces") or []),
        "mediaCount": len(project.get("media") or [])
    }

def _default_vertices(shape_type, width, height, inset=0.2):
    if shape_type == "triangle":
        return [
            [round(width * 0.5), round(height * 0.18)],
            [round(width * 0.82), round(height * 0.78)],
            [round(width * 0.18), round(height * 0.78)],
        ]
    return [
        [round(width * inset), round(height * inset)],
        [round(width * (1 - inset)), round(height * inset)],
        [round(width * (1 - inset)), round(height * (1 - inset))],
        [round(width * inset), round(height * (1 - inset))],
    ]

def _ensure_shape(scene, shape):
    if any(existing.get("id") == shape["id"] for existing in scene["shapes"]):
        return
    scene["shapes"].append(shape)

def _migrate_surface(scene, surface, index):
    width = scene["output"]["width"]
    height = scene["output"]["height"]
    shape_type = "triangle" if surface.get("type") == "triangle" else "quad"
    surface_id = surface.get("id") or f"surface_{index + 1}"
    input_shape_id = surface.get("input_shape_id") or f"{surface_id}_input"
    output_shape_id = surface.get("output_shape_id") or f"{surface_id}_output"

    _ensure_shape(scene, {
        "id": input_shape_id,
        "name": f"{surface.get('name') or f'Surface {index + 1}'} Crop",
        "type": shape_type,
        "vertices": surface.get("source_points") or _default_vertices(shape_type, width, height, 0),
        "locked": False,
    })
    _ensure_shape(scene, {
        "id": output_shape_id,
        "name": f"{surface.get('name') or f'Surface {index + 1}'} Output",
        "type": shape_type,
        "vertices": surface.get("destination_points") or _default_vertices(shape_type, width, height),
        "locked": bool(surface.get("locked", False)),
    })
    scene["mappings"].append({
        "id": surface_id,
        "name": surface.get("name") or f"Mapping {index + 1}",
        "source_id": surface.get("source_id") or "",
        "input_shape_id": input_shape_id,
        "output_shape_id": output_shape_id,
        "visible": surface.get("visible", True),
        "locked": surface.get("locked", False),
        "solo": surface.get("solo", False),
        "opacity": float(surface.get("opacity", 1.0)),
        "blend_mode": surface.get("blend_mode", "normal"),
        "depth": int(surface.get("depth", index)),
    })

def migrate_scene(scene: dict):
    scene = json.loads(json.dumps(scene or {}))
    canvas = scene.pop("canvas", {}) or {}
    output = scene.get("output") or {}
    scene["version"] = SCENE_VERSION
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
    scene["shapes"] = list(scene.get("shapes") or [])
    scene["mappings"] = list(scene.get("mappings") or [])
    for index, surface in enumerate(scene.get("surfaces") or []):
        _migrate_surface(scene, surface, index)
    scene.pop("surfaces", None)

    for index, mapping in enumerate(scene["mappings"]):
        mapping.setdefault("visible", True)
        mapping.setdefault("locked", False)
        mapping.setdefault("solo", False)
        mapping.setdefault("opacity", 1.0)
        mapping.setdefault("blend_mode", "normal")
        mapping.setdefault("depth", index)
        mapping.setdefault("source_id", "")

    metadata = scene.setdefault("metadata", {})
    metadata.setdefault("created_by", "Map Daddy")
    metadata.setdefault("created_at", "")
    metadata["updated_at"] = datetime.now(timezone.utc).isoformat()
    return scene

@app.get("/api/current-scene")
def get_current_scene():
    if os.path.exists(SCENE_FILE):
        with open(SCENE_FILE, "r") as f:
            raw = json.load(f)
        migrated = migrate_scene(raw)
        if migrated.get("version") != raw.get("version") or "surfaces" in raw:
            try:
                with open(SCENE_FILE, "w") as f:
                    json.dump(migrated, f, indent=2)
            except Exception as e:
                print(f"Warning: Failed to save migrated scene: {e}")
        return migrated
    if os.path.exists(EXAMPLE_SCENE_FILE):
        with open(EXAMPLE_SCENE_FILE, "r") as f:
            raw = json.load(f)
        migrated = migrate_scene(raw)
        try:
            with open(SCENE_FILE, "w") as f:
                json.dump(migrated, f, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save migrated example scene: {e}")
        return migrated
    return {}

@app.post("/api/current-scene")
def save_current_scene(scene: dict):
    scene = migrate_scene(scene)
    with open(SCENE_FILE, "w") as f:
        json.dump(scene, f, indent=2)
    return {"status": "success"}

@app.get("/api/projects")
def list_projects():
    projects = []
    for path in Path(PROJECTS_DIR).glob("*.project.json"):
        try:
            with open(path, "r") as f:
                projects.append(_project_summary(_normalize_project(json.load(f))))
        except Exception as e:
            print(f"Warning: Failed to read project {path}: {e}")
    projects.sort(key=lambda item: item.get("updatedAt") or "", reverse=True)
    return projects

@app.post("/api/projects")
async def create_project(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    project = _default_project((body or {}).get("name") or "Untitled Project")
    project = _normalize_project(project)
    with open(_project_file(project["id"]), "w") as f:
        json.dump(project, f, indent=2)
    return project

@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    path = _project_file(project_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Project not found")
    with open(path, "r") as f:
        return _normalize_project(json.load(f))

@app.put("/api/projects/{project_id}")
def save_project(project_id: str, project: dict):
    _safe_project_id(project_id)
    project["id"] = project_id
    project["updatedAt"] = datetime.now(timezone.utc).isoformat()
    normalized = _normalize_project(project)
    with open(_project_file(project_id), "w") as f:
        json.dump(normalized, f, indent=2)
    return normalized

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    path = _project_file(project_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Project not found")
    os.remove(path)
    return {"status": "success"}

MAX_UPLOAD_SIZE = 50 * 1024 * 1024 # 50MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".mp4", ".mov", ".mkv", ".avi", ".webm"}

@app.post("/api/media/upload")
async def upload_media(file: UploadFile = File(...)):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")
    
    # Check file size (approximate)
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    safe_name = _safe_upload_name(file.filename)
    file_path = os.path.join(MEDIA_DIR, safe_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"/media/{safe_name}", "filename": safe_name}

@app.delete("/api/media/{filename}")
def delete_media(filename: str):
    file_path = os.path.join(MEDIA_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="File not found")

@app.post("/api/sessions/create")
async def create_projection_session(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    relay_request = urllib.request.Request(
        _relay_session_url(),
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(relay_request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=e.code, detail="Relay refused session creation")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not create relay session: {e}")

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
