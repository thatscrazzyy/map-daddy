import copy
import json
from dataclasses import dataclass

from .surface import surface_from_dict

SCENE_VERSION = "0.2.0"


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


def migrate_scene(scene):
    migrated = copy.deepcopy(scene or {})
    output = _default_output(migrated)
    migrated["version"] = migrated.get("version") or SCENE_VERSION
    migrated["project_name"] = migrated.get("project_name") or "Map Daddy Project"
    migrated["output"] = output
    migrated.pop("canvas", None)

    sources = list(migrated.get("sources") or [])
    source_by_url = {source.get("url"): source for source in sources if source.get("url")}

    for index, surface in enumerate(migrated.get("surfaces") or []):
        surface.setdefault("type", "quad")
        surface.setdefault("visible", True)
        surface.setdefault("locked", False)
        surface.setdefault("opacity", 1.0)
        surface.setdefault("blend_mode", "normal")

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
    migrated.setdefault("surfaces", [])
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
    if not isinstance(scene.get("surfaces"), list):
        raise ValueError("Scene surfaces must be a list")

    source_ids = set()
    for source in scene["sources"]:
        if not source.get("id"):
            raise ValueError("Source missing id")
        if source["id"] in source_ids:
            raise ValueError(f"Duplicate source id: {source['id']}")
        source_ids.add(source["id"])
        if source.get("type") not in ("image", "video", "generated"):
            raise ValueError(f"Unsupported source type: {source.get('type')}")
        if source.get("type") in ("image", "video") and not source.get("url"):
            raise ValueError(f"Source {source['id']} missing url")

    for surface_data in scene["surfaces"]:
        surface = surface_from_dict(surface_data)
        if surface.source_id and surface.source_id not in source_ids:
            raise ValueError(f"Surface {surface.id} references missing source {surface.source_id}")
    return True


@dataclass
class Scene:
    raw: dict
    output: dict
    sources: list
    surfaces: list

    @staticmethod
    def from_dict(data):
        scene = migrate_scene(data)
        validate_scene(scene)
        return Scene(
            raw=scene,
            output=scene["output"],
            sources=scene["sources"],
            surfaces=[surface_from_dict(surface) for surface in scene["surfaces"]],
        )

    @staticmethod
    def from_json(path):
        with open(path, "r", encoding="utf-8") as file:
            return Scene.from_dict(json.load(file))
