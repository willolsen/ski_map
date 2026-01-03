// Script to add ID fields to each resort in the JSON file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to generate ID from resort name
function generateId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
}

// Read the JSON file
const jsonPath = path.join(__dirname, '../ikon_pass_resorts_north_america.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Add IDs to US resorts
data.ikon_pass_resorts_north_america.united_states.forEach(resort => {
  resort.id = generateId(resort.name);
});

// Add IDs to Canadian resorts
data.ikon_pass_resorts_north_america.canada.forEach(resort => {
  resort.id = generateId(resort.name);
});

// Write back to file with nice formatting
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

console.log('Successfully added IDs to all resorts!');
console.log(`US resorts: ${data.ikon_pass_resorts_north_america.united_states.length}`);
console.log(`Canadian resorts: ${data.ikon_pass_resorts_north_america.canada.length}`);
