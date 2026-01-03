import { SkiResort } from './types';
import resortData from '../ikon_pass_resorts_north_america.json';

// Transform JSON data into SkiResort format
export const skiResorts: SkiResort[] = [
  // United States resorts
  ...resortData.ikon_pass_resorts_north_america.united_states.map((resort) => ({
    id: resort.id,
    name: resort.name,
    location: {
      lat: resort.latitude,
      lng: resort.longitude,
    },
    pass: 'IKON' as const,
    state: resort.state,
    country: resort.country,
    accessType: resort.access_type,
    address: resort.address,
    city: resort.city,
  })),
  // Canadian resorts
  ...resortData.ikon_pass_resorts_north_america.canada.map((resort) => ({
    id: resort.id,
    name: resort.name,
    location: {
      lat: resort.latitude,
      lng: resort.longitude,
    },
    pass: 'IKON' as const,
    state: resort.province,
    country: resort.country,
    accessType: resort.access_type,
    address: resort.address,
    city: resort.city,
  })),
];
