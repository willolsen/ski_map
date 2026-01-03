/**
 * Generate precipitation forecast data for ski resorts using Open-Meteo API
 * This script fetches 16-day daily precipitation forecasts (rain and snow) for each resort location
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
 * Fetch daily precipitation forecast for a specific location using Open-Meteo API
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Array>} - Array of daily precipitation data (rain and snow)
 */
async function fetchPrecipitationForecast(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    daily: 'precipitation_sum,rain_sum,snowfall_sum,weather_code',
    forecast_days: 16,
    temperature_unit: 'fahrenheit',
    timezone: 'auto'
  });

  try {
    const response = await fetch(`${API_BASE_URL}?${params}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Process daily data
    const dailyForecasts = [];

    if (data.daily?.time) {
      for (let i = 0; i < data.daily.time.length; i++) {
        const rainMm = data.daily.rain_sum?.[i] || 0;
        const snowCm = data.daily.snowfall_sum?.[i] || 0;

        dailyForecasts.push({
          date: data.daily.time[i],
          rain_inches: Math.round(rainMm * 0.0393701 * 10) / 10, // mm to inches
          snow_inches: Math.round(snowCm * 0.393701 * 10) / 10,  // cm to inches
          weather_code: data.daily.weather_code?.[i] || 0
        });
      }
    }

    return dailyForecasts;
  } catch (error) {
    console.error(`Error fetching data for (${lat}, ${lng}):`, error.message);
    // Return empty array on error
    return [];
  }
}

/**
 * Process all resorts and generate snowfall data
 */
async function generatePrecipitationData() {
  console.log('Starting precipitation data generation...');
  console.log(`Using Open-Meteo API (free, no API key required)`);
  console.log(`Fetching 16-day daily forecasts with rain/snow breakdown`);

  const precipitationData = {
    generated_at: new Date().toISOString(),
    forecast_days: 16,
    unit: 'inches',
    resorts: []
  };

  // Process US resorts
  console.log('\nProcessing United States resorts...');
  for (const resort of resortData.ikon_pass_resorts_north_america.united_states) {
    console.log(`  Fetching data for ${resort.name}...`);
    const dailyForecasts = await fetchPrecipitationForecast(resort.latitude, resort.longitude);

    precipitationData.resorts.push({
      id: resort.id,
      name: resort.name,
      latitude: resort.latitude,
      longitude: resort.longitude,
      region: resort.region,
      country: resort.country,
      daily_forecasts: dailyForecasts
    });

    // Rate limiting: wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Process Canadian resorts
  console.log('\nProcessing Canadian resorts...');
  for (const resort of resortData.ikon_pass_resorts_north_america.canada) {
    console.log(`  Fetching data for ${resort.name}...`);
    const dailyForecasts = await fetchPrecipitationForecast(resort.latitude, resort.longitude);

    precipitationData.resorts.push({
      id: resort.id,
      name: resort.name,
      latitude: resort.latitude,
      longitude: resort.longitude,
      region: resort.region,
      country: resort.country,
      daily_forecasts: dailyForecasts
    });

    // Rate limiting: wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Save to file
  const outputPath = join(__dirname, '../snowfall_forecast.json');
  writeFileSync(outputPath, JSON.stringify(precipitationData, null, 2));

  console.log(`\nPrecipitation data generated successfully!`);
  console.log(`Total resorts processed: ${precipitationData.resorts.length}`);
  console.log(`Forecast period: 16 days`);
  console.log(`Output file: ${outputPath}`);

  // Print some statistics
  const resortsWithTotals = precipitationData.resorts.map(resort => {
    const totalSnow = resort.daily_forecasts.reduce((sum, day) => sum + day.snow_inches, 0);
    const totalRain = resort.daily_forecasts.reduce((sum, day) => sum + day.rain_inches, 0);
    return { ...resort, totalSnow, totalRain };
  });

  const sorted = resortsWithTotals.sort((a, b) => b.totalSnow - a.totalSnow);
  console.log('\nTop 5 resorts by 16-day total snowfall:');
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    console.log(`  ${i + 1}. ${sorted[i].name}: ${sorted[i].totalSnow.toFixed(1)}" snow, ${sorted[i].totalRain.toFixed(1)}" rain (${sorted[i].region})`);
  }
}

// Run the script
generatePrecipitationData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
