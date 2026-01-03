import { geocodeAddress } from './geocoder.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get API key from command line
const apiKey = process.argv[2];

if (!apiKey) {
  console.error('Error: Google Maps API key is required');
  console.error('Usage: node add-sierra-tahoe.js YOUR_API_KEY');
  process.exit(1);
}

const resort = {
  name: "Sierra at Tahoe",
  address: "1111 Sierra-at-Tahoe Road, Twin Bridges, CA 95735",
  city: "Twin Bridges",
  country: "United States",
  region: "California",
  id: "sierra-at-tahoe",
  access_type: "7 days",
  pass: "IKON"
};

async function addSierraTahoe() {
  console.log('Reading ski resorts data...\n');

  // Read the existing JSON file
  const inputFile = path.join(__dirname, '..', 'ski_resorts.json');
  const data = await fs.readFile(inputFile, 'utf-8');
  const resortsData = JSON.parse(data);

  // Check if already exists
  const existingIds = new Set(resortsData.resorts.map(r => r.id));
  if (existingIds.has(resort.id)) {
    console.log(`${resort.name} already exists in database`);
    return;
  }

  try {
    console.log(`Geocoding: ${resort.name}`);
    console.log(`  Address: ${resort.address}`);

    // Geocode the address
    const result = await geocodeAddress(resort.address + ', USA', apiKey);

    // Add to resorts array
    resortsData.resorts.push({
      name: resort.name,
      address: resort.address,
      city: resort.city,
      country: resort.country,
      region: resort.region,
      id: resort.id,
      access_type: resort.access_type,
      latitude: result.lat,
      longitude: result.lng,
      formatted_address: result.formattedAddress,
      pass: resort.pass
    });

    console.log(`  ✓ Latitude:  ${result.lat}`);
    console.log(`  ✓ Longitude: ${result.lng}`);

    // Update timestamp
    resortsData.last_updated = new Date().toISOString().split('T')[0];

    // Write back to file
    await fs.writeFile(inputFile, JSON.stringify(resortsData, null, 2), 'utf-8');

    console.log(`\n✓ Successfully added ${resort.name}`);
    console.log(`✓ Total resorts: ${resortsData.resorts.length}`);
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    process.exit(1);
  }
}

addSierraTahoe();
