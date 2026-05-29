export type MediaType = 'image' | 'video';

export type Point = {
  x: number;
  y: number;
};

export type ProjectMedia = {
  id: string;
  type: MediaType;
  url: string;
  name: string;
};

export type SourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MappingSurface = {
  id: string;
  name: string;
  mediaId: string;
  visible: boolean;
  opacity: number;
  blendMode: string;
  sourceRect: SourceRect;
  destinationQuad: [Point, Point, Point, Point];
};

export type ProjectState = {
  id: string;
  name: string;
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  media: ProjectMedia[];
  surfaces: MappingSurface[];
  updatedAt: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
  surfaceCount: number;
  mediaCount: number;
};
