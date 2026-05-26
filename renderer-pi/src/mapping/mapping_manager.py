import copy


class Mapping:
    def __init__(self, data):
        self.id = data.get("id")
        self.name = data.get("name") or self.id or "Mapping"
        self.source_id = data.get("source_id") or ""
        self.input_shape_id = data.get("input_shape_id")
        self.output_shape_id = data.get("output_shape_id")
        self.visible = bool(data.get("visible", True))
        self.locked = bool(data.get("locked", False))
        self.solo = bool(data.get("solo", False))
        self.opacity = float(data.get("opacity", 1.0))
        self.blend_mode = data.get("blend_mode", "normal")
        self.depth = int(data.get("depth", 0))

    def validate(self):
        if not self.id:
            raise ValueError("Mapping missing id")
        if not self.input_shape_id:
            raise ValueError(f"Mapping {self.id} missing input_shape_id")
        if not self.output_shape_id:
            raise ValueError(f"Mapping {self.id} missing output_shape_id")


class MappingManager:
    def __init__(self, sources, shapes, mappings):
        self.sources = {source.get("id"): source for source in sources}
        self.shapes = {shape.id: shape for shape in shapes}
        self.mappings = [mapping if isinstance(mapping, Mapping) else Mapping(mapping) for mapping in mappings]
        for mapping in self.mappings:
            mapping.validate()

    def ordered_mappings(self):
        return sorted(self.mappings, key=lambda mapping: mapping.depth)

    def visible_mappings(self):
        ordered = self.ordered_mappings()
        has_solo = any(mapping.solo for mapping in ordered)
        return [
            mapping for mapping in ordered
            if mapping.visible and (not has_solo or mapping.solo)
        ]

    def resolve_source(self, mapping):
        return self.sources.get(mapping.source_id)

    def resolve_input_shape(self, mapping):
        return self.shapes.get(mapping.input_shape_id)

    def resolve_output_shape(self, mapping):
        return self.shapes.get(mapping.output_shape_id)

    def validate_references(self):
        errors = []
        for mapping in self.mappings:
            if mapping.source_id and mapping.source_id not in self.sources:
                errors.append(f"Mapping {mapping.id} references missing source {mapping.source_id}")
            if mapping.input_shape_id not in self.shapes:
                errors.append(f"Mapping {mapping.id} references missing input shape {mapping.input_shape_id}")
            if mapping.output_shape_id not in self.shapes:
                errors.append(f"Mapping {mapping.id} references missing output shape {mapping.output_shape_id}")
        return errors

    def add_mapping(self, mapping):
        self.mappings.append(Mapping(copy.deepcopy(mapping)))

    def remove_mapping(self, mapping_id):
        self.mappings = [mapping for mapping in self.mappings if mapping.id != mapping_id]

    def move_mapping(self, mapping_id, direction):
        ordered = self.ordered_mappings()
        index = next((i for i, mapping in enumerate(ordered) if mapping.id == mapping_id), -1)
        target = index + direction
        if index < 0 or target < 0 or target >= len(ordered):
            return
        ordered[index], ordered[target] = ordered[target], ordered[index]
        for depth, mapping in enumerate(ordered):
            mapping.depth = depth

    def duplicate_mapping(self, mapping_id):
        original = next((mapping for mapping in self.mappings if mapping.id == mapping_id), None)
        if not original:
            return None
        data = copy.deepcopy(original.__dict__)
        data["id"] = f"{original.id}_copy"
        data["name"] = f"{original.name} Copy"
        data["solo"] = False
        data["depth"] = max((mapping.depth for mapping in self.mappings), default=-1) + 1
        duplicate = Mapping(data)
        self.mappings.append(duplicate)
        return duplicate

    def set_locked(self, mapping_id, locked):
        mapping = next((item for item in self.mappings if item.id == mapping_id), None)
        if mapping:
            mapping.locked = bool(locked)

    def set_visible(self, mapping_id, visible):
        mapping = next((item for item in self.mappings if item.id == mapping_id), None)
        if mapping:
            mapping.visible = bool(visible)

    def set_opacity(self, mapping_id, opacity):
        mapping = next((item for item in self.mappings if item.id == mapping_id), None)
        if mapping:
            mapping.opacity = max(0.0, min(1.0, float(opacity)))
