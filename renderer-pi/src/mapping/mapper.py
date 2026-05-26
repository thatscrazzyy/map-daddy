import numpy as np

from .scene import Scene
from .source import Source
from .transforms import alpha_blend, warp_quad, warp_triangle


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
        self.manager = self.scene.manager
        self.unsupported_warnings = set()

    def release(self):
        for source in self.sources.values():
            source.release()

    def _source_points_for_frame(self, source, input_shape, frame):
        actual_h, actual_w = frame.shape[:2]
        declared_w = float(source.declared_width or actual_w)
        declared_h = float(source.declared_height or actual_h)
        if declared_w <= 0 or declared_h <= 0:
            return input_shape.vertices
        scale_x = actual_w / declared_w
        scale_y = actual_h / declared_h
        return [[x * scale_x, y * scale_y] for x, y in input_shape.vertices]

    def _warn_once(self, key, message):
        if key not in self.unsupported_warnings:
            self.unsupported_warnings.add(key)
            print(message)

    def render_frame(self):
        width, height = self.output_size
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:, :] = self.background

        for mapping in self.manager.visible_mappings():
            if not mapping.source_id:
                continue
            source = self.sources.get(mapping.source_id)
            if not source:
                print(f"[Map Daddy Receiver] Missing source for mapping {mapping.id}: {mapping.source_id}")
                continue
            input_shape = self.manager.resolve_input_shape(mapping)
            output_shape = self.manager.resolve_output_shape(mapping)
            if not input_shape or not output_shape:
                print(f"[Map Daddy Receiver] Mapping {mapping.id} has missing shape references")
                continue
            try:
                if input_shape.type != output_shape.type:
                    self._warn_once(
                        f"{mapping.id}:type-mismatch",
                        f"[Map Daddy Receiver] Mapping {mapping.id} skipped: input/output shape types differ",
                    )
                    continue
                if output_shape.type in ("mesh", "ellipse", "polygon"):
                    self._warn_once(
                        f"{mapping.id}:{output_shape.type}",
                        f"[Map Daddy Receiver] Mapping {mapping.id} uses {output_shape.type}, which is reserved for a future renderer",
                    )
                    continue

                source_frame = source.get_frame()
                source_points = self._source_points_for_frame(source, input_shape, source_frame)
                if output_shape.type == "triangle":
                    warped, mask = warp_triangle(
                        source_frame,
                        source_points,
                        output_shape.vertices,
                        self.output_size,
                    )
                else:
                    warped, mask = warp_quad(
                        source_frame,
                        source_points,
                        output_shape.vertices,
                        self.output_size,
                    )
                source_opacity = float(getattr(source, "opacity", 1.0))
                frame = alpha_blend(frame, warped, mask, mapping.opacity * source_opacity)
            except Exception as exc:
                print(f"[Map Daddy Receiver] Render failed for {mapping.id}: {exc}")

        return frame
