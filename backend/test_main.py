import os
import json
import pytest
from fastapi.testclient import TestClient
from .main import app, SCENE_FILE, EXAMPLE_SCENE_FILE, migrate_scene

client = TestClient(app)

def test_cors_origins():
    response = client.options("/api/current-scene", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert response.status_code == 200

def test_get_current_scene_fallback():
    # If SCENE_FILE does not exist, it should fallback to EXAMPLE_SCENE_FILE or {}
    if os.path.exists(SCENE_FILE):
        os.remove(SCENE_FILE)
    response = client.get("/api/current-scene")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert data.get("version") == "0.3.0"

def test_save_current_scene():
    test_scene = {"project_name": "Test Save", "output": {"width": 800, "height": 600}}
    response = client.post("/api/current-scene", json=test_scene)
    assert response.status_code == 200
    assert response.json() == {"status": "success"}
    
    response2 = client.get("/api/current-scene")
    data = response2.json()
    assert data.get("project_name") == "Test Save"
    assert data.get("output", {}).get("width") == 800
    assert os.path.exists(SCENE_FILE)

def test_upload_media_invalid():
    # Test uploading a file
    file_content = b"fake image data"
    files = {"file": ("test_image.png", file_content, "image/png")}
    response = client.post("/api/media/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "url" in data
    assert "filename" in data
    assert data["filename"].endswith(".png")

def test_migrate_scene_old_format():
    old_scene = {
        "surfaces": [
            {
                "id": "surface_1",
                "name": "Box",
                "media": "/media/test.mp4",
                "source_points": [[0,0], [100,0], [100,100], [0,100]],
                "destination_points": [[10,10], [90,10], [90,90], [10,90]]
            }
        ]
    }
    migrated = migrate_scene(old_scene)
    assert "surfaces" not in migrated
    assert len(migrated["shapes"]) == 2
    assert len(migrated["mappings"]) == 1
    assert len(migrated["sources"]) == 1
    assert migrated["sources"][0]["url"] == "/media/test.mp4"
