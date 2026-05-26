# Mapping Model

Map Daddy `0.3.0` uses a MapMap-inspired model while keeping Map Daddy's hosted controller, relay, backend, and receiver architecture.

```text
Source/Paint -> Mapping/Layer -> Shape
```

## Source

A source is loadable or generated content in `sources[]`.

- `image`: static media URL.
- `video`: video media URL opened by the receiver.
- `color` or `generated`: procedural placeholder support.

Sources carry stable IDs, names, dimensions, playback options, and optional source-level opacity.

## Shape

A shape is reusable geometry in `shapes[]`.

- `quad`: four vertices, rendered with perspective transform.
- `triangle`: three vertices, rendered with affine transform.
- `mesh`: reserved placeholder for grid mapping.
- `ellipse` and `polygon`: reserved placeholders.

Input shapes describe the source crop/sample area. Output shapes describe projector/output placement.

## Mapping

A mapping is the layer object in `mappings[]`. It connects one source to one input shape and one output shape.

Important mapping fields:

- `source_id`
- `input_shape_id`
- `output_shape_id`
- `visible`
- `locked`
- `solo`
- `opacity`
- `blend_mode`
- `depth`

The renderer draws visible mappings ordered by `depth`. If any mapping is soloed, only soloed visible mappings render.

## Migration

Map Daddy still accepts `0.2.0` scenes with `surfaces[]`.

- `surface.source_points` becomes an input shape's `vertices`.
- `surface.destination_points` becomes an output shape's `vertices`.
- `surface.source_id` becomes `mapping.source_id`.
- Surface visibility, lock, opacity, blend mode, and depth become mapping properties.

New saves are written as `0.3.0`.
