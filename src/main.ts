import './style.css';
import { skiResorts } from './resorts';
import { SkiResort, RouteInfo, SnowfallData } from './types';
import snowfallData from '../snowfall_forecast.json';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

class SkiMapApp {
  private map!: google.maps.Map;
  private markers: Map<string, google.maps.Marker> = new Map();
  private directionsService!: google.maps.DirectionsService;
  private directionsRenderers: google.maps.DirectionsRenderer[] = [];
  private selectedResorts: SkiResort[] = [];
  private routes: RouteInfo[] = [];
  private snowfallOverlays: google.maps.Marker[] = [];
  private snowfallData: SnowfallData = snowfallData as SnowfallData;
  private showSnowfall: boolean = true;

  async init() {
    await this.loadGoogleMapsAPI();
    this.initMap();
    this.initSnowfallOverlay();
    this.initResortMarkers();
    this.setupEventListeners();
  }

  private loadGoogleMapsAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps API'));
      document.head.appendChild(script);
    });
  }

  private initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      throw new Error('Map element not found');
    }

    // Center the map on North America (roughly central US)
    this.map = new google.maps.Map(mapElement, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 5,
      mapTypeId: 'hybrid',
      mapTypeControl: true,
      streetViewControl: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    this.directionsService = new google.maps.DirectionsService();
  }

  private initResortMarkers() {
    skiResorts.forEach((resort) => {
      const marker = new google.maps.Marker({
        position: resort.location,
        map: this.map,
        title: resort.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: resort.pass === 'IKON' ? '#667eea' : '#f59e0b',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      const infoWindow = new google.maps.InfoWindow({
        content: this.createInfoWindowContent(resort),
      });

      marker.addListener('click', () => {
        infoWindow.open(this.map, marker);
        this.handleResortClick(resort);
      });

      this.markers.set(resort.id, marker);
    });
  }

  private createInfoWindowContent(resort: SkiResort): string {
    // Find snowfall data for this resort
    const snowfallResort = this.snowfallData.resorts.find(r => r.id === resort.id);
    const snowfallInfo = snowfallResort
      ? `<p style="font-size: 0.95em; color: #1e40af; font-weight: 600;">❄️ ${snowfallResort.snowfall_7day}" forecast (7 days)</p>`
      : '';

    return `
      <div class="info-window">
        <h3>${resort.name}</h3>
        <p>${resort.region}, ${resort.country}</p>
        ${resort.accessType ? `<p style="font-size: 0.9em; color: #666;">Access: ${resort.accessType}</p>` : ''}
        ${snowfallInfo}
        <span class="pass-badge">${resort.pass} PASS</span>
      </div>
    `;
  }

  private handleResortClick(resort: SkiResort) {
    // Add to selection
    if (this.selectedResorts.length === 0) {
      this.selectedResorts.push(resort);
      this.highlightMarker(resort.id, true);
      this.updateRouteInfo('Select another resort to calculate route');
    } else if (this.selectedResorts.length === 1) {
      if (this.selectedResorts[0].id === resort.id) {
        // Clicked same resort, deselect
        this.selectedResorts = [];
        this.highlightMarker(resort.id, false);
        this.updateRouteInfo('');
      } else {
        // Second resort selected, calculate route
        this.selectedResorts.push(resort);
        this.highlightMarker(resort.id, true);
        this.calculateAndDisplayRoute(this.selectedResorts[0], this.selectedResorts[1]);
      }
    } else {
      // Reset selection
      this.clearSelection();
      this.selectedResorts.push(resort);
      this.highlightMarker(resort.id, true);
      this.updateRouteInfo('Select another resort to calculate route');
    }
  }

  private highlightMarker(resortId: string, highlight: boolean) {
    const marker = this.markers.get(resortId);
    if (marker) {
      const resort = skiResorts.find((r) => r.id === resortId);
      if (resort) {
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: highlight ? 12 : 8,
          fillColor: resort.pass === 'IKON' ? '#667eea' : '#f59e0b',
          fillOpacity: 1,
          strokeColor: highlight ? '#fbbf24' : '#ffffff',
          strokeWeight: highlight ? 3 : 2,
        });
      }
    }
  }

  private async calculateAndDisplayRoute(origin: SkiResort, destination: SkiResort) {
    this.updateRouteInfo('Calculating route...');

    try {
      const result = await this.directionsService.route({
        origin: origin.location,
        destination: destination.location,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      const renderer = new google.maps.DirectionsRenderer({
        map: this.map,
        directions: result,
        suppressMarkers: true, // We already have our custom markers
        polylineOptions: {
          strokeColor: '#8b5cf6',
          strokeWeight: 4,
          strokeOpacity: 0.7,
        },
      });

      this.directionsRenderers.push(renderer);

      // Extract route information
      const route = result.routes[0];
      const leg = route.legs[0];

      const routeInfo: RouteInfo = {
        origin,
        destination,
        distance: leg.distance?.text || 'Unknown',
        duration: leg.duration?.text || 'Unknown',
      };

      this.routes.push(routeInfo);
      this.updateRouteInfo(
        `${origin.name} → ${destination.name}: ${routeInfo.distance} (${routeInfo.duration})`
      );

      // Reset selection after a short delay
      setTimeout(() => {
        this.clearSelection();
      }, 500);
    } catch (error) {
      console.error('Error calculating route:', error);
      this.updateRouteInfo('Error calculating route');
      this.clearSelection();
    }
  }

  private clearSelection() {
    this.selectedResorts.forEach((resort) => {
      this.highlightMarker(resort.id, false);
    });
    this.selectedResorts = [];
  }

  private updateRouteInfo(text: string) {
    const routeInfoElement = document.getElementById('routeInfo');
    if (routeInfoElement) {
      routeInfoElement.textContent = text;
    }
  }

  private initSnowfallOverlay() {
    // Get max snowfall for color scaling
    const maxSnowfall = Math.max(...this.snowfallData.resorts.map(r => r.snowfall_7day));

    // Create overlay markers for each resort (fixed pixel size)
    this.snowfallData.resorts.forEach((resort) => {
      const snowfall = resort.snowfall_7day;
      const intensity = Math.min(snowfall / maxSnowfall, 1); // 0 to 1 scale

      // Color scale: blue (low) -> cyan -> white (high)
      let fillColor: string;
      if (intensity < 0.25) {
        fillColor = '#4169E1'; // Royal blue
      } else if (intensity < 0.5) {
        fillColor = '#00CED1'; // Dark turquoise
      } else if (intensity < 0.75) {
        fillColor = '#87CEEB'; // Sky blue
      } else {
        fillColor = '#FFFFFF'; // White (powder!)
      }

      // Scale based on snowfall (18-35 pixels) - always larger than resort markers (8px)
      const scale = 18 + intensity * 17; // 18-35 pixel radius

      const overlay = new google.maps.Marker({
        position: { lat: resort.latitude, lng: resort.longitude },
        map: this.showSnowfall ? this.map : null,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: scale,
          fillColor: fillColor,
          fillOpacity: 0.3,
          strokeColor: fillColor,
          strokeOpacity: 0.5,
          strokeWeight: 1.5,
        },
        clickable: false,
        zIndex: 1, // Below resort markers
      });

      this.snowfallOverlays.push(overlay);
    });

    console.log(`Snowfall overlay initialized with ${this.snowfallOverlays.length} regions`);
    console.log(`Data generated: ${new Date(this.snowfallData.generated_at).toLocaleString()}`);
  }

  private toggleSnowfallOverlay(show: boolean) {
    this.showSnowfall = show;
    this.snowfallOverlays.forEach(overlay => {
      overlay.setMap(show ? this.map : null);
    });
  }

  private setupEventListeners() {
    const clearButton = document.getElementById('clearRoutes');
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        this.clearAllRoutes();
      });
    }

    const toggleSnowButton = document.getElementById('toggleSnow');
    if (toggleSnowButton) {
      toggleSnowButton.addEventListener('click', () => {
        this.showSnowfall = !this.showSnowfall;
        this.toggleSnowfallOverlay(this.showSnowfall);
        toggleSnowButton.textContent = this.showSnowfall ? 'Hide Snowfall' : 'Show Snowfall';
      });
    }
  }

  private clearAllRoutes() {
    // Clear all direction renderers
    this.directionsRenderers.forEach((renderer) => {
      renderer.setMap(null);
    });
    this.directionsRenderers = [];
    this.routes = [];
    this.clearSelection();
    this.updateRouteInfo('');
  }
}

// Initialize the app
const app = new SkiMapApp();
app.init().catch((error) => {
  console.error('Failed to initialize app:', error);
  alert('Failed to load the application. Please check your Google Maps API key.');
});
