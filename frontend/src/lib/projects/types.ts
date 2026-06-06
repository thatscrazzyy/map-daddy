export type MediaType = 'image' | 'video';

export type VideoPlaybackSettings = {
  loop: boolean;
  muted: boolean;
  playbackRate: number;
  startTime: number;
};

export type Point = {
  x: number;
  y: number;
};

export type ProjectMedia = {
  id: string;
  type: MediaType;
  url: string;
  name: string;
  videoSettings?: VideoPlaybackSettings;
};

export type SourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SurfaceContentType = 'image' | 'live';

export type LiveLayerId = 'bedroom-sky';

export type LiveLayerConfig = {
  lat: number;
  lon: number;
  showStars: boolean;
  showISS: boolean;
  showFlights: boolean;
  showAurora: boolean;
  starSize: number;
  opacity: number;
};

export type SurfaceCalibration = {
  wallBearingDeg: number;
  fovDeg: number;
  rotationOffsetDeg: number;
  elevationOffsetDeg: number;
  pitchDeg: number;
};

// Transient, set on a live surface to flash a reference star on the output.
// Synced through the normal project:update channel; `until` is an epoch-ms deadline.
export type FlashTarget = {
  name: string;
  until: number;
} | null;

export type MappingSurface = {
  id: string;
  name: string;
  mediaId: string;
  visible: boolean;
  opacity: number;
  blendMode: string;
  sourceRect: SourceRect;
  destinationQuad: [Point, Point, Point, Point];
  edgeFeather?: number;
  contentType?: SurfaceContentType;
  liveLayerId?: LiveLayerId;
  liveConfig?: LiveLayerConfig;
  calibration?: SurfaceCalibration;
  flashTarget?: FlashTarget;
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
