/**
 * Generate snowfall forecast data for ski resorts using Open-Meteo API
 * This script fetches 7-day cumulative snowfall forecasts for each resort location
 * Open-Meteo is free and requires no API key!
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Open-Meteo API configuration (no API key required!)
const API_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// Read resort data
const resortDataPath = join(__dirname, '../ikon_pass_resorts_north_america.json');
const resortData = JSON.parse(readFileSync(resortDataPath, 'utf-8'));

/**
 * Fetch snowfall forecast for a specific location using Open-Meteo API
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<number>} - Total snowfall accumulation in inches over 7 days
 */
async function fetchSnowfallForecast(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    hourly: 'snowfall',
    forecast_days: 7,
    temperature_unit: 'fahrenheit'
  });

  try {
    const response = await fetch(`${API_BASE_URL}?${params}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Sum up hourly snowfall over the 7-day period
    let totalSnowfall = 0;

    if (data.hourly?.snowfall) {
      for (const snowfallCm of data.hourly.snowfall) {
        if (snowfallCm && snowfallCm > 0) {
          // Convert from centimeters to inches (1 cm = 0.393701 inches)
          totalSnowfall += snowfallCm * 0.393701;
        }
      }
    }

    return totalSnowfall;
  } catch (error) {
    console.error(`Error fetching data for (${lat}, ${lng}):`, error.message);
    // Return 0 on error
    return 0;
  }
}

/**
 * Process all resorts and generate snowfall data
 */
async function generateSnowfallData() {
  console.log('Starting snowfall data generation...');
  console.log(`Using Open-Meteo API (free, no API key required)`);

  const snowfallData = {
    generated_at: new Date().toISOString(),
    forecast_period: '7-day cumulative',
    unit: 'inches',
    resorts: []
  };

  // Process US resorts
  console.log('\nProcessing United States resorts...');
  for (const resort of resortData.ikon_pass_resorts_north_america.united_states) {
    console.log(`  Fetching data for ${resort.name}...`);
    const snowfall = await fetchSnowfallForecast(resort.latitude, resort.longitude);

    snowfallData.resorts.push({
      id: resort.id,
      name: resort.name,
      latitude: resort.latitude,
      longitude: resort.longitude,
      snowfall_7day: Math.round(snowfall * 10) / 10, // Round to 1 decimal
      region: resort.region,
      country: resort.country
    });

    // Rate limiting: wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Process Canadian resorts
  console.log('\nProcessing Canadian resorts...');
  for (const resort of resortData.ikon_pass_resorts_north_america.canada) {
    console.log(`  Fetching data for ${resort.name}...`);
    const snowfall = await fetchSnowfallForecast(resort.latitude, resort.longitude);

    snowfallData.resorts.push({
      id: resort.id,
      name: resort.name,
      latitude: resort.latitude,
      longitude: resort.longitude,
      snowfall_7day: Math.round(snowfall * 10) / 10, // Round to 1 decimal
      region: resort.region,
      country: resort.country
    });

    // Rate limiting: wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Save to file
  const outputPath = join(__dirname, '../snowfall_forecast.json');
  writeFileSync(outputPath, JSON.stringify(snowfallData, null, 2));

  console.log(`\nSnowfall data generated successfully!`);
  console.log(`Total resorts processed: ${snowfallData.resorts.length}`);
  console.log(`Output file: ${outputPath}`);

  // Print some statistics
  const sorted = snowfallData.resorts.sort((a, b) => b.snowfall_7day - a.snowfall_7day);
  console.log('\nTop 5 resorts by 7-day snowfall forecast:');
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    console.log(`  ${i + 1}. ${sorted[i].name}: ${sorted[i].snowfall_7day}" (${sorted[i].region})`);
  }
}

// Run the script
generateSnowfallData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
