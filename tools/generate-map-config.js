import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define western regions
const westernUSStates = [
  'Colorado', 'California', 'Utah', 'Wyoming', 'Montana',
  'Washington', 'Oregon', 'Idaho', 'New Mexico'
];

const westernCanadianProvinces = [
  'British Columbia', 'Alberta'
];

// Read the resort data
const dataPath = path.join(__dirname, '..', 'ski_resorts.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(rawData);

// Filter for western resorts
const allWesternRegions = [...westernUSStates, ...westernCanadianProvinces];
const westernResorts = data.resorts.filter(resort =>
  allWesternRegions.includes(resort.region)
);

console.log(`Found ${westernResorts.length} western ski resorts`);

// Calculate bounding box
let minLat = Infinity;
let maxLat = -Infinity;
let minLng = Infinity;
let maxLng = -Infinity;

westernResorts.forEach(resort => {
  const lat = resort.latitude;
  const lng = resort.longitude;

  if (lat < minLat) minLat = lat;
  if (lat > maxLat) maxLat = lat;
  if (lng < minLng) minLng = lng;
  if (lng > maxLng) maxLng = lng;
});

// Calculate center point
const centerLat = (minLat + maxLat) / 2;
const centerLng = (minLng + maxLng) / 2;

// Create config object
const config = {
  initialView: {
    center: {
      lat: centerLat,
      lng: centerLng
    },
    bounds: {
      north: maxLat,
      south: minLat,
      east: maxLng,
      west: minLng
    },
    description: "Western North America ski areas",
    resortCount: westernResorts.length
  }
};

// Write config file
const configPath = path.join(__dirname, '..', 'map-config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('\nMap Configuration:');
console.log(`Center: ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`);
console.log(`Bounds: N ${maxLat.toFixed(4)}, S ${minLat.toFixed(4)}, E ${maxLng.toFixed(4)}, W ${minLng.toFixed(4)}`);
console.log(`\nConfig file created: ${configPath}`);
