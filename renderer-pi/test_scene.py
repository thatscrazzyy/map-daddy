import pytest
from src.mapping.scene import migrate_scene, validate_scene, Scene

def test_migrate_scene_empty():
    scene = migrate_scene(None)
    assert scene["version"] == "0.3.0"
    assert "output" in scene
    assert "sources" in scene
    assert "shapes" in scene
    assert "mappings" in scene
    assert scene["project_name"] == "Map Daddy Project"

def test_migrate_scene_v0_2():
    old_scene = {
        "surfaces": [
            {
                "id": "surf_1",
                "name": "Surface 1",
                "media": "/media/test.png",
                "source_points": [[0,0], [1,0], [1,1], [0,1]],
                "destination_points": [[10,10], [20,10], [20,20], [10,20]]
            }
        ]
    }
    migrated = migrate_scene(old_scene)
    assert "surfaces" not in migrated
    assert len(migrated["sources"]) == 1
    assert migrated["sources"][0]["url"] == "/media/test.png"
    assert len(migrated["shapes"]) == 2
    assert len(migrated["mappings"]) == 1
    mapping = migrated["mappings"][0]
    assert mapping["source_id"] == migrated["sources"][0]["id"]
    assert mapping["id"] == "surf_1"

def test_validate_scene_invalid():
    with pytest.raises(ValueError, match="Scene must be a JSON object"):
        validate_scene([])
    
    with pytest.raises(ValueError, match="Scene missing output"):
        validate_scene({})

    valid_base = {
        "output": {"width": 1920, "height": 1080},
        "sources": [],
        "shapes": [],
        "mappings": []
    }
    
    # Valid
    validate_scene(valid_base)
    
    # Invalid sources type
    invalid_sources = dict(valid_base)
    invalid_sources["sources"] = {}
    with pytest.raises(ValueError, match="Scene sources must be a list"):
        validate_scene(invalid_sources)

def test_scene_from_dict():
    scene_dict = {
        "output": {"width": 800, "height": 600},
        "sources": [],
        "shapes": [],
        "mappings": []
    }
    scene = Scene.from_dict(scene_dict)
    assert scene.output["width"] == 800
    assert len(scene.sources) == 0
    assert scene.manager is not None
