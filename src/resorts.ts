import { SkiResort } from './types';
import resortData from '../ski_resorts.json';

// Transform JSON data into SkiResort format
export const skiResorts: SkiResort[] = resortData.resorts.map((resort) => ({
  id: resort.id,
  name: resort.name,
  location: {
    lat: resort.latitude,
    lng: resort.longitude,
  },
  pass: resort.pass as 'IKON' | 'EPIC' | 'INDEPENDENT',
  region: resort.region,
  country: resort.country,
  accessType: resort.access_type,
  address: resort.address,
  city: resort.city,
}));
