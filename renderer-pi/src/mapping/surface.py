from .transforms import validate_quad_points


class Surface:
    def __init__(self, data):
        self.id = data.get("id")
        self.name = data.get("name") or self.id or "Surface"
        self.type = data.get("type", "quad")
        self.visible = bool(data.get("visible", True))
        self.locked = bool(data.get("locked", False))
        self.opacity = float(data.get("opacity", 1.0))
        self.blend_mode = data.get("blend_mode", "normal")
        self.source_id = data.get("source_id")
        self.source_points = data.get("source_points")
        self.destination_points = data.get("destination_points")

    def validate(self):
        if not self.id:
            raise ValueError("Surface missing id")
        validate_quad_points(self.source_points, f"{self.id}.source_points")
        validate_quad_points(self.destination_points, f"{self.id}.destination_points")


class QuadSurface(Surface):
    pass


class PolygonSurface(Surface):
    def validate(self):
        raise ValueError("Polygon surfaces are reserved for a future renderer")


def surface_from_dict(data):
    surface_type = (data.get("type") or "quad").lower()
    if surface_type == "quad":
        surface = QuadSurface(data)
    elif surface_type == "polygon":
        surface = PolygonSurface(data)
    else:
        raise ValueError(f"Unsupported surface type: {surface_type}")
    surface.validate()
    return surface
