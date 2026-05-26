from .transforms import validate_points


class Shape:
    def __init__(self, data):
        self.id = data.get("id")
        self.name = data.get("name") or self.id or "Shape"
        self.type = (data.get("type") or "quad").lower()
        self.vertices = data.get("vertices") or []
        self.locked = bool(data.get("locked", False))
        self.transform = data.get("transform") or {}
        self.mesh = data.get("mesh") or {}

    def validate(self):
        if not self.id:
            raise ValueError("Shape missing id")
        if self.type == "quad":
            validate_points(self.vertices, f"{self.id}.vertices", 4)
        elif self.type == "triangle":
            validate_points(self.vertices, f"{self.id}.vertices", 3)
        elif self.type in ("mesh", "ellipse", "polygon"):
            if not isinstance(self.vertices, list) or len(self.vertices) < 3:
                raise ValueError(f"{self.id}.vertices must contain at least three points")
        else:
            raise ValueError(f"Unsupported shape type: {self.type}")


def shape_from_dict(data):
    shape = Shape(data)
    shape.validate()
    return shape
