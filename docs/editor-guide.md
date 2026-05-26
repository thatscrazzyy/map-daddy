# Editor Guide

The Map Daddy controller is renderer-first: the Workspace shows one canvas that represents what the Raspberry Pi receiver sends to the projector.

## Renderer Canvas

Use the Renderer Canvas to place mapped media in projector coordinates. Drag output vertices to match the physical projection surface. Drag empty canvas space to pan when zoomed in.

Input shapes still exist in the scene model so sources can support crop/sample controls later, but the primary hosted workflow keeps the editor focused on the receiver output.

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
- `F`: fit the renderer canvas.
- `G`: toggle grid snapping.

Grid snapping also snaps vertices to nearby vertices when practical. Vertex drags are committed when the drag ends so scene updates do not spam the relay during every pointer move.
