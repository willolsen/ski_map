export interface SkiResort {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  pass: 'IKON' | 'OTHER';
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

export interface SnowfallData {
  generated_at: string;
  forecast_period: string;
  unit: string;
  resorts: SnowfallResort[];
}

export interface SnowfallResort {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  snowfall_7day: number;
  region: string;
  country: string;
}
