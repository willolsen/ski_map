import { SkiResort } from './types';
import resortData from '../ikon_pass_resorts_north_america.json';

// Helper function to generate ID from resort name
function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
}

// Transform JSON data into SkiResort format
export const skiResorts: SkiResort[] = [
  // United States resorts
  ...resortData.ikon_pass_resorts_north_america.united_states.map((resort) => ({
    id: generateId(resort.name),
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
    id: generateId(resort.name),
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
