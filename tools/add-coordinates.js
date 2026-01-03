import { geocodeAddress } from './geocoder.js';
import fs from 'fs/promises';
import path from 'path';

// Get API key from environment variable or command line argument
const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.argv[2];

if (!apiKey) {
  console.error('Error: Google Maps API key is required');
  console.error('Usage: node add-coordinates.js YOUR_API_KEY');
  console.error('Or set GOOGLE_MAPS_API_KEY environment variable');
  process.exit(1);
}

// File paths
const inputFile = path.join(process.cwd(), 'ikon_pass_resorts_north_america.json');
const outputFile = path.join(process.cwd(), 'ikon_pass_resorts_north_america.json');

async function addCoordinatesToResorts() {
  console.log('Reading ski resorts data...\n');

  // Read the JSON file
  const data = await fs.readFile(inputFile, 'utf-8');
  const resortsData = JSON.parse(data);

  // Process US resorts
  console.log('Processing US resorts...');
  console.log('='.repeat(60));

  for (const resort of resortsData.ikon_pass_resorts_north_america.united_states) {
    try {
      console.log(`\nGeocoding: ${resort.name}`);
      console.log(`  Address: ${resort.address}`);

      // Use the full address for geocoding
      const searchAddress = resort.address + ', ' + resort.state + ', USA';
      const result = await geocodeAddress(searchAddress, apiKey);

      // Add coordinates to the resort object
      resort.latitude = result.lat;
      resort.longitude = result.lng;
      resort.formatted_address = result.formattedAddress;

      console.log(`  ✓ Latitude:  ${result.lat}`);
      console.log(`  ✓ Longitude: ${result.lng}`);

      // Add delay to avoid hitting API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      // Continue with next resort even if one fails
    }
  }

  // Process Canadian resorts
  console.log('\n\nProcessing Canadian resorts...');
  console.log('='.repeat(60));

  for (const resort of resortsData.ikon_pass_resorts_north_america.canada) {
    try {
      console.log(`\nGeocoding: ${resort.name}`);
      console.log(`  Address: ${resort.address}`);

      // Use the full address for geocoding
      const searchAddress = resort.address + ', ' + resort.province + ', Canada';
      const result = await geocodeAddress(searchAddress, apiKey);

      // Add coordinates to the resort object
      resort.latitude = result.lat;
      resort.longitude = result.lng;
      resort.formatted_address = result.formattedAddress;

      console.log(`  ✓ Latitude:  ${result.lat}`);
      console.log(`  ✓ Longitude: ${result.lng}`);

      // Add delay to avoid hitting API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      // Continue with next resort even if one fails
    }
  }

  // Update the last_updated timestamp
  resortsData.ikon_pass_resorts_north_america.last_updated = new Date().toISOString().split('T')[0];

  // Write the updated data back to file
  await fs.writeFile(outputFile, JSON.stringify(resortsData, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log(`✓ Successfully updated ${outputFile}`);
  console.log('All resorts now have coordinates!');
}

// Run the script
addCoordinatesToResorts().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
