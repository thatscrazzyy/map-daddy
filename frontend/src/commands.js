import { MappingManager, cloneScene, migrateScene } from './mappingManager';

class SceneCommand {
  constructor(label) {
    this.label = label;
  }

  execute(scene) {
    return migrateScene(scene);
  }

  undo(scene) {
    return migrateScene(scene);
  }
}

export class MoveVertexCommand extends SceneCommand {
  constructor(shapeId, vertexIndex, fromPoint, toPoint) {
    super('Move vertex');
    this.shapeId = shapeId;
    this.vertexIndex = vertexIndex;
    this.fromPoint = fromPoint;
    this.toPoint = toPoint;
  }

  execute(scene) {
    return new MappingManager(scene).updateShapeVertex(this.shapeId, this.vertexIndex, this.toPoint);
  }

  undo(scene) {
    return new MappingManager(scene).updateShapeVertex(this.shapeId, this.vertexIndex, this.fromPoint);
  }
}

export class AddMappingCommand extends SceneCommand {
  constructor(shapeType = 'quad', sourceId = '') {
    super('Add mapping');
    this.shapeType = shapeType;
    this.sourceId = sourceId;
    this.addedMappingId = null;
  }

  execute(scene) {
    const beforeIds = new Set((scene.mappings || []).map((mapping) => mapping.id));
    const next = new MappingManager(scene).addMapping(this.shapeType, this.sourceId);
    this.addedMappingId = next.mappings.find((mapping) => !beforeIds.has(mapping.id))?.id || this.addedMappingId;
    return next;
  }

  undo(scene) {
    if (!this.addedMappingId) return migrateScene(scene);
    return new MappingManager(scene).removeMapping(this.addedMappingId);
  }
}

export class DeleteMappingCommand extends SceneCommand {
  constructor(mappingId) {
    super('Delete mapping');
    this.mappingId = mappingId;
    this.before = null;
  }

  execute(scene) {
    this.before = cloneScene(scene);
    return new MappingManager(scene).removeMapping(this.mappingId);
  }

  undo() {
    return migrateScene(this.before);
  }
}

export class DuplicateMappingCommand extends SceneCommand {
  constructor(mappingId) {
    super('Duplicate mapping');
    this.mappingId = mappingId;
    this.duplicatedMappingId = null;
  }

  execute(scene) {
    const beforeIds = new Set((scene.mappings || []).map((mapping) => mapping.id));
    const next = new MappingManager(scene).duplicateMapping(this.mappingId);
    this.duplicatedMappingId = next.mappings.find((mapping) => !beforeIds.has(mapping.id))?.id || this.duplicatedMappingId;
    return next;
  }

  undo(scene) {
    if (!this.duplicatedMappingId) return migrateScene(scene);
    return new MappingManager(scene).removeMapping(this.duplicatedMappingId);
  }
}

export class ChangeOpacityCommand extends SceneCommand {
  constructor(mappingId, fromOpacity, toOpacity) {
    super('Change opacity');
    this.mappingId = mappingId;
    this.fromOpacity = Number(fromOpacity);
    this.toOpacity = Number(toOpacity);
  }

  execute(scene) {
    return new MappingManager(scene).updateMapping(this.mappingId, { opacity: this.toOpacity });
  }

  undo(scene) {
    return new MappingManager(scene).updateMapping(this.mappingId, { opacity: this.fromOpacity });
  }
}

export class ToggleVisibilityCommand extends SceneCommand {
  constructor(mappingId) {
    super('Toggle visibility');
    this.mappingId = mappingId;
  }

  execute(scene) {
    const mapping = new MappingManager(scene).getMapping(this.mappingId);
    return new MappingManager(scene).updateMapping(this.mappingId, { visible: !(mapping?.visible !== false) });
  }

  undo(scene) {
    return this.execute(scene);
  }
}

export class ToggleLockCommand extends SceneCommand {
  constructor(mappingId) {
    super('Toggle lock');
    this.mappingId = mappingId;
  }

  execute(scene) {
    const manager = new MappingManager(scene);
    const mapping = manager.getMapping(this.mappingId);
    return manager.updateMapping(this.mappingId, { locked: !mapping?.locked });
  }

  undo(scene) {
    return this.execute(scene);
  }
}

export class ToggleSoloCommand extends SceneCommand {
  constructor(mappingId) {
    super('Toggle solo');
    this.mappingId = mappingId;
  }

  execute(scene) {
    const manager = new MappingManager(scene);
    const mapping = manager.getMapping(this.mappingId);
    return manager.updateMapping(this.mappingId, { solo: !mapping?.solo });
  }

  undo(scene) {
    return this.execute(scene);
  }
}

export class ReorderMappingCommand extends SceneCommand {
  constructor(mappingId, direction) {
    super('Reorder mapping');
    this.mappingId = mappingId;
    this.direction = direction;
  }

  execute(scene) {
    return new MappingManager(scene).moveMapping(this.mappingId, this.direction);
  }

  undo(scene) {
    return new MappingManager(scene).moveMapping(this.mappingId, -this.direction);
  }
}

export class AssignSourceCommand extends SceneCommand {
  constructor(mappingId, fromSourceId, toSourceId) {
    super('Assign source');
    this.mappingId = mappingId;
    this.fromSourceId = fromSourceId || '';
    this.toSourceId = toSourceId || '';
  }

  execute(scene) {
    return new MappingManager(scene).updateMapping(this.mappingId, { source_id: this.toSourceId });
  }

  undo(scene) {
    return new MappingManager(scene).updateMapping(this.mappingId, { source_id: this.fromSourceId });
  }
}

export class UpdateSceneSnapshotCommand extends SceneCommand {
  constructor(label, beforeScene, afterScene) {
    super(label);
    this.beforeScene = beforeScene;
    this.afterScene = afterScene;
  }

  execute() {
    return migrateScene(this.afterScene);
  }

  undo() {
    return migrateScene(this.beforeScene);
  }
}
