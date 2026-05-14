# Mapping Model

Map Daddy's mapping model is inspired by ofxPiMapper's separation between sources, surfaces, managers, and project persistence.

## Source

A source is loadable content:

- `image`: PNG, JPG, JPEG, or WebP when OpenCV supports it.
- `video`: downloaded file opened with OpenCV `VideoCapture`.
- `generated`: reserved for future procedural content.

Sources live in `sources[]` and have stable IDs, names, types, URLs, dimensions, and playback metadata.

## Surface

A surface is a render target shape. The MVP supports quad surfaces:

- `source_points`: texture coordinates in the source media.
- `destination_points`: projector/output coordinates.
- `source_id`: source assigned to the surface.
- `opacity`, `visible`, `locked`, and `blend_mode`.

Polygon and grid surfaces are reserved for future renderer work.

## Mapper

The mapper owns a scene, builds source and surface objects, resolves `source_id`, renders visible surfaces in order, and applies OpenCV perspective warps for quads.

Unmapped surfaces are valid in the editor and skipped by the renderer.

## Scene

A scene is saved JSON containing:

- `version`
- `project_name`
- `output`
- `sources`
- `surfaces`
- `metadata`

Legacy scenes that stored `surface.media` are migrated by creating a source and setting `surface.source_id`.
