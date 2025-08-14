// Example usage of the GeohashingService as a reusable module

import { GeohashingService, Coordinates, BoundingBox } from '../index';

// Example coordinates (San Francisco)
const sanFrancisco: Coordinates = { lat: 37.7749, lng: -122.4194 };
const resolution = 9;

console.log('🌍 Geohashing Service Usage Examples\n');

// 1. Get a zone hash for coordinates
console.log('1. Get zone hash for San Francisco:');
try {
  const zone = GeohashingService.getZone(sanFrancisco.lat, sanFrancisco.lng, resolution);
  console.log(`   Hash: ${zone.hash}`);
  console.log(`   Center: ${zone.center.lat}, ${zone.center.lng}`);
  console.log(`   Resolution: ${zone.resolution}\n`);
} catch (error) {
  console.error('   Error:', (error as Error).message);
}

// 2. Get zone boundary
console.log('2. Get zone boundary:');
try {
  const zone = GeohashingService.getZone(sanFrancisco.lat, sanFrancisco.lng, resolution);
  const boundary = GeohashingService.getZoneBoundary(zone.hash);
  console.log(`   Boundary points: ${boundary.boundary.length}`);
  console.log(`   First point: ${boundary.boundary[0].lat}, ${boundary.boundary[0].lng}\n`);
} catch (error) {
  console.error('   Error:', (error as Error).message);
}

// 3. Get neighboring zones
console.log('3. Get neighboring zones:');
try {
  const zone = GeohashingService.getZone(sanFrancisco.lat, sanFrancisco.lng, resolution);
  const neighbors = GeohashingService.getNeighbors(zone.hash, 1);
  console.log(`   Number of neighbors (k=1): ${neighbors.count}`);
  console.log(`   First neighbor: ${neighbors.neighbors[0].hash}\n`);
} catch (error) {
  console.error('   Error:', (error as Error).message);
}

// 4. Get zones within a bounding box
console.log('4. Get zones within bounding box:');
try {
  const boundingBox: BoundingBox = {
    minLat: 37.7,
    minLng: -122.5,
    maxLat: 37.8,
    maxLng: -122.3
  };
  const zonesInArea = GeohashingService.getZonesInArea(boundingBox, resolution);
  console.log(`   Zones in area: ${zonesInArea.count}`);
  console.log(`   First zone: ${zonesInArea.zones[0].hash}\n`);
} catch (error) {
  console.error('   Error:', (error as Error).message);
}

// 5. Get zones within radius
console.log('5. Get zones within radius:');
try {
  const zonesInRadius = GeohashingService.getZonesInRadius(sanFrancisco, 1000, resolution);
  console.log(`   Zones within 1km: ${zonesInRadius.count}`);
  console.log(`   Estimated k: ${zonesInRadius.estimatedK}\n`);
} catch (error) {
  console.error('   Error:', (error as Error).message);
}

// 6. Validate inputs
console.log('6. Input validation examples:');
const coordValidation = GeohashingService.validateCoordinates(91, 0);
console.log(`   Invalid lat (91): ${coordValidation.isValid ? 'Valid' : coordValidation.error}`);

const resValidation = GeohashingService.validateResolution(16);
console.log(`   Invalid resolution (16): ${resValidation.isValid ? 'Valid' : resValidation.error}`);

// 7. Get resolution information
console.log('\n7. Available resolutions:');
try {
  const resolutions = GeohashingService.getResolutionsInfo();
  console.log(`   Available resolutions: 0-15`);
  console.log(`   Resolution 9 edge length: ${resolutions.resolutions[9].avgHexagonEdgeLength}`);
  console.log(`   Resolution 9 area: ${resolutions.resolutions[9].avgHexagonArea}`);
} catch (error) {
  console.error('   Error:', (error as Error).message);
}

console.log('\n✅ All examples completed!'); 