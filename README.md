# 🌍 Geohashing API

A powerful REST API that splits the world map into hexagonal zones using **H3** (Uber's Hexagonal Hierarchical Spatial Index). Each zone gets a unique hash identifier that you can use to efficiently organize and query geographical data.

## 🚀 Features

- **Hexagonal Grid System**: Uses H3 to divide the world into uniform hexagonal cells
- **Multiple Resolutions**: 16 resolution levels (0-15) from country-level to room-level precision
- **Unique Zone Hashes**: Each hexagon gets a unique identifier you can store and reuse
- **Fast Lookups**: Convert coordinates to zones and vice versa instantly
- **Neighbor Discovery**: Find adjacent zones and areas within radius
- **Polygon Support**: Get all zones that intersect with custom polygons
- **REST API**: Simple HTTP endpoints for all operations

## 📐 How H3 Works

H3 creates a hierarchical grid of hexagonal cells covering the Earth. Higher resolution numbers create smaller, more precise hexagons:

- **Resolution 0**: ~4.25M km² per hexagon (country level)
- **Resolution 9**: ~0.105 km² per hexagon (neighborhood level) 
- **Resolution 15**: ~0.9 m² per hexagon (room level)

Each hexagon has a unique 15-character hash like `892830826cffffff` that encodes its position.

## 🛠️ Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

2. **Start the server:**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

3. **Access the API:**
   - API runs on `http://localhost:3000`
   - Visit root URL for interactive documentation

## 📚 API Endpoints

### Get Zone Hash for Coordinates
```
GET /zone/:lat/:lng/:resolution
```

Convert latitude/longitude to a zone hash.

**Example:**
```bash
curl "http://localhost:3000/zone/37.7749/-122.4194/9"
```

**Response:**
```json
{
  "hash": "892830826cffffff",
  "input": { "lat": 37.7749, "lng": -122.4194, "resolution": 9 },
  "center": { "lat": 37.77492632596, "lng": -122.41941056848 },
  "resolution": 9
}
```

### Get Zone Center from Hash
```
GET /zone/:hash/center
```

Get the center coordinates of a zone from its hash.

**Example:**
```bash
curl "http://localhost:3000/zone/892830826cffffff/center"
```

### Get Zone Boundary
```
GET /zone/:hash/boundary
```

Get the hexagonal boundary polygon of a zone.

**Example:**
```bash
curl "http://localhost:3000/zone/892830826cffffff/boundary"
```

**Response:**
```json
{
  "hash": "892830826cffffff",
  "boundary": [
    { "lat": 37.77579, "lng": -122.41856 },
    { "lat": 37.77536, "lng": -122.41611 },
    // ... 6 vertices total
  ],
  "resolution": 9
}
```

### Get Neighboring Zones
```
GET /zone/:hash/neighbors?k=1
```

Get zones within k rings of distance (k=1 means immediate neighbors).

**Example:**
```bash
curl "http://localhost:3000/zone/892830826cffffff/neighbors?k=2"
```

### Get Zones in Bounding Box
```
GET /zones/area?minLat=37.7&minLng=-122.5&maxLat=37.8&maxLng=-122.3&resolution=9
```

Get all zones that intersect with a rectangular area.

### Get Zones Within Radius
```
GET /zones/radius?lat=37.7749&lng=-122.4194&radius=1000&resolution=9
```

Get zones within a specified radius (in meters) from a center point.

### Get Zone Details
```
GET /zone/:hash/info
```

Get comprehensive information about a zone including neighbors, parent, children.

### Get Zones in Polygon
```
POST /zones/polygon
Content-Type: application/json

{
  "polygon": [
    [37.7749, -122.4194],
    [37.7849, -122.4094],
    [37.7649, -122.4094],
    [37.7749, -122.4194]
  ],
  "resolution": 9
}
```

Get all zones that intersect with a custom polygon.

### Get Resolution Information
```
GET /resolutions
```

Get details about all H3 resolution levels and their approximate sizes.

## 🎯 Use Cases

### 1. Location-Based Services
```javascript
// Check if two users are in the same neighborhood zone
const user1Zone = await fetch('/zone/37.7749/-122.4194/8').then(r => r.json());
const user2Zone = await fetch('/zone/37.7750/-122.4195/8').then(r => r.json());

if (user1Zone.hash === user2Zone.hash) {
  console.log('Users are in the same neighborhood!');
}
```

### 2. Delivery Area Management
```javascript
// Get all zones within delivery radius
const deliveryZones = await fetch(
  '/zones/radius?lat=37.7749&lng=-122.4194&radius=5000&resolution=8'
).then(r => r.json());

// Store delivery zones in database for fast lookups
deliveryZones.zones.forEach(zone => {
  database.saveDeliveryZone(zone.hash, restaurantId);
});
```

### 3. Real Estate Analytics
```javascript
// Get all property zones in a city district
const districtZones = await fetch('/zones/area?' + new URLSearchParams({
  minLat: 37.7,
  minLng: -122.5,
  maxLat: 37.8,
  maxLng: -122.3,
  resolution: 10
})).then(r => r.json());

// Analyze property prices by zone
districtZones.zones.forEach(zone => {
  const avgPrice = calculateAveragePrice(zone.hash);
  console.log(`Zone ${zone.hash}: $${avgPrice}`);
});
```

### 4. Event Planning
```javascript
// Find zones with high foot traffic around an event venue
const eventLocation = { lat: 37.7749, lng: -122.4194 };
const eventZone = await fetch(`/zone/${eventLocation.lat}/${eventLocation.lng}/9`)
  .then(r => r.json());

const nearbyZones = await fetch(`/zone/${eventZone.hash}/neighbors?k=3`)
  .then(r => r.json());

// Plan food trucks in high-traffic neighboring zones
nearbyZones.neighbors.forEach(zone => {
  const traffic = getFootTraffic(zone.hash);
  if (traffic > threshold) {
    planFoodTruck(zone.center);
  }
});
```

## 🔧 Resolution Guide

Choose the right resolution for your use case:

| Resolution | Avg Area | Use Case |
|-----------|----------|----------|
| 0-2 | ~4.25M-86K km² | Countries, continents |
| 3-4 | ~12K-1.7K km² | States, large cities |
| 5-7 | ~253-5 km² | Cities, districts |
| 8-10 | ~0.74-0.015 km² | Neighborhoods, blocks |
| 11-13 | ~2149-308 m² | Buildings, venues |
| 14-15 | ~6-1 m² | Rooms, precise locations |

## 📊 Performance Tips

1. **Choose appropriate resolution**: Higher resolutions create more zones but give finer precision
2. **Cache zone lookups**: Zone hashes don't change, so cache frequently accessed zones
3. **Batch operations**: Use polygon endpoints for bulk zone operations
4. **Index by hash**: Store H3 hashes in your database for fast spatial queries

## 🔗 Integration Examples

### JavaScript/Node.js
```javascript
const getZoneHash = async (lat, lng, resolution = 9) => {
  const response = await fetch(`http://localhost:3000/zone/${lat}/${lng}/${resolution}`);
  const data = await response.json();
  return data.hash;
};

// Usage
const myZone = await getZoneHash(37.7749, -122.4194);
console.log('I am in zone:', myZone);
```

### Python
```python
import requests

def get_zone_hash(lat, lng, resolution=9):
    url = f"http://localhost:3000/zone/{lat}/{lng}/{resolution}"
    response = requests.get(url)
    return response.json()['hash']

# Usage
my_zone = get_zone_hash(37.7749, -122.4194)
print(f"I am in zone: {my_zone}")
```

### PHP
```php
function getZoneHash($lat, $lng, $resolution = 9) {
    $url = "http://localhost:3000/zone/{$lat}/{$lng}/{$resolution}";
    $response = file_get_contents($url);
    $data = json_decode($response, true);
    return $data['hash'];
}

// Usage
$myZone = getZoneHash(37.7749, -122.4194);
echo "I am in zone: " . $myZone;
```

## 🌐 Production Deployment

For production use:

1. **Environment Variables:**
   ```bash
   export PORT=3000
   export NODE_ENV=production
   ```

2. **Process Management:**
   ```bash
   npm install -g pm2
   pm2 start index.js --name geohashing-api
   ```

3. **Reverse Proxy** (nginx example):
   ```nginx
   location /api/ {
     proxy_pass http://localhost:3000/;
     proxy_set_header Host $host;
   }
   ```

## 📄 License

MIT License - Feel free to use in your projects!

## 🤝 Contributing

Contributions welcome! Please feel free to submit issues and enhancement requests.

---

**Happy Geohashing! 🗺️✨** 