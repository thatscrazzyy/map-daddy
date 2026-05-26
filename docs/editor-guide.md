# Editor Guide

The Map Daddy controller now separates source editing from projection placement.

## Source / Input Editor

Use the Source/Input editor to adjust the input shape. For image and video sources this controls the sampled crop area. Drag vertices directly on the source canvas.

## Destination / Output Editor

Use the Destination/Output editor to place the mapped media in projector coordinates. Drag output vertices to match the physical projection surface.

## Mapping Panel

The layer panel lists mappings in visual depth order. Select a mapping to edit:

- Show or hide it.
- Lock or unlock it.
- Solo it.
- Change opacity.
- Move it up or down.
- Duplicate or delete it.
- Assign a source.

## Controls

- `Ctrl/Cmd+Z`: undo.
- `Ctrl/Cmd+Shift+Z`: redo.
- `Delete`: remove selected mapping.
- Arrow keys: nudge selected vertex.
- `Shift+Arrow`: faster nudge.
- `Ctrl/Cmd+D`: duplicate selected mapping.
- `F`: fit views.
- `G`: toggle grid snapping.

Grid snapping also snaps vertices to nearby vertices when practical. Vertex drags are committed when the drag ends so scene updates do not spam the relay during every pointer move.
