import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the current file
const inputPath = path.join(__dirname, '..', 'ikon_pass_resorts_north_america.json');
const outputPath = path.join(__dirname, '..', 'ski_resorts.json');

const rawData = fs.readFileSync(inputPath, 'utf8');
const data = JSON.parse(rawData);

// Create flattened structure
const flattenedData = {
  data_source: "Compiled from official IKON Pass and Epic Pass websites and resort websites",
  last_updated: new Date().toISOString().split('T')[0],
  resorts: []
};

// Helper function to add pass type to each resort
function addResorts(resorts, passType) {
  resorts.forEach(resort => {
    flattenedData.resorts.push({
      ...resort,
      pass: passType
    });
  });
}

// Add all IKON resorts
if (data.ikon_pass_resorts_north_america) {
  addResorts(data.ikon_pass_resorts_north_america.united_states, 'IKON');
  addResorts(data.ikon_pass_resorts_north_america.canada, 'IKON');
}

// Add all Epic resorts
if (data.epic_pass_resorts_north_america) {
  addResorts(data.epic_pass_resorts_north_america.united_states, 'EPIC');
  addResorts(data.epic_pass_resorts_north_america.canada, 'EPIC');
}

// Write the flattened data
fs.writeFileSync(outputPath, JSON.stringify(flattenedData, null, 2), 'utf-8');

console.log(`✓ Created flattened structure with ${flattenedData.resorts.length} resorts`);
console.log(`✓ Output file: ${outputPath}`);
