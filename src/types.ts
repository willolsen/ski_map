export interface SkiResort {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  pass: 'IKON' | 'OTHER';
  state: string;
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
