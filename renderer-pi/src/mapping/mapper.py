import numpy as np

from .scene import Scene
from .source import Source
from .transforms import alpha_blend, warp_quad


def parse_hex_color(value):
    if not isinstance(value, str) or not value.startswith("#") or len(value) != 7:
        return (0, 0, 0)
    try:
        return tuple(int(value[i : i + 2], 16) for i in (1, 3, 5))
    except ValueError:
        return (0, 0, 0)


class Mapper:
    def __init__(self, scene_data, media_cache, output_size=None):
        self.media_cache = media_cache
        self.scene = Scene.from_dict(scene_data)
        width = int(self.scene.output.get("width") or 1920)
        height = int(self.scene.output.get("height") or 1080)
        if output_size:
            width, height = output_size
        self.output_size = (width, height)
        self.background = parse_hex_color(self.scene.output.get("background"))
        self.sources = {
            data["id"]: Source.from_dict(data, self.media_cache)
            for data in self.scene.sources
        }
        self.surfaces = self.scene.surfaces

    def release(self):
        for source in self.sources.values():
            source.release()

    def _source_points_for_frame(self, source, surface, frame):
        actual_h, actual_w = frame.shape[:2]
        declared_w = float(source.declared_width or actual_w)
        declared_h = float(source.declared_height or actual_h)
        if declared_w <= 0 or declared_h <= 0:
            return surface.source_points
        scale_x = actual_w / declared_w
        scale_y = actual_h / declared_h
        return [[x * scale_x, y * scale_y] for x, y in surface.source_points]

    def render_frame(self):
        width, height = self.output_size
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:, :] = self.background

        for surface in self.surfaces:
            if not surface.visible:
                continue
            if not surface.source_id:
                continue
            source = self.sources.get(surface.source_id)
            if not source:
                print(f"[Map Daddy Receiver] Missing source for surface {surface.id}: {surface.source_id}")
                continue
            try:
                source_frame = source.get_frame()
                source_points = self._source_points_for_frame(source, surface, source_frame)
                warped, mask = warp_quad(
                    source_frame,
                    source_points,
                    surface.destination_points,
                    self.output_size,
                )
                frame = alpha_blend(frame, warped, mask, surface.opacity)
            except Exception as exc:
                print(f"[Map Daddy Receiver] Render failed for {surface.id}: {exc}")

        return frame
