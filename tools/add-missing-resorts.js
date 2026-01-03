import { geocodeAddress } from './geocoder.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get API key from environment variable or command line argument
const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.argv[2];

if (!apiKey) {
  console.error('Error: Google Maps API key is required');
  console.error('Usage: node add-missing-resorts.js YOUR_API_KEY');
  console.error('Or set GOOGLE_MAPS_API_KEY environment variable');
  process.exit(1);
}

// Missing resorts to add
const missingResorts = [
  {
    name: "Marmot Basin",
    address: "1 Marmot Road, Jasper, AB T0E 1E0",
    city: "Jasper",
    country: "Canada",
    region: "Alberta",
    id: "marmot-basin"
  },
  {
    name: "Bridger Bowl",
    address: "15795 Bridger Canyon Road, Bozeman, MT 59715",
    city: "Bozeman",
    country: "United States",
    region: "Montana",
    id: "bridger-bowl"
  },
  {
    name: "Brian Head",
    address: "329 South Highway 143, Brian Head, UT 84719",
    city: "Brian Head",
    country: "United States",
    region: "Utah",
    id: "brian-head"
  },
  {
    name: "Alyeska Resort",
    address: "1000 Arlberg Avenue, Girdwood, AK 99587",
    city: "Girdwood",
    country: "United States",
    region: "Alaska",
    id: "alyeska-resort"
  }
];

async function addMissingResorts() {
  console.log('Reading ski resorts data...\n');

  // Read the existing JSON file
  const inputFile = path.join(__dirname, '..', 'ski_resorts.json');
  const data = await fs.readFile(inputFile, 'utf-8');
  const resortsData = JSON.parse(data);

  // Get existing resort IDs to avoid duplicates
  const existingIds = new Set(resortsData.resorts.map(r => r.id));

  console.log(`Found ${resortsData.resorts.length} existing resorts`);
  console.log(`Adding ${missingResorts.length} missing resorts...\n`);
  console.log('='.repeat(60));

  let addedCount = 0;

  for (const resort of missingResorts) {
    // Skip if already exists
    if (existingIds.has(resort.id)) {
      console.log(`\nSkipping: ${resort.name} (already exists)`);
      continue;
    }

    try {
      console.log(`\nGeocoding: ${resort.name}`);
      console.log(`  Address: ${resort.address}`);

      // Geocode the address
      const searchAddress = resort.country === 'United States'
        ? resort.address + ', USA'
        : resort.address + ', Canada';
      const result = await geocodeAddress(searchAddress, apiKey);

      // Add to resorts array with pass type "INDEPENDENT"
      resortsData.resorts.push({
        name: resort.name,
        address: resort.address,
        city: resort.city,
        country: resort.country,
        region: resort.region,
        id: resort.id,
        latitude: result.lat,
        longitude: result.lng,
        formatted_address: result.formattedAddress,
        pass: "INDEPENDENT"
      });

      console.log(`  ✓ Latitude:  ${result.lat}`);
      console.log(`  ✓ Longitude: ${result.lng}`);
      addedCount++;

      // Add delay to avoid hitting API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      // Add without coordinates if geocoding fails
      resortsData.resorts.push({
        name: resort.name,
        address: resort.address,
        city: resort.city,
        country: resort.country,
        region: resort.region,
        id: resort.id,
        pass: "INDEPENDENT"
      });
      console.log(`  ⚠ Added without coordinates`);
      addedCount++;
    }
  }

  // Update the last_updated timestamp
  resortsData.last_updated = new Date().toISOString().split('T')[0];

  // Write the updated data back to file
  await fs.writeFile(inputFile, JSON.stringify(resortsData, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log(`✓ Successfully added ${addedCount} missing resorts`);
  console.log(`✓ Total resorts: ${resortsData.resorts.length}`);
  console.log(`✓ Updated ${inputFile}`);
}

// Run the script
addMissingResorts().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
