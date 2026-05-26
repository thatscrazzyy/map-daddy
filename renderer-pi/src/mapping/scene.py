import copy
import json
from dataclasses import dataclass

from .mapping_manager import MappingManager
from .shape import shape_from_dict

SCENE_VERSION = "0.3.0"


def _default_output(scene):
    canvas = scene.get("canvas") or {}
    output = scene.get("output") or {}
    return {
        "width": int(output.get("width") or canvas.get("width") or 1920),
        "height": int(output.get("height") or canvas.get("height") or 1080),
        "background": output.get("background") or "#000000",
    }


def _guess_source_type(url):
    lowered = (url or "").split("?")[0].lower()
    if lowered.endswith((".mp4", ".mov", ".mkv", ".avi", ".webm")):
        return "video"
    return "image"


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
    if not any(existing.get("id") == shape["id"] for existing in scene["shapes"]):
        scene["shapes"].append(shape)


def _migrate_surface(scene, surface, index):
    width = scene["output"]["width"]
    height = scene["output"]["height"]
    shape_type = "triangle" if surface.get("type") == "triangle" else "quad"
    surface_id = surface.get("id") or f"surface_{index + 1}"
    input_shape_id = surface.get("input_shape_id") or f"{surface_id}_input"
    output_shape_id = surface.get("output_shape_id") or f"{surface_id}_output"

    _ensure_shape(
        scene,
        {
            "id": input_shape_id,
            "name": f"{surface.get('name') or f'Surface {index + 1}'} Crop",
            "type": shape_type,
            "vertices": surface.get("source_points") or _default_vertices(shape_type, width, height, 0),
            "locked": False,
        },
    )
    _ensure_shape(
        scene,
        {
            "id": output_shape_id,
            "name": f"{surface.get('name') or f'Surface {index + 1}'} Output",
            "type": shape_type,
            "vertices": surface.get("destination_points") or _default_vertices(shape_type, width, height),
            "locked": bool(surface.get("locked", False)),
        },
    )
    scene["mappings"].append(
        {
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
        }
    )


def migrate_scene(scene):
    migrated = copy.deepcopy(scene or {})
    output = _default_output(migrated)
    migrated["version"] = SCENE_VERSION
    migrated["project_name"] = migrated.get("project_name") or "Map Daddy Project"
    migrated["output"] = output
    migrated.pop("canvas", None)

    sources = list(migrated.get("sources") or [])
    source_by_url = {source.get("url"): source for source in sources if source.get("url")}
    for index, surface in enumerate(migrated.get("surfaces") or []):
        media_url = surface.pop("media", None)
        if media_url and not surface.get("source_id"):
            source = source_by_url.get(media_url)
            if not source:
                source = {
                    "id": f"source_{index + 1}",
                    "name": f"{surface.get('name') or 'Surface'} Media",
                    "type": _guess_source_type(media_url),
                    "url": media_url,
                    "width": output["width"],
                    "height": output["height"],
                    "loop": True,
                    "muted": True,
                }
                sources.append(source)
                source_by_url[media_url] = source
            surface["source_id"] = source["id"]

    migrated["sources"] = sources
    migrated["shapes"] = list(migrated.get("shapes") or [])
    migrated["mappings"] = list(migrated.get("mappings") or [])
    for index, surface in enumerate(migrated.get("surfaces") or []):
        surface.setdefault("type", "quad")
        surface.setdefault("visible", True)
        surface.setdefault("locked", False)
        surface.setdefault("opacity", 1.0)
        surface.setdefault("blend_mode", "normal")
        _migrate_surface(migrated, surface, index)
    migrated.pop("surfaces", None)

    for index, mapping in enumerate(migrated["mappings"]):
        mapping.setdefault("visible", True)
        mapping.setdefault("locked", False)
        mapping.setdefault("solo", False)
        mapping.setdefault("opacity", 1.0)
        mapping.setdefault("blend_mode", "normal")
        mapping.setdefault("depth", index)
        mapping.setdefault("source_id", "")

    migrated.setdefault(
        "metadata",
        {"created_by": "Map Daddy", "created_at": "", "updated_at": ""},
    )
    return migrated


def validate_scene(scene):
    if not isinstance(scene, dict):
        raise ValueError("Scene must be a JSON object")
    if "output" not in scene:
        raise ValueError("Scene missing output")
    if not isinstance(scene.get("sources"), list):
        raise ValueError("Scene sources must be a list")
    if not isinstance(scene.get("shapes"), list):
        raise ValueError("Scene shapes must be a list")
    if not isinstance(scene.get("mappings"), list):
        raise ValueError("Scene mappings must be a list")

    source_ids = set()
    for source in scene["sources"]:
        if not source.get("id"):
            raise ValueError("Source missing id")
        if source["id"] in source_ids:
            raise ValueError(f"Duplicate source id: {source['id']}")
        source_ids.add(source["id"])
        if source.get("type") not in ("image", "video", "color", "generated"):
            raise ValueError(f"Unsupported source type: {source.get('type')}")
        if source.get("type") in ("image", "video") and not source.get("url"):
            raise ValueError(f"Source {source['id']} missing url")

    shapes = [shape_from_dict(shape) for shape in scene["shapes"]]
    manager = MappingManager(scene["sources"], shapes, scene["mappings"])
    reference_errors = manager.validate_references()
    if reference_errors:
        raise ValueError("; ".join(reference_errors))
    return shapes, manager


@dataclass
class Scene:
    raw: dict
    output: dict
    sources: list
    shapes: list
    mappings: list
    manager: MappingManager

    @staticmethod
    def from_dict(data):
        scene = migrate_scene(data)
        shapes, manager = validate_scene(scene)
        return Scene(
            raw=scene,
            output=scene["output"],
            sources=scene["sources"],
            shapes=shapes,
            mappings=manager.mappings,
            manager=manager,
        )

    @staticmethod
    def from_json(path):
        with open(path, "r", encoding="utf-8") as file:
            return Scene.from_dict(json.load(file))
