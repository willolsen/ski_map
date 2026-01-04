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
