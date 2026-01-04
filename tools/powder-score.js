/**
 * Calculate and display powder scores for ski resorts
 * Based on snow quantity, quality (temperature, SLR), and time since rain
 * Uses Open-Meteo API (free, no API key required)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const API_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const PAST_DAYS = 5; // Look back 5 days for accumulation and rain tracking
const FORECAST_DAYS = 7; // Show 7 days ahead
const LOOKBACK_WINDOW = 3; // Consider last 3 days for accumulated fresh snow

// Read resort data
const resortDataPath = join(__dirname, '../ski_resorts.json');
const resortData = JSON.parse(readFileSync(resortDataPath, 'utf-8'));

/**
 * Fetch weather data (past + forecast) for a location
 */
async function fetchWeatherData(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,snowfall_sum',
    past_days: PAST_DAYS,
    forecast_days: FORECAST_DAYS,
    temperature_unit: 'fahrenheit',
    timezone: 'auto'
  });

  try {
    const response = await fetch(`${API_BASE_URL}?${params}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const dailyData = [];

    if (data.daily?.time) {
      for (let i = 0; i < data.daily.time.length; i++) {
        dailyData.push({
          date: data.daily.time[i],
          temp_max: data.daily.temperature_2m_max?.[i] || 0,
          temp_min: data.daily.temperature_2m_min?.[i] || 0,
          temp_avg: ((data.daily.temperature_2m_max?.[i] || 0) + (data.daily.temperature_2m_min?.[i] || 0)) / 2,
          rain_inches: Math.round((data.daily.rain_sum?.[i] || 0) * 0.0393701 * 10) / 10,
          snow_inches: Math.round((data.daily.snowfall_sum?.[i] || 0) * 0.393701 * 10) / 10,
          precip_inches: Math.round((data.daily.precipitation_sum?.[i] || 0) * 0.0393701 * 10) / 10
        });
      }
    }

    return dailyData;
  } catch (error) {
    console.error(`Error fetching data for (${lat}, ${lng}):`, error.message);
    return [];
  }
}

/**
 * Calculate temperature quality factor
 * Peak quality at 15-25°F, decline outside this range
 */
function calculateTempQuality(tempAvg) {
  // Optimal range: 15-25°F
  const optimalLow = 15;
  const optimalHigh = 25;
  const coldPenaltyStart = 0;
  const warmPenaltyStart = 35;

  if (tempAvg >= optimalLow && tempAvg <= optimalHigh) {
    return 1.0; // Perfect
  } else if (tempAvg > optimalHigh && tempAvg <= warmPenaltyStart) {
    // Gradual decline as it warms
    return 1.0 - ((tempAvg - optimalHigh) / (warmPenaltyStart - optimalHigh)) * 0.5;
  } else if (tempAvg > warmPenaltyStart) {
    // Steep penalty for warm temps
    return Math.max(0.3, 0.5 - ((tempAvg - warmPenaltyStart) / 20) * 0.3);
  } else if (tempAvg < optimalLow && tempAvg >= coldPenaltyStart) {
    // Slight penalty for very cold
    return 1.0 - ((optimalLow - tempAvg) / (optimalLow - coldPenaltyStart)) * 0.2;
  } else {
    // Very cold - too dry/light
    return 0.8;
  }
}

/**
 * Calculate days since last significant rain
 * Returns -1 if rain today/recent, otherwise days elapsed
 */
function daysSinceRain(dailyData, currentIndex) {
  // Check current day and look back
  for (let i = currentIndex; i >= 0; i--) {
    if (dailyData[i].rain_inches > 0.1) { // Significant rain
      return currentIndex - i;
    }
  }
  return 999; // No rain in lookback window
}

/**
 * Calculate accumulated fresh snow over the lookback window
 */
function getAccumulatedSnow(dailyData, currentIndex, days) {
  let total = 0;
  const startIndex = Math.max(0, currentIndex - days + 1);
  for (let i = startIndex; i <= currentIndex; i++) {
    total += dailyData[i].snow_inches;
  }
  return total;
}

/**
 * Calculate powder score for a given day
 */
function calculatePowderScore(dailyData, currentIndex) {
  const day = dailyData[currentIndex];

  // 1. Fresh Snow Quantity (0-50 points for today's snow)
  const todaySnow = Math.min(day.snow_inches * 5, 50);

  // 2. Accumulated Snow Bonus (0-30 points for 3-day accumulation)
  const accumulated3day = getAccumulatedSnow(dailyData, currentIndex, LOOKBACK_WINDOW);
  const accumulationBonus = Math.min(accumulated3day * 2, 30);

  // 3. Temperature Quality (0.3 - 1.0 multiplier)
  const tempQuality = calculateTempQuality(day.temp_avg);

  // 4. Rain Penalty
  const daysSinceLastRain = daysSinceRain(dailyData, currentIndex);
  let rainPenalty = 1.0;
  if (daysSinceLastRain === 0) {
    rainPenalty = 0.3; // Rain today - severe penalty
  } else if (daysSinceLastRain === 1) {
    rainPenalty = 0.5; // Rain yesterday - major penalty
  } else if (daysSinceLastRain === 2) {
    rainPenalty = 0.7; // Rain 2 days ago - moderate penalty
  } else if (daysSinceLastRain === 3) {
    rainPenalty = 0.85; // Rain 3 days ago - slight penalty
  }

  // 5. Calculate final score
  const baseScore = todaySnow + accumulationBonus;
  const finalScore = Math.round(baseScore * tempQuality * rainPenalty);

  return {
    score: finalScore,
    todaySnow: day.snow_inches,
    accumulated3day,
    tempQuality,
    rainPenalty,
    daysSinceLastRain: daysSinceLastRain === 999 ? '5+' : daysSinceLastRain
  };
}

/**
 * Format a table row
 */
function formatTableRow(resort, day, powderData) {
  const date = day.date.slice(5); // MM-DD
  const snow = day.snow_inches.toFixed(1).padStart(4);
  const rain = day.rain_inches > 0 ? `${day.rain_inches.toFixed(1)}"` : '   ';
  const temp = `${Math.round(day.temp_min)}-${Math.round(day.temp_max)}°F`;
  const score = powderData.score.toString().padStart(3);
  const accumulated = powderData.accumulated3day.toFixed(1).padStart(4);

  return `${date} │ ${snow}" │ ${rain.padEnd(4)} │ ${temp.padEnd(9)} │ ${accumulated}" │ ${score}`;
}

/**
 * Process a single resort and display results
 */
async function processResort(resort) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${resort.name} (${resort.region})`);
  console.log(`${'='.repeat(80)}`);

  const weatherData = await fetchWeatherData(resort.latitude, resort.longitude);

  if (weatherData.length === 0) {
    console.log('❌ No weather data available');
    return null;
  }

  // Find today's index (first day that's not in the past)
  const todayIndex = PAST_DAYS;

  console.log('Date  │ Snow │ Rain │ Temp (°F) │ 3day │ Score');
  console.log('──────┼──────┼──────┼───────────┼──────┼──────');

  // Show past days (context)
  for (let i = Math.max(0, todayIndex - 2); i < todayIndex; i++) {
    const day = weatherData[i];
    const powderData = calculatePowderScore(weatherData, i);
    console.log(formatTableRow(resort, day, powderData));
  }

  console.log('──────┴──────┴──────┴───────────┴──────┴──────');

  // Build forecast data for JSON - include ALL data
  const forecastDays = [];
  for (let i = todayIndex; i < Math.min(weatherData.length, todayIndex + FORECAST_DAYS); i++) {
    const day = weatherData[i];
    const powderData = calculatePowderScore(weatherData, i);
    const isToday = i === todayIndex;
    const prefix = isToday ? '▶ ' : '  ';
    console.log(prefix + formatTableRow(resort, day, powderData));

    forecastDays.push({
      date: day.date,
      is_today: isToday,
      temperature: {
        min_f: Math.round(day.temp_min * 10) / 10,
        max_f: Math.round(day.temp_max * 10) / 10,
        avg_f: Math.round(day.temp_avg * 10) / 10
      },
      precipitation: {
        snow_inches: day.snow_inches,
        rain_inches: day.rain_inches,
        total_inches: day.precip_inches
      },
      powder_score: {
        total_score: powderData.score,
        snow_today_inches: powderData.todaySnow,
        accumulated_3day_inches: powderData.accumulated3day,
        temp_quality_factor: Math.round(powderData.tempQuality * 100) / 100,
        rain_penalty_factor: Math.round(powderData.rainPenalty * 100) / 100,
        days_since_last_rain: powderData.daysSinceLastRain
      }
    });
  }

  // Summary stats
  const maxScore = Math.max(...forecastDays.map(d => d.powder_score.total_score));
  const bestDay = forecastDays.find(d => d.powder_score.total_score === maxScore);
  const totalSnow = forecastDays.reduce((sum, d) => sum + d.precipitation.snow_inches, 0);

  console.log('\n📊 Forecast Summary:');
  console.log(`   Best day: ${bestDay.date} (Score: ${maxScore})`);
  console.log(`   7-day total: ${totalSnow.toFixed(1)}" snow`);

  return {
    resort_info: {
      id: resort.id,
      name: resort.name,
      region: resort.region,
      country: resort.country,
      latitude: resort.latitude,
      longitude: resort.longitude
    },
    summary: {
      best_powder_day: bestDay.date,
      best_powder_score: maxScore,
      total_snow_7day_inches: Math.round(totalSnow * 10) / 10
    },
    daily_forecast: forecastDays
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🎿 Powder Score Calculator');
  console.log('=' .repeat(80));
  console.log('Formula: (Today\'s Snow × 5 + 3-day Accum × 2) × Temp Quality × Rain Penalty');
  console.log('Optimal temp: 15-25°F | Lookback: 5 days | Forecast: 7 days');
  console.log('=' .repeat(80));

  // Get sample of resorts (adjust as needed)
  const resorts = resortData.resorts
    .filter(r => r.country === 'United States')
    .slice(0, 10); // Process first 10 resorts

  const results = [];
  for (const resort of resorts) {
    const resortData = await processResort(resort);
    if (resortData) {
      results.push(resortData);
    }
    await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
  }

  // Sort by best score descending
  results.sort((a, b) => b.best_score - a.best_score);

  // Save to JSON
  const output = {
    generated_at: new Date().toISOString(),
    formula: '(Today\'s Snow × 5 + 3-day Accum × 2) × Temp Quality × Rain Penalty',
    parameters: {
      optimal_temp_range: '15-25°F',
      lookback_days: PAST_DAYS,
      forecast_days: FORECAST_DAYS,
      lookback_window: LOOKBACK_WINDOW
    },
    resorts: results
  };

  const outputPath = join(__dirname, '../powder-scores.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log('\n✅ Done!');
  console.log(`📁 Results saved to: ${outputPath}`);
  console.log(`📊 Total resorts processed: ${results.length}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
