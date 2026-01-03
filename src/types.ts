export interface SkiResort {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  pass: 'IKON' | 'EPIC' | 'OTHER';
  region: string;
  country: string;
  accessType?: string;
  address?: string;
  city?: string;
}

export interface RouteInfo {
  origin: SkiResort;
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
