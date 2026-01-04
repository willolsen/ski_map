/**
 * Calculate and display powder scores for ski resorts
 * Uses Node https module for better reliability
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const API_BASE_URL = 'api.open-meteo.com';
const PAST_DAYS = 5;
const FORECAST_DAYS = 16; // Maximum supported by Open-Meteo API
const LOOKBACK_WINDOW = 3;

// Read resort data
const resortDataPath = join(__dirname, '../ski_resorts.json');
const resortData = JSON.parse(readFileSync(resortDataPath, 'utf-8'));

/**
 * Fetch weather data using https module
 */
function fetchWeatherData(lat, lng) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lng,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,snowfall_sum',
      past_days: PAST_DAYS,
      forecast_days: FORECAST_DAYS,
      temperature_unit: 'fahrenheit',
      timezone: 'auto'
    });

    const options = {
      hostname: API_BASE_URL,
      path: `/v1/forecast?${params}`,
      method: 'GET',
      headers: {
        'User-Agent': 'PowderScoreCalculator/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const dailyData = [];

          if (json.daily?.time) {
            for (let i = 0; i < json.daily.time.length; i++) {
              dailyData.push({
                date: json.daily.time[i],
                temp_max: json.daily.temperature_2m_max?.[i] || 0,
                temp_min: json.daily.temperature_2m_min?.[i] || 0,
                temp_avg: ((json.daily.temperature_2m_max?.[i] || 0) + (json.daily.temperature_2m_min?.[i] || 0)) / 2,
                rain_inches: Math.round((json.daily.rain_sum?.[i] || 0) * 0.0393701 * 10) / 10,
                snow_inches: Math.round((json.daily.snowfall_sum?.[i] || 0) * 0.393701 * 10) / 10,
                precip_inches: Math.round((json.daily.precipitation_sum?.[i] || 0) * 0.0393701 * 10) / 10
              });
            }
          }

          resolve(dailyData);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Calculate temperature quality factor
 */
function calculateTempQuality(tempAvg) {
  const optimalLow = 15;
  const optimalHigh = 25;
  const coldPenaltyStart = 0;
  const warmPenaltyStart = 35;

  if (tempAvg >= optimalLow && tempAvg <= optimalHigh) {
    return 1.0;
  } else if (tempAvg > optimalHigh && tempAvg <= warmPenaltyStart) {
    return 1.0 - ((tempAvg - optimalHigh) / (warmPenaltyStart - optimalHigh)) * 0.5;
  } else if (tempAvg > warmPenaltyStart) {
    return Math.max(0.3, 0.5 - ((tempAvg - warmPenaltyStart) / 20) * 0.3);
  } else if (tempAvg < optimalLow && tempAvg >= coldPenaltyStart) {
    return 1.0 - ((optimalLow - tempAvg) / (optimalLow - coldPenaltyStart)) * 0.2;
  } else {
    return 0.8;
  }
}

/**
 * Calculate days since last significant rain
 */
function daysSinceRain(dailyData, currentIndex) {
  for (let i = currentIndex; i >= 0; i--) {
    if (dailyData[i].rain_inches > 0.1) {
      return currentIndex - i;
    }
  }
  return 999;
}

/**
 * Calculate accumulated fresh snow
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
 * Calculate powder score
 */
function calculatePowderScore(dailyData, currentIndex) {
  const day = dailyData[currentIndex];
  const todaySnow = Math.min(day.snow_inches * 5, 50);
  const accumulated3day = getAccumulatedSnow(dailyData, currentIndex, LOOKBACK_WINDOW);
  const accumulationBonus = Math.min(accumulated3day * 2, 30);
  const tempQuality = calculateTempQuality(day.temp_avg);

  const daysSinceLastRain = daysSinceRain(dailyData, currentIndex);
  let rainPenalty = 1.0;
  if (daysSinceLastRain === 0) rainPenalty = 0.3;
  else if (daysSinceLastRain === 1) rainPenalty = 0.5;
  else if (daysSinceLastRain === 2) rainPenalty = 0.7;
  else if (daysSinceLastRain === 3) rainPenalty = 0.85;

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
 * Process a single resort
 */
async function processResort(resort) {
  console.log(`Processing: ${resort.name} (${resort.region})...`);

  try {
    const weatherData = await fetchWeatherData(resort.latitude, resort.longitude);

    if (weatherData.length === 0) {
      console.log('  ❌ No weather data available');
      return null;
    }

    const todayIndex = PAST_DAYS;
    const forecastDays = [];

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (let i = todayIndex; i < Math.min(weatherData.length, todayIndex + FORECAST_DAYS); i++) {
      const day = weatherData[i];
      const powderData = calculatePowderScore(weatherData, i);

      forecastDays.push({
        date: day.date,
        is_today: day.date === todayStr,
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

    const maxScore = Math.max(...forecastDays.map(d => d.powder_score.total_score));
    const bestDay = forecastDays.find(d => d.powder_score.total_score === maxScore);
    const totalSnow = forecastDays.reduce((sum, d) => sum + d.precipitation.snow_inches, 0);

    console.log(`  ✓ Best day: ${bestDay.date} (Score: ${maxScore})`);

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
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🎿 Powder Score Calculator v2');
  console.log('Using HTTPS module for API requests\n');

  const resorts = resortData.resorts; // All resorts - US and Canada

  const results = [];
  for (const resort of resorts) {
    const resortResult = await processResort(resort);
    if (resortResult) {
      results.push(resortResult);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  results.sort((a, b) => b.summary.best_powder_score - a.summary.best_powder_score);

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

  console.log(`\n✅ Done!`);
  console.log(`📁 Results saved to: powder-scores.json`);
  console.log(`📊 Resorts processed: ${results.length}`);

  if (results.length > 0) {
    console.log(`\n🏆 Top 3 Best Powder Days:`);
    for (let i = 0; i < Math.min(3, results.length); i++) {
      const r = results[i];
      console.log(`   ${i + 1}. ${r.resort_info.name}: ${r.summary.best_powder_day} (Score: ${r.summary.best_powder_score})`);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
