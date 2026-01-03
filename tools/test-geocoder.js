import { geocodeAddress } from './geocoder.js';

// Get API key from environment variable or command line argument
const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.argv[2];

if (!apiKey) {
  console.error('Error: Google Maps API key is required');
  console.error('Usage: node test-geocoder.js YOUR_API_KEY');
  console.error('Or set GOOGLE_MAPS_API_KEY environment variable');
  process.exit(1);
}

// Test with famous landmarks
const testAddresses = [
  '1600 Pennsylvania Avenue NW, Washington, DC',
  'Eiffel Tower, Paris, France',
  'Times Square, New York, NY'
];

async function runTests() {
  console.log('Testing Google Maps Geocoding API\n');
  console.log('='.repeat(60));

  for (const address of testAddresses) {
    try {
      console.log(`\nGeocoding: ${address}`);
      const result = await geocodeAddress(address, apiKey);

      console.log(`  Latitude:  ${result.lat}`);
      console.log(`  Longitude: ${result.lng}`);
      console.log(`  Formatted: ${result.formattedAddress}`);
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Tests completed!');
}

runTests();
