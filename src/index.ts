import express, { Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import path from 'path';

import { GeohashingService } from './services/GeohashingService';
import { ApiError, BoundingBox, Coordinates } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

// Environment-driven configuration
const parseEnvList = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map(v => v.trim())
    .filter(v => v.length > 0);
};

const allowedOrigins: string[] = parseEnvList(process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS);
const apiKeys: string[] = parseEnvList(process.env.API_KEYS);
const apiKeyHeaderName: string = (process.env.API_KEY_HEADER || 'x-api-key').toLowerCase();

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
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.length === 0) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With', 'X-API-Key', 'x-api-key'],
  methods: ['GET', 'POST', 'OPTIONS']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Swagger UI - Simple setup to avoid TypeScript issues
app.get('/docs', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Geohashing API Documentation</title>
        <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui.css" />
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-bundle.js"></script>
        <script>
          SwaggerUIBundle({
            url: '/openapi.yaml',
            dom_id: '#swagger-ui',
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIBundle.presets.standalone
            ]
          });
        </script>
      </body>
    </html>
  `);
});

// Serve OpenAPI spec directly
app.get('/openapi.yaml', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/yaml');
  res.sendFile(path.join(__dirname, '..', 'openapi.yaml'));
});

// API key middleware (optional, enabled when API_KEYS is set)
const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (apiKeys.length === 0) {
    return next();
  }
  const headerValue = (req.headers[apiKeyHeaderName] || req.headers[apiKeyHeaderName as keyof typeof req.headers]) as string | string[] | undefined;
  const providedKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!providedKey) {
    return sendError(res, 401, 'Unauthorized', `Missing API key in header ${apiKeyHeaderName}`);
  }
  if (!apiKeys.includes(providedKey)) {
    return sendError(res, 403, 'Forbidden', 'Invalid API key');
  }
  next();
};

// Helper function to send error response
const sendError = (res: Response, statusCode: number, error: string, message: string): void => {
  res.status(statusCode).json({ error, message } as ApiError);
};

// Root endpoint - serve the web UI
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// API documentation endpoint (JSON)
app.get('/api', (req: Request, res: Response) => {
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

// Protect API endpoints with API key middleware if configured

// Get zone hash for given coordinates
app.get('/zone/:lat/:lng/:resolution', apiKeyMiddleware, (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.params.lat);
    const lng = parseFloat(req.params.lng);
    const resolution = parseInt(req.params.resolution);

    // Validate coordinates
    const coordValidation = GeohashingService.validateCoordinates(lat, lng);
    if (!coordValidation.isValid) {
      return sendError(res, 400, 'Invalid coordinates', coordValidation.error!);
    }

    // Validate resolution
    const resolutionValidation = GeohashingService.validateResolution(resolution);
    if (!resolutionValidation.isValid) {
      return sendError(res, 400, 'Invalid resolution', resolutionValidation.error!);
    }

    const result = GeohashingService.getZone(lat, lng, resolution);
    res.json(result);
  } catch (error) {
    sendError(res, 500, 'Internal server error', (error as Error).message);
  }
});

// Get center coordinates of a zone from hash
app.get('/zone/:hash/center', apiKeyMiddleware, (req: Request, res: Response) => {
  try {
    const hash = req.params.hash;

    // Validate hash
    const hashValidation = GeohashingService.validateCellHash(hash);
    if (!hashValidation.isValid) {
      return sendError(res, 400, 'Invalid H3 hash', hashValidation.error!);
    }

    const result = GeohashingService.getZoneCenter(hash);
    res.json(result);
  } catch (error) {
    sendError(res, 500, 'Internal server error', (error as Error).message);
  }
});

// Get boundary polygon of a zone
app.get('/zone/:hash/boundary', apiKeyMiddleware, (req: Request, res: Response) => {
  try {
    const hash = req.params.hash;

    // Validate hash
    const hashValidation = GeohashingService.validateCellHash(hash);
    if (!hashValidation.isValid) {
      return sendError(res, 400, 'Invalid H3 hash', hashValidation.error!);
    }

    const result = GeohashingService.getZoneBoundary(hash);
    res.json(result);
  } catch (error) {
    sendError(res, 500, 'Internal server error', (error as Error).message);
  }
});

// Get neighboring zones
app.get('/zone/:hash/neighbors', apiKeyMiddleware, (req: Request, res: Response) => {
  try {
    const hash = req.params.hash;
    const k = parseInt(req.query.k as string) || 1;

    // Validate hash
    const hashValidation = GeohashingService.validateCellHash(hash);
    if (!hashValidation.isValid) {
      return sendError(res, 400, 'Invalid H3 hash', hashValidation.error!);
    }

    // Validate k value
    const kValidation = GeohashingService.validateKValue(k);
    if (!kValidation.isValid) {
      return sendError(res, 400, 'Invalid k value', kValidation.error!);
    }

    const result = GeohashingService.getNeighbors(hash, k);
    res.json(result);
  } catch (error) {
    sendError(res, 500, 'Internal server error', (error as Error).message);
  }
});

// Get detailed information about a zone
app.get('/zone/:hash/info', apiKeyMiddleware, (req: Request, res: Response) => {
  try {
    const hash = req.params.hash;

    // Validate hash
    const hashValidation = GeohashingService.validateCellHash(hash);
    if (!hashValidation.isValid) {
      return sendError(res, 400, 'Invalid H3 hash', hashValidation.error!);
    }

    const result = GeohashingService.getDetailedZoneInfo(hash);
    res.json(result);
  } catch (error) {
    sendError(res, 500, 'Internal server error', (error as Error).message);
  }
});

// Get zones within a bounding box
app.get('/zones/area', apiKeyMiddleware, (req: Request, res: Response) => {
  try {
    const { minLat, minLng, maxLat, maxLng, resolution } = req.query;
    
    if (!minLat || !minLng || !maxLat || !maxLng || !resolution) {
      return sendError(res, 400, 'Missing parameters', 'Required: minLat, minLng, maxLat, maxLng, resolution');
    }

    const minLatNum = parseFloat(minLat as string);
    const minLngNum = parseFloat(minLng as string);
    const maxLatNum = parseFloat(maxLat as string);
    const maxLngNum = parseFloat(maxLng as string);
    const resolutionNum = parseInt(resolution as string);

    // Validate coordinates
    const minCoordValidation = GeohashingService.validateCoordinates(minLatNum, minLngNum);
    const maxCoordValidation = GeohashingService.validateCoordinates(maxLatNum, maxLngNum);
    
    if (!minCoordValidation.isValid || !maxCoordValidation.isValid) {
      return sendError(res, 400, 'Invalid coordinates', 'All coordinates must be valid lat/lng values');
    }

    // Validate resolution
    const resolutionValidation = GeohashingService.validateResolution(resolutionNum);
    if (!resolutionValidation.isValid) {
      return sendError(res, 400, 'Invalid resolution', resolutionValidation.error!);
    }

    const boundingBox: BoundingBox = {
      minLat: minLatNum,
      minLng: minLngNum,
      maxLat: maxLatNum,
      maxLng: maxLngNum
    };

    const result = GeohashingService.getZonesInArea(boundingBox, resolutionNum);
    res.json(result);
  } catch (error) {
    sendError(res, 500, 'Internal server error', (error as Error).message);
  }
});

// Get zones within radius
app.get('/zones/radius', apiKeyMiddleware, (req: Request, res: Response) => {
  try {
    const { lat, lng, radius, resolution } = req.query;
    
    if (!lat || !lng || !radius || !resolution) {
      return sendError(res, 400, 'Missing parameters', 'Required: lat, lng, radius (in meters), resolution');
    }

    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);
    const radiusNum = parseFloat(radius as string);
    const resolutionNum = parseInt(resolution as string);

    // Validate coordinates
    const coordValidation = GeohashingService.validateCoordinates(latNum, lngNum);
    if (!coordValidation.isValid) {
      return sendError(res, 400, 'Invalid coordinates', coordValidation.error!);
    }

    // Validate resolution
    const resolutionValidation = GeohashingService.validateResolution(resolutionNum);
    if (!resolutionValidation.isValid) {
      return sendError(res, 400, 'Invalid resolution', resolutionValidation.error!);
    }

    const center: Coordinates = { lat: latNum, lng: lngNum };
    const result = GeohashingService.getZonesInRadius(center, radiusNum, resolutionNum);
    res.json(result);
  } catch (error) {
    sendError(res, 500, 'Internal server error', (error as Error).message);
  }
});

// Get zones that intersect with a polygon
app.post('/zones/polygon', apiKeyMiddleware, (req: Request, res: Response) => {
  try {
    const { polygon, resolution } = req.body;
    
    if (!polygon || !resolution) {
      return sendError(res, 400, 'Missing parameters', 'Required: polygon (array of [lat, lng] coordinates), resolution');
    }

    const resolutionNum = parseInt(resolution);

    // Validate resolution
    const resolutionValidation = GeohashingService.validateResolution(resolutionNum);
    if (!resolutionValidation.isValid) {
      return sendError(res, 400, 'Invalid resolution', resolutionValidation.error!);
    }

    // Validate polygon
    const polygonValidation = GeohashingService.validatePolygon(polygon);
    if (!polygonValidation.isValid) {
      return sendError(res, 400, 'Invalid polygon', polygonValidation.error!);
    }

    const result = GeohashingService.getZonesInPolygon(polygon, resolutionNum);
    res.json(result);
  } catch (error) {
    sendError(res, 500, 'Internal server error', (error as Error).message);
  }
});

// Get information about H3 resolutions
app.get('/resolutions', apiKeyMiddleware, (req: Request, res: Response) => {
  try {
    const result = GeohashingService.getResolutionsInfo();
    res.json(result);
  } catch (error) {
    sendError(res, 500, 'Internal server error', (error as Error).message);
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  sendError(res, 500, 'Internal server error', 'Something went wrong!');
});

// 404 handler
app.use((req: Request, res: Response) => {
  sendError(res, 404, 'Not found', 'The requested endpoint does not exist');
});

app.listen(PORT, () => {
  console.log(`🌍 Geohashing API running on port ${PORT}`);
  console.log(`📍 Visit http://localhost:${PORT} for basic API documentation`);
  console.log(`📚 Visit http://localhost:${PORT}/docs for interactive Swagger documentation`);
  console.log(`🔗 Example: http://localhost:${PORT}/zone/37.7749/-122.4194/9`);
  if (allowedOrigins.length > 0) {
    console.log(`✅ CORS restricted to origins: ${allowedOrigins.join(', ')}`);
  } else {
    console.log('ℹ️ CORS allowed for any origin (set CORS_ALLOWED_ORIGINS to restrict)');
  }
  if (apiKeys.length > 0) {
    console.log(`🔒 API key authentication enabled (header: ${apiKeyHeaderName})`);
  } else {
    console.log('ℹ️ API key authentication disabled (set API_KEYS to enable)');
  }
});

export default app;

// Export the service and types for external use
export { GeohashingService };
export * from './types'; 