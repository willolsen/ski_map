export interface SkiResort {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  pass: 'IKON' | 'EPIC' | 'INDEPENDENT' | 'OTHER';
  region: string;
  country: string;
  accessType?: string;
  address?: string;
  city?: string;
}

export interface RouteInfo {
  origin: SkiResort | { name: string; location: google.maps.LatLng };
  destination: SkiResort;
  distance: string;
  duration: string;
}

export interface PrecipitationData {
  generated_at: string;
  forecast_days: number;
  unit: string;
  resorts: PrecipitationResort[];
}

export interface PrecipitationResort {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  region: string;
  country: string;
  daily_forecasts: DailyForecast[];
}

export interface DailyForecast {
  date: string;
  rain_inches: number;
  snow_inches: number;
  weather_code: number;
}

export interface TripStop {
  id: string;
  order: number;
  location: google.maps.LatLng;
  type: 'resort' | 'custom';
  resort?: SkiResort;
  customName?: string;
  marker?: google.maps.Marker;
}

export interface RouteSegment {
  fromStopId: string;
  toStopId: string;
  distance: string;
  distanceValue: number;
  duration: string;
  durationValue: number;
}

export interface TripSummary {
  totalDistance: string;
  totalDistanceValue: number;
  totalDuration: string;
  totalDurationValue: number;
  stopCount: number;
  resortCount: number;
  customCount: number;
}

export interface PowderScoreData {
  generated_at: string;
  formula: string;
  parameters: {
    optimal_temp_range: string;
    lookback_days: number;
    forecast_days: number;
    lookback_window: number;
  };
  resorts: PowderScoreResort[];
}

export interface PowderScoreResort {
  resort_info: {
    id: string;
    name: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  summary: {
    best_powder_day: string;
    best_powder_score: number;
    total_snow_7day_inches: number;
  };
  daily_forecast: DailyPowderForecast[];
}

export interface DailyPowderForecast {
  date: string;
  is_today: boolean;
  temperature: {
    min_f: number;
    max_f: number;
    avg_f: number;
  };
  precipitation: {
    snow_inches: number;
    rain_inches: number;
    total_inches: number;
  };
  powder_score: {
    total_score: number;
    snow_today_inches: number;
    accumulated_3day_inches: number;
    temp_quality_factor: number;
    rain_penalty_factor: number;
    days_since_last_rain: string | number;
  };
}
