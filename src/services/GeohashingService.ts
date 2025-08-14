import {
  latLngToCell,
  cellToLatLng,
  cellToBoundary,
  gridDisk,
  polygonToCells,
  cellToChildren,
  cellToParent,
  getResolution,
  isValidCell,
  areNeighborCells
} from 'h3-js';

import {
  Coordinates,
  ZoneInfo,
  ZoneResponse,
  BoundaryResponse,
  NeighborsResponse,
  DetailedZoneInfo,
  BoundingBox,
  ZonesInAreaResponse,
  ZonesInRadiusResponse,
  ZonesInPolygonResponse,
  ResolutionsResponse,
  ValidationResult,
  NeighborInfo
} from '../types';

export class GeohashingService {
  private static readonly RESOLUTION_INFO = [
    { resolution: 0, avgHexagonEdgeLength: '1107.712591 km', avgHexagonArea: '4250546.848 km²' },
    { resolution: 1, avgHexagonEdgeLength: '418.676005 km', avgHexagonArea: '607220.9782 km²' },
    { resolution: 2, avgHexagonEdgeLength: '158.244655 km', avgHexagonArea: '86745.85403 km²' },
    { resolution: 3, avgHexagonEdgeLength: '59.810857 km', avgHexagonArea: '12392.26486 km²' },
    { resolution: 4, avgHexagonEdgeLength: '22.606379 km', avgHexagonArea: '1770.323552 km²' },
    { resolution: 5, avgHexagonEdgeLength: '8.544408 km', avgHexagonArea: '252.9033645 km²' },
    { resolution: 6, avgHexagonEdgeLength: '3.229482 km', avgHexagonArea: '36.1290521 km²' },
    { resolution: 7, avgHexagonEdgeLength: '1.220629 km', avgHexagonArea: '5.1612932 km²' },
    { resolution: 8, avgHexagonEdgeLength: '461.354684 m', avgHexagonArea: '0.7373276 km²' },
    { resolution: 9, avgHexagonEdgeLength: '174.375668 m', avgHexagonArea: '0.1053325 km²' },
    { resolution: 10, avgHexagonEdgeLength: '65.907807 m', avgHexagonArea: '15042.5 m²' },
    { resolution: 11, avgHexagonEdgeLength: '24.910561 m', avgHexagonArea: '2149.1 m²' },
    { resolution: 12, avgHexagonEdgeLength: '9.415526 m', avgHexagonArea: '307.71 m²' },
    { resolution: 13, avgHexagonEdgeLength: '3.559893 m', avgHexagonArea: '43.96 m²' },
    { resolution: 14, avgHexagonEdgeLength: '1.348575 m', avgHexagonArea: '6.28 m²' },
    { resolution: 15, avgHexagonEdgeLength: '0.509713 m', avgHexagonArea: '0.90 m²' }
  ];

  /**
   * Validate coordinates
   */
  public static validateCoordinates(lat: number, lng: number): ValidationResult {
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return {
        isValid: false,
        error: 'Latitude must be between -90 and 90, longitude between -180 and 180'
      };
    }
    return { isValid: true };
  }

  /**
   * Validate H3 resolution
   */
  public static validateResolution(resolution: number): ValidationResult {
    if (resolution < 0 || resolution > 15 || !Number.isInteger(resolution)) {
      return {
        isValid: false,
        error: 'Resolution must be an integer between 0 and 15'
      };
    }
    return { isValid: true };
  }

  /**
   * Validate H3 cell hash
   */
  public static validateCellHash(hash: string): ValidationResult {
    if (!isValidCell(hash)) {
      return {
        isValid: false,
        error: 'The provided hash is not a valid H3 cell'
      };
    }
    return { isValid: true };
  }

  /**
   * Validate k value for neighbors
   */
  public static validateKValue(k: number): ValidationResult {
    if (k < 1 || k > 10 || !Number.isInteger(k)) {
      return {
        isValid: false,
        error: 'k must be an integer between 1 and 10'
      };
    }
    return { isValid: true };
  }

  /**
   * Validate polygon coordinates
   */
  public static validatePolygon(polygon: number[][]): ValidationResult {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return {
        isValid: false,
        error: 'Polygon must be an array of at least 3 [lat, lng] coordinates'
      };
    }

    for (const coord of polygon) {
      if (!Array.isArray(coord) || coord.length !== 2) {
        return {
          isValid: false,
          error: 'Each polygon coordinate must be a [lat, lng] array'
        };
      }
      const [lat, lng] = coord;
      const coordValidation = this.validateCoordinates(lat, lng);
      if (!coordValidation.isValid) {
        return coordValidation;
      }
    }

    return { isValid: true };
  }

  /**
   * Convert H3 center coordinates to our format
   */
  private static formatCenter(center: [number, number]): Coordinates {
    return { lat: center[0], lng: center[1] };
  }

  /**
   * Convert H3 boundary coordinates to our format
   */
  private static formatBoundary(boundary: [number, number][]): Coordinates[] {
    return boundary.map(coord => ({ lat: coord[0], lng: coord[1] }));
  }

  /**
   * Format neighbor info with center coordinates
   */
  private static formatNeighborInfo(hash: string): NeighborInfo {
    const center = cellToLatLng(hash);
    return {
      hash,
      center: this.formatCenter(center)
    };
  }

  /**
   * Get zone hash and info for given coordinates
   */
  public static getZone(lat: number, lng: number, resolution: number): ZoneResponse {
    const hash = latLngToCell(lat, lng, resolution);
    const center = cellToLatLng(hash);

    return {
      hash,
      input: { lat, lng, resolution },
      center: this.formatCenter(center),
      resolution: getResolution(hash)
    };
  }

  /**
   * Get center coordinates of a zone from hash
   */
  public static getZoneCenter(hash: string): ZoneInfo {
    const center = cellToLatLng(hash);
    
    return {
      hash,
      center: this.formatCenter(center),
      resolution: getResolution(hash)
    };
  }

  /**
   * Get boundary polygon of a zone
   */
  public static getZoneBoundary(hash: string): BoundaryResponse {
    const boundary = cellToBoundary(hash);
    
    return {
      hash,
      boundary: this.formatBoundary(boundary),
      resolution: getResolution(hash)
    };
  }

  /**
   * Get neighboring zones
   */
  public static getNeighbors(hash: string, k: number = 1): NeighborsResponse {
    const neighbors = gridDisk(hash, k);
    
    return {
      hash,
      k,
      neighbors: neighbors.map(neighborHash => this.formatNeighborInfo(neighborHash)),
      count: neighbors.length,
      resolution: getResolution(hash)
    };
  }

  /**
   * Get detailed information about a zone
   */
  public static getDetailedZoneInfo(hash: string): DetailedZoneInfo {
    const center = cellToLatLng(hash);
    const boundary = cellToBoundary(hash);
    const resolution = getResolution(hash);
    const neighbors = gridDisk(hash, 1).filter(h => h !== hash);
    
    // Get parent and children if applicable
    let parent: string | null = null;
    let children: string[] = [];
    
    if (resolution > 0) {
      parent = cellToParent(hash, resolution - 1);
    }
    
    if (resolution < 15) {
      children = cellToChildren(hash, resolution + 1);
    }

    return {
      hash,
      resolution,
      center: this.formatCenter(center),
      boundary: this.formatBoundary(boundary),
      neighbors,
      parent,
      children: children.slice(0, 10), // Limit to first 10 children
      childrenCount: children.length
    };
  }

  /**
   * Get zones within a bounding box
   */
  public static getZonesInArea(boundingBox: BoundingBox, resolution: number): ZonesInAreaResponse {
    const { minLat, minLng, maxLat, maxLng } = boundingBox;
    
    // Create a polygon for the bounding box
    const polygon: number[][] = [
      [minLat, minLng],
      [minLat, maxLng],
      [maxLat, maxLng],
      [maxLat, minLng],
      [minLat, minLng] // Close the polygon
    ];

    const zones = polygonToCells(polygon, resolution);
    
    return {
      boundingBox,
      resolution,
      zones: zones.map(hash => this.formatNeighborInfo(hash)),
      count: zones.length
    };
  }

  /**
   * Get zones within radius (approximation)
   */
  public static getZonesInRadius(center: Coordinates, radius: number, resolution: number): ZonesInRadiusResponse {
    const { lat, lng } = center;
    
    // Get the center cell
    const centerHash = latLngToCell(lat, lng, resolution);
    
    // Estimate k based on radius and resolution
    // This is a rough approximation - for precise radius filtering, 
    // you'd need to calculate actual distances
    const k = Math.max(1, Math.ceil(radius / 1000)); // Rough estimate
    
    const zones = gridDisk(centerHash, Math.min(k, 10)); // Limit k to 10 for performance
    
    return {
      center,
      radius,
      resolution,
      estimatedK: k,
      zones: zones.map(hash => this.formatNeighborInfo(hash)),
      count: zones.length,
      note: 'This is an approximation. For precise radius filtering, calculate actual distances from center.'
    };
  }

  /**
   * Get zones that intersect with a polygon
   */
  public static getZonesInPolygon(polygon: number[][], resolution: number): ZonesInPolygonResponse {
    const zones = polygonToCells(polygon, resolution);
    
    return {
      polygon,
      resolution,
      zones: zones.map(hash => this.formatNeighborInfo(hash)),
      count: zones.length
    };
  }

  /**
   * Get information about H3 resolutions
   */
  public static getResolutionsInfo(): ResolutionsResponse {
    return {
      description: 'H3 resolution levels with approximate sizes',
      resolutions: this.RESOLUTION_INFO,
      usage: {
        'Country level': 'Resolution 0-2',
        'State/Province level': 'Resolution 3-4',
        'City level': 'Resolution 5-7',
        'Neighborhood level': 'Resolution 8-10',
        'Building level': 'Resolution 11-13',
        'Room level': 'Resolution 14-15'
      }
    };
  }

  /**
   * Check if two cells are neighbors
   */
  public static areNeighbors(hash1: string, hash2: string): boolean {
    return areNeighborCells(hash1, hash2);
  }
} 