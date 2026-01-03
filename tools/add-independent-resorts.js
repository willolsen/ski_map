import { geocodeAddress } from './geocoder.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get API key from environment variable or command line argument
const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.argv[2];

if (!apiKey) {
  console.error('Error: Google Maps API key is required');
  console.error('Usage: node add-independent-resorts.js YOUR_API_KEY');
  console.error('Or set GOOGLE_MAPS_API_KEY environment variable');
  process.exit(1);
}

// Independent resorts to add (excluding those already in IKON/EPIC passes)
const independentResorts = [
  {
    name: "Loveland Ski Area",
    address: "Exit 216 Interstate 70, Georgetown, CO 80435",
    city: "Georgetown",
    country: "United States",
    region: "Colorado",
    id: "loveland-ski-area"
  },
  {
    name: "Monarch Mountain",
    address: "23715 US-50, Salida, CO 81201",
    city: "Salida",
    country: "United States",
    region: "Colorado",
    id: "monarch-mountain"
  },
  {
    name: "Wolf Creek Ski Area",
    address: "Wolf Creek Pass Hwy 160, Pagosa Springs, CO 81147",
    city: "Pagosa Springs",
    country: "United States",
    region: "Colorado",
    id: "wolf-creek-ski-area"
  },
  {
    name: "Ski Cooper",
    address: "232 County Rd 29, Leadville, CO 80461",
    city: "Leadville",
    country: "United States",
    region: "Colorado",
    id: "ski-cooper"
  },
  {
    name: "Powderhorn Mountain Resort",
    address: "48338 Powderhorn Rd, Mesa, CO 81643",
    city: "Mesa",
    country: "United States",
    region: "Colorado",
    id: "powderhorn-mountain-resort"
  },
  {
    name: "Bogus Basin",
    address: "2600 N Bogus Basin Road, Boise, ID 83702",
    city: "Boise",
    country: "United States",
    region: "Idaho",
    id: "bogus-basin"
  },
  {
    name: "Brundage Mountain",
    address: "3890 Goose Lake Rd, McCall, ID 83638",
    city: "McCall",
    country: "United States",
    region: "Idaho",
    id: "brundage-mountain"
  },
  {
    name: "Magic Mountain",
    address: "Rock Creek Road, Hansen, ID 83334",
    city: "Hansen",
    country: "United States",
    region: "Idaho",
    id: "magic-mountain"
  },
  {
    name: "Lookout Pass",
    address: "I-90 Exit 0, Mullan, ID 83846",
    city: "Mullan",
    country: "United States",
    region: "Idaho",
    id: "lookout-pass"
  },
  {
    name: "Whitefish Mountain Resort",
    address: "3889 Big Mountain Rd, Whitefish, MT 59937",
    city: "Whitefish",
    country: "United States",
    region: "Montana",
    id: "whitefish-mountain-resort"
  },
  {
    name: "Blacktail Mountain",
    address: "13990 Blacktail Rd, Lakeside, MT 59922",
    city: "Lakeside",
    country: "United States",
    region: "Montana",
    id: "blacktail-mountain"
  },
  {
    name: "Lost Trail Powder Mountain",
    address: "Top of Lost Trail Pass, Sula, MT 59871",
    city: "Sula",
    country: "United States",
    region: "Montana",
    id: "lost-trail-powder-mountain"
  },
  {
    name: "Discovery Ski Area",
    address: "180 Discovery Basin Rd, Anaconda, MT 59711",
    city: "Anaconda",
    country: "United States",
    region: "Montana",
    id: "discovery-ski-area"
  },
  {
    name: "Showdown Montana",
    address: "2850 US HWY 89 South, Neihart, MT 59465",
    city: "Neihart",
    country: "United States",
    region: "Montana",
    id: "showdown-montana"
  },
  {
    name: "Maverick Mountain",
    address: "1600 Maverick Mountain Road, Polaris, MT 59746",
    city: "Polaris",
    country: "United States",
    region: "Montana",
    id: "maverick-mountain"
  },
  {
    name: "Turner Mountain",
    address: "Pipe Creek Rd, Libby, MT 59923",
    city: "Libby",
    country: "United States",
    region: "Montana",
    id: "turner-mountain"
  },
  {
    name: "Diamond Peak",
    address: "1210 Ski Way, Incline Village, NV 89451",
    city: "Incline Village",
    country: "United States",
    region: "Nevada",
    id: "diamond-peak"
  },
  {
    name: "Mt. Baker",
    address: "10091 Mt. Baker Highway, Glacier, WA 98244",
    city: "Glacier",
    country: "United States",
    region: "Washington",
    id: "mt-baker"
  },
  {
    name: "White Pass",
    address: "48935 US Highway 12, Naches, WA 98937",
    city: "Naches",
    country: "United States",
    region: "Washington",
    id: "white-pass"
  },
  {
    name: "49 Degrees North",
    address: "3311 Flowery Trail Rd, Chewelah, WA 99109",
    city: "Chewelah",
    country: "United States",
    region: "Washington",
    id: "49-degrees-north"
  },
  {
    name: "Hurricane Ridge",
    address: "Hurricane Ridge Rd, Port Angeles, WA 98362",
    city: "Port Angeles",
    country: "United States",
    region: "Washington",
    id: "hurricane-ridge"
  },
  {
    name: "Mission Ridge",
    address: "7500 Mission Ridge Rd, Wenatchee, WA 98801",
    city: "Wenatchee",
    country: "United States",
    region: "Washington",
    id: "mission-ridge"
  },
  {
    name: "Ski Bluewood",
    address: "2000 N Touchet Rd, Dayton, WA 99328",
    city: "Dayton",
    country: "United States",
    region: "Washington",
    id: "ski-bluewood"
  },
  {
    name: "Leavenworth Ski Hill",
    address: "10701 Ski Hill Dr, Leavenworth, WA 98826",
    city: "Leavenworth",
    country: "United States",
    region: "Washington",
    id: "leavenworth-ski-hill"
  },
  {
    name: "Loup Loup Ski Bowl",
    address: "97 FS 4200 100 Road, Okanogan, WA 98840",
    city: "Okanogan",
    country: "United States",
    region: "Washington",
    id: "loup-loup-ski-bowl"
  },
  {
    name: "Mt. Spokane",
    address: "29500 N Mt Spokane Park Dr, Mead, WA 99021",
    city: "Mead",
    country: "United States",
    region: "Washington",
    id: "mt-spokane"
  },
  {
    name: "Mt. Hood Meadows",
    address: "14040 Highway 35, Mount Hood, OR 97041",
    city: "Mount Hood",
    country: "United States",
    region: "Oregon",
    id: "mt-hood-meadows"
  },
  {
    name: "Timberline Lodge",
    address: "27500 E Timberline Rd, Government Camp, OR 97028",
    city: "Government Camp",
    country: "United States",
    region: "Oregon",
    id: "timberline-lodge"
  },
  {
    name: "Mt. Hood Ski Bowl",
    address: "87000 E Highway 26, Government Camp, OR 97028",
    city: "Government Camp",
    country: "United States",
    region: "Oregon",
    id: "mt-hood-ski-bowl"
  },
  {
    name: "Hoodoo",
    address: "27400 Big Lake Rd, Sisters, OR 97759",
    city: "Sisters",
    country: "United States",
    region: "Oregon",
    id: "hoodoo"
  },
  {
    name: "Cooper Spur",
    address: "10755 Cooper Spur Rd, Mount Hood, OR 97041",
    city: "Mount Hood",
    country: "United States",
    region: "Oregon",
    id: "cooper-spur"
  },
  {
    name: "Mt. Ashland",
    address: "11 Mt Ashland Ski Rd, Ashland, OR 97520",
    city: "Ashland",
    country: "United States",
    region: "Oregon",
    id: "mt-ashland"
  },
  {
    name: "Whitewater Mountain Resort",
    address: "Whitewater Road, Nelson, BC V1L 5P7",
    city: "Nelson",
    country: "Canada",
    region: "British Columbia",
    id: "whitewater-mountain-resort"
  },
  {
    name: "Big White Ski Resort",
    address: "5315 Big White Road, Kelowna, BC V1X 4K5",
    city: "Kelowna",
    country: "Canada",
    region: "British Columbia",
    id: "big-white-ski-resort"
  },
  {
    name: "Castle Mountain Resort",
    address: "End of Highway 774, Pincher Creek, AB T0K 1W0",
    city: "Pincher Creek",
    country: "Canada",
    region: "Alberta",
    id: "castle-mountain-resort"
  }
];

async function addIndependentResorts() {
  console.log('Reading ski resorts data...\n');

  // Read the existing JSON file
  const inputFile = path.join(__dirname, '..', 'ski_resorts.json');
  const data = await fs.readFile(inputFile, 'utf-8');
  const resortsData = JSON.parse(data);

  // Get existing resort IDs to avoid duplicates
  const existingIds = new Set(resortsData.resorts.map(r => r.id));

  console.log(`Found ${resortsData.resorts.length} existing resorts`);
  console.log(`Adding ${independentResorts.length} independent resorts...\n`);
  console.log('='.repeat(60));

  let addedCount = 0;

  for (const resort of independentResorts) {
    // Skip if already exists
    if (existingIds.has(resort.id)) {
      console.log(`\nSkipping: ${resort.name} (already exists)`);
      continue;
    }

    try {
      console.log(`\nGeocoding: ${resort.name}`);
      console.log(`  Address: ${resort.address}`);

      // Geocode the address
      const searchAddress = resort.country === 'United States'
        ? resort.address + ', USA'
        : resort.address + ', Canada';
      const result = await geocodeAddress(searchAddress, apiKey);

      // Add to resorts array with pass type "INDEPENDENT"
      resortsData.resorts.push({
        name: resort.name,
        address: resort.address,
        city: resort.city,
        country: resort.country,
        region: resort.region,
        id: resort.id,
        latitude: result.lat,
        longitude: result.lng,
        formatted_address: result.formattedAddress,
        pass: "INDEPENDENT"
      });

      console.log(`  ✓ Latitude:  ${result.lat}`);
      console.log(`  ✓ Longitude: ${result.lng}`);
      addedCount++;

      // Add delay to avoid hitting API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      // Add without coordinates if geocoding fails
      resortsData.resorts.push({
        name: resort.name,
        address: resort.address,
        city: resort.city,
        country: resort.country,
        region: resort.region,
        id: resort.id,
        pass: "INDEPENDENT"
      });
      console.log(`  ⚠ Added without coordinates`);
      addedCount++;
    }
  }

  // Update the last_updated timestamp
  resortsData.last_updated = new Date().toISOString().split('T')[0];

  // Write the updated data back to file
  await fs.writeFile(inputFile, JSON.stringify(resortsData, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log(`✓ Successfully added ${addedCount} independent resorts`);
  console.log(`✓ Total resorts: ${resortsData.resorts.length}`);
  console.log(`✓ Updated ${inputFile}`);
}

// Run the script
addIndependentResorts().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
