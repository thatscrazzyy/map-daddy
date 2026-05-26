export const SCENE_VERSION = '0.3.0';

export function cloneScene(scene) {
  return JSON.parse(JSON.stringify(scene || {}));
}

export function guessSourceType(url, fileType = '') {
  if (fileType.startsWith('video/')) return 'video';
  const lower = (url || '').split('?')[0].toLowerCase();
  return lower.match(/\.(mp4|mov|mkv|avi|webm)$/) ? 'video' : 'image';
}

export function outputSize(scene) {
  return {
    width: Number(scene?.output?.width || 1920),
    height: Number(scene?.output?.height || 1080)
  };
}

function defaultVertices(type, width, height, inset = 0.2) {
  if (type === 'triangle') {
    return [
      [Math.round(width * 0.5), Math.round(height * 0.18)],
      [Math.round(width * 0.82), Math.round(height * 0.78)],
      [Math.round(width * 0.18), Math.round(height * 0.78)]
    ];
  }
  if (type === 'mesh') {
    return [
      [Math.round(width * 0.2), Math.round(height * 0.2)],
      [Math.round(width * 0.8), Math.round(height * 0.2)],
      [Math.round(width * 0.8), Math.round(height * 0.8)],
      [Math.round(width * 0.2), Math.round(height * 0.8)]
    ];
  }
  return [
    [Math.round(width * inset), Math.round(height * inset)],
    [Math.round(width * (1 - inset)), Math.round(height * inset)],
    [Math.round(width * (1 - inset)), Math.round(height * (1 - inset))],
    [Math.round(width * inset), Math.round(height * (1 - inset))]
  ];
}

export function defaultScene() {
  const width = 1920;
  const height = 1080;
  return {
    version: SCENE_VERSION,
    project_name: 'Map Daddy Demo',
    output: { width, height, background: '#000000' },
    sources: [],
    shapes: [
      {
        id: 'input_shape_demo',
        name: 'Demo Crop',
        type: 'quad',
        vertices: [[0, 0], [width, 0], [width, height], [0, height]],
        locked: false
      },
      {
        id: 'output_shape_demo',
        name: 'Demo Surface',
        type: 'quad',
        vertices: defaultVertices('quad', width, height),
        locked: false
      }
    ],
    mappings: [
      {
        id: 'mapping_demo',
        name: 'Demo Surface',
        source_id: '',
        input_shape_id: 'input_shape_demo',
        output_shape_id: 'output_shape_demo',
        visible: true,
        locked: false,
        solo: false,
        opacity: 1,
        blend_mode: 'normal',
        depth: 0
      }
    ],
    metadata: { created_by: 'Map Daddy', created_at: '', updated_at: '' }
  };
}

function normalizeShape(shape, fallbackType = 'quad') {
  return {
    locked: false,
    transform: {},
    ...shape,
    type: (shape?.type || fallbackType).toLowerCase(),
    vertices: (shape?.vertices || []).map((point) => [Number(point[0] || 0), Number(point[1] || 0)])
  };
}

function ensureShape(scene, shape) {
  const existing = scene.shapes.find((item) => item.id === shape.id);
  if (existing) return existing.id;
  scene.shapes.push(normalizeShape(shape));
  return shape.id;
}

function migrateSurface(scene, surface, index) {
  const width = scene.output.width;
  const height = scene.output.height;
  const type = (surface.type || 'quad').toLowerCase() === 'triangle' ? 'triangle' : 'quad';
  const inputShapeId = surface.input_shape_id || `${surface.id || `surface_${index + 1}`}_input`;
  const outputShapeId = surface.output_shape_id || `${surface.id || `surface_${index + 1}`}_output`;
  const sourceVertices = surface.source_points || defaultVertices(type, width, height, 0);
  const outputVertices = surface.destination_points || defaultVertices(type, width, height);

  ensureShape(scene, {
    id: inputShapeId,
    name: `${surface.name || `Surface ${index + 1}`} Crop`,
    type,
    vertices: sourceVertices,
    locked: false
  });
  ensureShape(scene, {
    id: outputShapeId,
    name: `${surface.name || `Surface ${index + 1}`} Output`,
    type,
    vertices: outputVertices,
    locked: !!surface.locked
  });

  scene.mappings.push({
    id: surface.id || `mapping_${index + 1}`,
    name: surface.name || `Mapping ${index + 1}`,
    source_id: surface.source_id || '',
    input_shape_id: inputShapeId,
    output_shape_id: outputShapeId,
    visible: surface.visible !== false,
    locked: !!surface.locked,
    solo: !!surface.solo,
    opacity: Number(surface.opacity ?? 1),
    blend_mode: surface.blend_mode || 'normal',
    depth: Number(surface.depth ?? index)
  });
}

export function migrateScene(scene) {
  const migrated = cloneScene(scene || defaultScene());
  const canvas = migrated.canvas || {};
  const output = migrated.output || {};
  migrated.version = SCENE_VERSION;
  migrated.project_name = migrated.project_name || 'Map Daddy Project';
  migrated.output = {
    width: Number(output.width || canvas.width || 1920),
    height: Number(output.height || canvas.height || 1080),
    background: output.background || '#000000'
  };
  delete migrated.canvas;

  migrated.sources = (migrated.sources || []).map((source, index) => ({
    id: source.id || `source_${index + 1}`,
    name: source.name || source.id || `Source ${index + 1}`,
    type: source.type || guessSourceType(source.url),
    ...source
  }));

  const byUrl = new Map(migrated.sources.filter((s) => s.url).map((s) => [s.url, s]));
  for (const [index, surface] of (migrated.surfaces || []).entries()) {
    const mediaUrl = surface.media;
    if (mediaUrl && !surface.source_id) {
      let source = byUrl.get(mediaUrl);
      if (!source) {
        source = {
          id: `source_${migrated.sources.length + 1}`,
          name: `${surface.name || 'Surface'} Media`,
          type: guessSourceType(mediaUrl),
          url: mediaUrl,
          width: migrated.output.width,
          height: migrated.output.height,
          loop: true,
          muted: true
        };
        migrated.sources.push(source);
        byUrl.set(mediaUrl, source);
      }
      surface.source_id = source.id;
    }
    delete surface.media;
    migrated.shapes = migrated.shapes || [];
    migrated.mappings = migrated.mappings || [];
    migrateSurface(migrated, surface, index);
  }

  migrated.shapes = (migrated.shapes || []).map((shape) => normalizeShape(shape));
  migrated.mappings = (migrated.mappings || []).map((mapping, index) => ({
    visible: true,
    locked: false,
    solo: false,
    opacity: 1,
    blend_mode: 'normal',
    depth: index,
    ...mapping,
    id: mapping.id || `mapping_${index + 1}`,
    name: mapping.name || `Mapping ${index + 1}`,
    source_id: mapping.source_id || ''
  }));
  delete migrated.surfaces;

  if (migrated.mappings.length === 0) return defaultScene();
  migrated.metadata = migrated.metadata || {};
  migrated.metadata.created_by = migrated.metadata.created_by || 'Map Daddy';
  migrated.metadata.created_at = migrated.metadata.created_at || '';
  migrated.metadata.updated_at = migrated.metadata.updated_at || '';
  return migrated;
}

export class MappingManager {
  constructor(scene) {
    this.scene = migrateScene(scene);
    this.sourcesById = new Map(this.scene.sources.map((source) => [source.id, source]));
    this.shapesById = new Map(this.scene.shapes.map((shape) => [shape.id, shape]));
    this.mappingsById = new Map(this.scene.mappings.map((mapping) => [mapping.id, mapping]));
  }

  getSource(id) {
    return this.sourcesById.get(id);
  }

  getShape(id) {
    return this.shapesById.get(id);
  }

  getMapping(id) {
    return this.mappingsById.get(id);
  }

  orderedMappings() {
    return [...this.scene.mappings].sort((a, b) => Number(a.depth || 0) - Number(b.depth || 0));
  }

  layerMappings() {
    return [...this.orderedMappings()].reverse();
  }

  visibleMappings() {
    const ordered = this.orderedMappings();
    const hasSolo = ordered.some((mapping) => mapping.solo);
    return ordered.filter((mapping) => {
      if (hasSolo && !mapping.solo) return false;
      return mapping.visible !== false;
    });
  }

  validateReferences() {
    const errors = [];
    for (const mapping of this.scene.mappings) {
      if (mapping.source_id && !this.sourcesById.has(mapping.source_id)) errors.push(`${mapping.id} missing source ${mapping.source_id}`);
      if (!this.shapesById.has(mapping.input_shape_id)) errors.push(`${mapping.id} missing input shape ${mapping.input_shape_id}`);
      if (!this.shapesById.has(mapping.output_shape_id)) errors.push(`${mapping.id} missing output shape ${mapping.output_shape_id}`);
    }
    return errors;
  }

  nextDepth() {
    return this.scene.mappings.reduce((depth, mapping) => Math.max(depth, Number(mapping.depth || 0)), -1) + 1;
  }

  addMapping(type = 'quad', sourceId = '') {
    const scene = cloneScene(this.scene);
    const { width, height } = outputSize(scene);
    const id = `mapping_${Date.now()}`;
    const inputShapeId = `${id}_input`;
    const outputShapeId = `${id}_output`;
    const inputVertices = type === 'triangle'
      ? defaultVertices('triangle', width, height)
      : [[0, 0], [width, 0], [width, height], [0, height]];

    scene.shapes.push({
      id: inputShapeId,
      name: `Input ${scene.mappings.length + 1}`,
      type,
      vertices: inputVertices,
      locked: false,
      mesh: type === 'mesh' ? { columns: 2, rows: 2 } : undefined
    });
    scene.shapes.push({
      id: outputShapeId,
      name: `Output ${scene.mappings.length + 1}`,
      type,
      vertices: defaultVertices(type, width, height),
      locked: false,
      mesh: type === 'mesh' ? { columns: 2, rows: 2 } : undefined
    });
    scene.mappings.push({
      id,
      name: `Mapping ${scene.mappings.length + 1}`,
      source_id: sourceId,
      input_shape_id: inputShapeId,
      output_shape_id: outputShapeId,
      visible: true,
      locked: false,
      solo: false,
      opacity: 1,
      blend_mode: 'normal',
      depth: this.nextDepth()
    });
    return migrateScene(scene);
  }

  removeMapping(mappingId) {
    const scene = cloneScene(this.scene);
    const mapping = scene.mappings.find((item) => item.id === mappingId);
    scene.mappings = scene.mappings.filter((item) => item.id !== mappingId);
    if (mapping) {
      const usedShapeIds = new Set(scene.mappings.flatMap((item) => [item.input_shape_id, item.output_shape_id]));
      scene.shapes = scene.shapes.filter((shape) => usedShapeIds.has(shape.id) || (shape.id !== mapping.input_shape_id && shape.id !== mapping.output_shape_id));
    }
    scene.mappings.forEach((item, index) => { item.depth = index; });
    return migrateScene(scene);
  }

  duplicateMapping(mappingId) {
    const scene = cloneScene(this.scene);
    const mapping = scene.mappings.find((item) => item.id === mappingId);
    if (!mapping) return scene;
    const inputShape = scene.shapes.find((shape) => shape.id === mapping.input_shape_id);
    const outputShape = scene.shapes.find((shape) => shape.id === mapping.output_shape_id);
    const id = `mapping_${Date.now()}`;
    const inputShapeId = `${id}_input`;
    const outputShapeId = `${id}_output`;
    if (inputShape) scene.shapes.push({ ...cloneScene(inputShape), id: inputShapeId, name: `${inputShape.name} Copy` });
    if (outputShape) {
      const copy = cloneScene(outputShape);
      copy.id = outputShapeId;
      copy.name = `${outputShape.name} Copy`;
      copy.vertices = copy.vertices.map(([x, y]) => [x + 32, y + 32]);
      scene.shapes.push(copy);
    }
    scene.mappings.push({
      ...cloneScene(mapping),
      id,
      name: `${mapping.name} Copy`,
      input_shape_id: inputShapeId,
      output_shape_id: outputShapeId,
      depth: this.nextDepth(),
      solo: false
    });
    return migrateScene(scene);
  }

  updateMapping(mappingId, patch) {
    const scene = cloneScene(this.scene);
    scene.mappings = scene.mappings.map((mapping) => mapping.id === mappingId ? { ...mapping, ...patch } : mapping);
    return migrateScene(scene);
  }

  updateShapeVertex(shapeId, vertexIndex, point) {
    const scene = cloneScene(this.scene);
    const shape = scene.shapes.find((item) => item.id === shapeId);
    if (shape && !shape.locked) shape.vertices[vertexIndex] = [Math.round(point[0]), Math.round(point[1])];
    return migrateScene(scene);
  }

  moveMapping(mappingId, direction) {
    const ordered = this.orderedMappings();
    const index = ordered.findIndex((mapping) => mapping.id === mappingId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return this.scene;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const scene = cloneScene(this.scene);
    ordered.forEach((mapping, depth) => {
      const sceneMapping = scene.mappings.find((item) => item.id === mapping.id);
      if (sceneMapping) sceneMapping.depth = depth;
    });
    return migrateScene(scene);
  }
}
