# Ski Resort Road Trip Planner

A vanilla TypeScript web application for planning road trips to ski resorts in North America, with a focus on IKON Pass destinations.

## Features

- Interactive map showing IKON Pass ski resorts across North America
- Click any two resorts to calculate driving routes and times
- Visual route display with distance and duration information
- Clean, modern UI with gradient styling

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Maps API key (already configured in `.env`)

### Installation

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

### Running the App

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The production build will be in the `dist` directory.

## How to Use

1. **View Resorts**: All IKON Pass resorts are displayed as purple markers on the map
2. **Calculate Routes**:
   - Click on one resort to select it (marker will highlight)
   - Click on another resort to calculate the driving route
   - The route will appear as a purple line with distance and duration shown in the header
3. **Clear Routes**: Click the "Clear Routes" button to remove all displayed routes
4. **Explore**: Zoom, pan, and explore the map to find resorts across North America

## Project Structure

```
ski-map/
├── src/
│   ├── main.ts          # Main application logic
│   ├── types.ts         # TypeScript interfaces
│   ├── resorts.ts       # Ski resort data
│   └── style.css        # Styling
├── index.html           # HTML entry point
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── .env                 # Environment variables (Google Maps API key)
```

## Technology Stack

- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Google Maps API**: Maps, markers, and directions
- **Vanilla CSS**: No framework dependencies

## Current Resort Coverage

The app currently includes 19 IKON Pass resorts across:
- **Rocky Mountains**: Jackson Hole, Big Sky, Steamboat, Winter Park, Copper Mountain, Aspen Snowmass, Eldora, Deer Valley, Solitude
- **West Coast**: Mammoth Mountain, Palisades Tahoe
- **Pacific Northwest**: Crystal Mountain, Mt. Bachelor
- **Southwest**: Taos Ski Valley
- **Northeast**: Killington, Stratton, Sunday River
- **Canada**: Tremblant, Revelstoke

## Future Enhancements

- Add more ski resorts (Epic Pass, independent resorts)
- Save and load road trip routes
- Multi-stop trip planning
- Resort information (vertical drop, terrain, pass restrictions)
- Weather integration
- Season dates and lift ticket prices

## License

MIT
