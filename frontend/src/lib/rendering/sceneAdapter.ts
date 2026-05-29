import { normalizeProject } from '../projects/defaultProject';
import type { MappingSurface, ProjectState } from '../projects/types';

type LegacyScene = {
  project_name?: string;
  output?: {
    width?: number;
    height?: number;
    background?: string;
  };
  sources?: Array<{
    id?: string;
    type?: 'image' | 'video';
    url?: string;
    name?: string;
  }>;
  shapes?: Array<{
    id?: string;
    vertices?: Array<[number, number]>;
  }>;
  mappings?: Array<{
    id?: string;
    name?: string;
    source_id?: string;
    output_shape_id?: string;
    visible?: boolean;
    opacity?: number;
    blend_mode?: string;
    depth?: number;
  }>;
  metadata?: {
    updated_at?: string;
  };
};

function isProjectState(value: unknown): value is ProjectState {
  return !!value && typeof value === 'object' && 'canvas' in value && 'surfaces' in value && 'media' in value;
}

export function sceneToProjectState(value: ProjectState | LegacyScene): ProjectState {
  if (isProjectState(value)) return normalizeProject(value);

  const scene = value || {};
  const width = Number(scene.output?.width || 1920);
  const height = Number(scene.output?.height || 1080);
  const shapes = new Map((scene.shapes || []).map((shape) => [shape.id, shape]));
  const media = (scene.sources || []).map((source, index) => ({
    id: source.id || `media_${index + 1}`,
    type: source.type === 'video' ? 'video' as const : 'image' as const,
    url: source.url || '',
    name: source.name || source.id || `Media ${index + 1}`
  }));

  return normalizeProject({
    id: 'legacy_scene',
    name: scene.project_name || 'Map Daddy Scene',
    canvas: {
      width,
      height,
      backgroundColor: scene.output?.background || '#000000'
    },
    media,
    surfaces: (scene.mappings || [])
      .sort((a, b) => Number(a.depth || 0) - Number(b.depth || 0))
      .map((mapping, index) => {
        const outputShape = shapes.get(mapping.output_shape_id);
        const vertices = (outputShape?.vertices?.length || 0) >= 4
          ? outputShape!.vertices!.slice(0, 4)
          : [[0, 0], [width, 0], [width, height], [0, height]];
        return {
          id: mapping.id || `surface_${index + 1}`,
          name: mapping.name || `Surface ${index + 1}`,
          mediaId: mapping.source_id || '',
          visible: mapping.visible !== false,
          opacity: Number(mapping.opacity ?? 1),
          blendMode: mapping.blend_mode || 'source-over',
          sourceRect: { x: 0, y: 0, width, height },
          destinationQuad: vertices.map(([x, y]) => ({ x, y })) as MappingSurface['destinationQuad']
        };
      }),
    updatedAt: scene.metadata?.updated_at || new Date().toISOString()
  });
}
