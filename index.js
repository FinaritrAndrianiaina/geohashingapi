const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { 
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
} = require('h3-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Load OpenAPI specification
const openApiPath = path.join(__dirname, 'openapi.yaml');
const openApiSpec = YAML.load(fs.readFileSync(openApiPath, 'utf8'));

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Geohashing API Documentation'
}));

// Helper function to validate coordinates
const isValidCoordinate = (lat, lng) => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

// Helper function to validate H3 resolution
const isValidResolution = (resolution) => {
  return resolution >= 0 && resolution <= 15;
};

// Root endpoint - serve the web UI
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// API documentation endpoint (JSON)
app.get('/api', (req, res) => {
  res.json({
    name: 'Geohashing API',
    description: 'API for splitting the world into hexagonal zones using H3 spatial indexing',
    version: '1.0.0',
    endpoints: {
      'GET /zone/:lat/:lng/:resolution': 'Get the zone hash for coordinates at specific resolution (0-15)',
      'GET /zone/:hash/center': 'Get center coordinates of a zone from its hash',
      'GET /zone/:hash/boundary': 'Get boundary polygon of a zone',
      'GET /zone/:hash/neighbors': 'Get neighboring zones',
      'GET /zone/:hash/info': 'Get detailed information about a zone',
      'GET /zones/area': 'Get zones within a bounding box (query: minLat, minLng, maxLat, maxLng, resolution)',
      'GET /zones/radius': 'Get zones within radius (query: lat, lng, radius, resolution)',
      'GET /resolutions': 'Get information about available H3 resolutions',
      'POST /zones/polygon': 'Get zones that intersect with a polygon'
    },
    examples: {
      getZone: '/zone/37.7749/-122.4194/9',
      getCenter: '/zone/892830826cffffff/center',
      getBoundary: '/zone/892830826cffffff/boundary',
      getNeighbors: '/zone/892830826cffffff/neighbors',
      getZonesInArea: '/zones/area?minLat=37.7&minLng=-122.5&maxLat=37.8&maxLng=-122.3&resolution=9',
      getZonesInRadius: '/zones/radius?lat=37.7749&lng=-122.4194&radius=1000&resolution=9'
    }
  });
});

// Get zone hash for given coordinates
app.get('/zone/:lat/:lng/:resolution', (req, res) => {
  try {
    const lat = parseFloat(req.params.lat);
    const lng = parseFloat(req.params.lng);
    const resolution = parseInt(req.params.resolution);

    if (!isValidCoordinate(lat, lng)) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'Latitude must be between -90 and 90, longitude between -180 and 180'
      });
    }

    if (!isValidResolution(resolution)) {
      return res.status(400).json({
        error: 'Invalid resolution',
        message: 'Resolution must be between 0 and 15'
      });
    }

    const hash = latLngToCell(lat, lng, resolution);
    const center = cellToLatLng(hash);

    res.json({
      hash,
      input: { lat, lng, resolution },
      center: { lat: center[0], lng: center[1] },
      resolution: getResolution(hash)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get center coordinates of a zone from hash
app.get('/zone/:hash/center', (req, res) => {
  try {
    const hash = req.params.hash;

    if (!isValidCell(hash)) {
      return res.status(400).json({
        error: 'Invalid H3 hash',
        message: 'The provided hash is not a valid H3 cell'
      });
    }

    const center = cellToLatLng(hash);
    
    res.json({
      hash,
      center: { lat: center[0], lng: center[1] },
      resolution: getResolution(hash)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get boundary polygon of a zone
app.get('/zone/:hash/boundary', (req, res) => {
  try {
    const hash = req.params.hash;

    if (!isValidCell(hash)) {
      return res.status(400).json({
        error: 'Invalid H3 hash',
        message: 'The provided hash is not a valid H3 cell'
      });
    }

    const boundary = cellToBoundary(hash);
    
    res.json({
      hash,
      boundary: boundary.map(coord => ({ lat: coord[0], lng: coord[1] })),
      resolution: getResolution(hash)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get neighboring zones
app.get('/zone/:hash/neighbors', (req, res) => {
  try {
    const hash = req.params.hash;
    const k = parseInt(req.query.k) || 1; // Ring distance, default 1

    if (!isValidCell(hash)) {
      return res.status(400).json({
        error: 'Invalid H3 hash',
        message: 'The provided hash is not a valid H3 cell'
      });
    }

    if (k < 1 || k > 10) {
      return res.status(400).json({
        error: 'Invalid k value',
        message: 'k must be between 1 and 10'
      });
    }

    const neighbors = gridDisk(hash, k);
    
    res.json({
      hash,
      k,
      neighbors: neighbors.map(neighborHash => ({
        hash: neighborHash,
        center: cellToLatLng(neighborHash).map((coord, i) => i === 0 ? { lat: coord } : { lng: coord }).reduce((a, b) => ({ ...a, ...b }))
      })),
      count: neighbors.length,
      resolution: getResolution(hash)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get detailed information about a zone
app.get('/zone/:hash/info', (req, res) => {
  try {
    const hash = req.params.hash;

    if (!isValidCell(hash)) {
      return res.status(400).json({
        error: 'Invalid H3 hash',
        message: 'The provided hash is not a valid H3 cell'
      });
    }

    const center = cellToLatLng(hash);
    const boundary = cellToBoundary(hash);
    const resolution = getResolution(hash);
    const neighbors = gridDisk(hash, 1).filter(h => h !== hash);
    
    // Get parent and children if applicable
    let parent = null;
    let children = [];
    
    if (resolution > 0) {
      parent = cellToParent(hash, resolution - 1);
    }
    
    if (resolution < 15) {
      children = cellToChildren(hash, resolution + 1);
    }

    res.json({
      hash,
      resolution,
      center: { lat: center[0], lng: center[1] },
      boundary: boundary.map(coord => ({ lat: coord[0], lng: coord[1] })),
      neighbors: neighbors,
      parent,
      children: children.slice(0, 10), // Limit to first 10 children
      childrenCount: children.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get zones within a bounding box
app.get('/zones/area', (req, res) => {
  try {
    const { minLat, minLng, maxLat, maxLng, resolution } = req.query;
    
    if (!minLat || !minLng || !maxLat || !maxLng || !resolution) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Required: minLat, minLng, maxLat, maxLng, resolution'
      });
    }

    const minLatNum = parseFloat(minLat);
    const minLngNum = parseFloat(minLng);
    const maxLatNum = parseFloat(maxLat);
    const maxLngNum = parseFloat(maxLng);
    const resolutionNum = parseInt(resolution);

    if (!isValidCoordinate(minLatNum, minLngNum) || !isValidCoordinate(maxLatNum, maxLngNum)) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'All coordinates must be valid lat/lng values'
      });
    }

    if (!isValidResolution(resolutionNum)) {
      return res.status(400).json({
        error: 'Invalid resolution',
        message: 'Resolution must be between 0 and 15'
      });
    }

    // Create a polygon for the bounding box
    const polygon = [
      [minLatNum, minLngNum],
      [minLatNum, maxLngNum],
      [maxLatNum, maxLngNum],
      [maxLatNum, minLngNum],
      [minLatNum, minLngNum] // Close the polygon
    ];

    const zones = polygonToCells(polygon, resolutionNum);
    
    res.json({
      boundingBox: { minLat: minLatNum, minLng: minLngNum, maxLat: maxLatNum, maxLng: maxLngNum },
      resolution: resolutionNum,
      zones: zones.map(hash => ({
        hash,
        center: cellToLatLng(hash).map((coord, i) => i === 0 ? { lat: coord } : { lng: coord }).reduce((a, b) => ({ ...a, ...b }))
      })),
      count: zones.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get zones within radius
app.get('/zones/radius', (req, res) => {
  try {
    const { lat, lng, radius, resolution } = req.query;
    
    if (!lat || !lng || !radius || !resolution) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Required: lat, lng, radius (in meters), resolution'
      });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = parseFloat(radius);
    const resolutionNum = parseInt(resolution);

    if (!isValidCoordinate(latNum, lngNum)) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'Latitude must be between -90 and 90, longitude between -180 and 180'
      });
    }

    if (!isValidResolution(resolutionNum)) {
      return res.status(400).json({
        error: 'Invalid resolution',
        message: 'Resolution must be between 0 and 15'
      });
    }

    // Get the center cell
    const centerHash = latLngToCell(latNum, lngNum, resolutionNum);
    
    // Estimate k based on radius and resolution
    // This is a rough approximation - for precise radius filtering, 
    // you'd need to calculate actual distances
    const k = Math.max(1, Math.ceil(radiusNum / 1000)); // Rough estimate
    
    const zones = gridDisk(centerHash, Math.min(k, 10)); // Limit k to 10 for performance
    
    res.json({
      center: { lat: latNum, lng: lngNum },
      radius: radiusNum,
      resolution: resolutionNum,
      estimatedK: k,
      zones: zones.map(hash => ({
        hash,
        center: cellToLatLng(hash).map((coord, i) => i === 0 ? { lat: coord } : { lng: coord }).reduce((a, b) => ({ ...a, ...b }))
      })),
      count: zones.length,
      note: 'This is an approximation. For precise radius filtering, calculate actual distances from center.'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get zones that intersect with a polygon
app.post('/zones/polygon', (req, res) => {
  try {
    const { polygon, resolution } = req.body;
    
    if (!polygon || !resolution) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Required: polygon (array of [lat, lng] coordinates), resolution'
      });
    }

    const resolutionNum = parseInt(resolution);

    if (!isValidResolution(resolutionNum)) {
      return res.status(400).json({
        error: 'Invalid resolution',
        message: 'Resolution must be between 0 and 15'
      });
    }

    if (!Array.isArray(polygon) || polygon.length < 3) {
      return res.status(400).json({
        error: 'Invalid polygon',
        message: 'Polygon must be an array of at least 3 [lat, lng] coordinates'
      });
    }

    const zones = polygonToCells(polygon, resolutionNum);
    
    res.json({
      polygon,
      resolution: resolutionNum,
      zones: zones.map(hash => ({
        hash,
        center: cellToLatLng(hash).map((coord, i) => i === 0 ? { lat: coord } : { lng: coord }).reduce((a, b) => ({ ...a, ...b }))
      })),
      count: zones.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get information about H3 resolutions
app.get('/resolutions', (req, res) => {
  const resolutions = [];
  
  // H3 resolution information (approximate)
  const resolutionInfo = [
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

  res.json({
    description: 'H3 resolution levels with approximate sizes',
    resolutions: resolutionInfo,
    usage: {
      'Country level': 'Resolution 0-2',
      'State/Province level': 'Resolution 3-4',
      'City level': 'Resolution 5-7',
      'Neighborhood level': 'Resolution 8-10',
      'Building level': 'Resolution 11-13',
      'Room level': 'Resolution 14-15'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong!'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

app.listen(PORT, () => {
  console.log(`🌍 Geohashing API running on port ${PORT}`);
  console.log(`📍 Visit http://localhost:${PORT} for basic API documentation`);
  console.log(`📚 Visit http://localhost:${PORT}/docs for interactive Swagger documentation`);
  console.log(`🔗 Example: http://localhost:${PORT}/zone/37.7749/-122.4194/9`);
});

module.exports = app; 