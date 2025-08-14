export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ZoneInfo {
  hash: string;
  center: Coordinates;
  resolution: number;
}

export interface ZoneInput {
  lat: number;
  lng: number;
  resolution: number;
}

export interface ZoneResponse extends ZoneInfo {
  input: ZoneInput;
}

export interface BoundaryResponse {
  hash: string;
  boundary: Coordinates[];
  resolution: number;
}

export interface NeighborInfo {
  hash: string;
  center: Coordinates;
}

export interface NeighborsResponse {
  hash: string;
  k: number;
  neighbors: NeighborInfo[];
  count: number;
  resolution: number;
}

export interface DetailedZoneInfo {
  hash: string;
  resolution: number;
  center: Coordinates;
  boundary: Coordinates[];
  neighbors: string[];
  parent: string | null;
  children: string[];
  childrenCount: number;
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface ZonesInAreaResponse {
  boundingBox: BoundingBox;
  resolution: number;
  zones: NeighborInfo[];
  count: number;
}

export interface ZonesInRadiusResponse {
  center: Coordinates;
  radius: number;
  resolution: number;
  estimatedK: number;
  zones: NeighborInfo[];
  count: number;
  note: string;
}

export interface ZonesInPolygonResponse {
  polygon: number[][];
  resolution: number;
  zones: NeighborInfo[];
  count: number;
}

export interface ResolutionInfo {
  resolution: number;
  avgHexagonEdgeLength: string;
  avgHexagonArea: string;
}

export interface ResolutionsResponse {
  description: string;
  resolutions: ResolutionInfo[];
  usage: Record<string, string>;
}

export interface ApiError {
  error: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
} 