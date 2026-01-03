import './style.css';
import { skiResorts } from './resorts';
import { SkiResort, RouteInfo, PrecipitationData } from './types';
import precipitationData from '../snowfall_forecast.json';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

class SkiMapApp {
  private map!: google.maps.Map;
  private markers: Map<string, google.maps.Marker> = new Map();
  private directionsService!: google.maps.DirectionsService;
  private directionsRenderers: google.maps.DirectionsRenderer[] = [];
  private selectedResorts: SkiResort[] = [];
  private routes: RouteInfo[] = [];
  private snowOverlays: google.maps.Marker[] = [];
  private rainOverlays: google.maps.Marker[] = [];
  private precipitationData: PrecipitationData = precipitationData as PrecipitationData;
  private showPrecipitation: boolean = true;
  private startDay: number = 0; // First day (today)
  private endDay: number = 6;   // 7 days total (0-6)

  async init() {
    await this.loadGoogleMapsAPI();
    this.initMap();
    this.initPrecipitationOverlay();
    this.initResortMarkers();
    this.initDateRangeSlider();
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
        zIndex: 100, // Keep markers on top
      });

      const infoWindow = new google.maps.InfoWindow({
        content: this.createInfoWindowContent(resort),
      });

      marker.addListener('click', () => {
        // Update info window content with current date range
        infoWindow.setContent(this.createInfoWindowContent(resort));
        infoWindow.open(this.map, marker);
        this.handleResortClick(resort);
      });

      this.markers.set(resort.id, marker);
    });
  }

  private createInfoWindowContent(resort: SkiResort): string {
    // Find precipitation data for this resort
    const precipResort = this.precipitationData.resorts.find(r => r.id === resort.id);

    let precipInfo = '';
    if (precipResort) {
      const selectedDays = precipResort.daily_forecasts.slice(this.startDay, this.endDay + 1);
      const totalSnow = selectedDays.reduce((sum, day) => sum + day.snow_inches, 0);
      const totalRain = selectedDays.reduce((sum, day) => sum + day.rain_inches, 0);
      const dayCount = this.endDay - this.startDay + 1;

      precipInfo = `
        <p style="font-size: 0.95em; margin: 8px 0;">
          <span style="color: #ffffff; background: #4169E1; padding: 2px 6px; border-radius: 3px; font-weight: 600;">❄️ ${totalSnow.toFixed(1)}"</span>
          <span style="color: #333; background: #87CEEB; padding: 2px 6px; border-radius: 3px; margin-left: 4px; font-weight: 600;">🌧️ ${totalRain.toFixed(1)}"</span>
        </p>
        <p style="font-size: 0.85em; color: #666;">${dayCount}-day forecast</p>
      `;
    }

    return `
      <div class="info-window">
        <h3>${resort.name}</h3>
        <p>${resort.region}, ${resort.country}</p>
        ${resort.accessType ? `<p style="font-size: 0.9em; color: #666;">Access: ${resort.accessType}</p>` : ''}
        ${precipInfo}
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

  private initPrecipitationOverlay() {
    this.updatePrecipitationOverlay();
  }

  private updatePrecipitationOverlay() {
    // Clear existing overlays
    this.snowOverlays.forEach(overlay => overlay.setMap(null));
    this.rainOverlays.forEach(overlay => overlay.setMap(null));
    this.snowOverlays = [];
    this.rainOverlays = [];

    // Calculate totals for each resort in selected date range
    const resortTotals = this.precipitationData.resorts.map(resort => {
      const selectedDays = resort.daily_forecasts.slice(this.startDay, this.endDay + 1);
      const totalSnow = selectedDays.reduce((sum, day) => sum + day.snow_inches, 0);
      const totalRain = selectedDays.reduce((sum, day) => sum + day.rain_inches, 0);
      return { resort, totalSnow, totalRain };
    });

    const maxSnow = Math.max(...resortTotals.map(r => r.totalSnow), 1);
    const maxRain = Math.max(...resortTotals.map(r => r.totalRain), 1);

    // Create snow and rain overlays
    resortTotals.forEach(({ resort, totalSnow, totalRain }) => {
      // Snow overlay (blue/white)
      if (totalSnow > 0.1) {
        const snowIntensity = Math.min(totalSnow / maxSnow, 1);
        let snowColor: string;
        if (snowIntensity < 0.25) {
          snowColor = '#4169E1'; // Royal blue
        } else if (snowIntensity < 0.5) {
          snowColor = '#00CED1'; // Dark turquoise
        } else if (snowIntensity < 0.75) {
          snowColor = '#87CEEB'; // Sky blue
        } else {
          snowColor = '#FFFFFF'; // White (powder!)
        }

        const snowScale = 18 + snowIntensity * 17; // 18-35 pixels

        const snowOverlay = new google.maps.Marker({
          position: { lat: resort.latitude, lng: resort.longitude },
          map: this.showPrecipitation ? this.map : null,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: snowScale,
            fillColor: snowColor,
            fillOpacity: 0.3,
            strokeColor: snowColor,
            strokeOpacity: 0.5,
            strokeWeight: 1.5,
          },
          clickable: false,
          zIndex: 2,
        });

        this.snowOverlays.push(snowOverlay);
      }

      // Rain overlay (cyan/blue-green, slightly offset)
      if (totalRain > 0.1) {
        const rainIntensity = Math.min(totalRain / maxRain, 1);
        const rainColor = rainIntensity < 0.5 ? '#B0E0E6' : '#5F9EA0'; // Powder blue to cadet blue
        const rainScale = 15 + rainIntensity * 12; // 15-27 pixels (smaller than snow)

        const rainOverlay = new google.maps.Marker({
          position: { lat: resort.latitude + 0.05, lng: resort.longitude + 0.05 }, // Slight offset
          map: this.showPrecipitation ? this.map : null,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: rainScale,
            fillColor: rainColor,
            fillOpacity: 0.25,
            strokeColor: rainColor,
            strokeOpacity: 0.4,
            strokeWeight: 1,
          },
          clickable: false,
          zIndex: 1,
        });

        this.rainOverlays.push(rainOverlay);
      }
    });

    console.log(`Precipitation overlay updated: ${this.snowOverlays.length} snow, ${this.rainOverlays.length} rain markers`);
  }

  private initDateRangeSlider() {
    const startSlider = document.getElementById('startDaySlider') as HTMLInputElement;
    const endSlider = document.getElementById('endDaySlider') as HTMLInputElement;
    const dateDisplay = document.getElementById('dateRangeDisplay');

    if (!startSlider || !endSlider || !dateDisplay) {
      console.error('Slider elements not found');
      return;
    }

    const maxDays = this.precipitationData.forecast_days - 1;
    startSlider.max = maxDays.toString();
    endSlider.max = maxDays.toString();
    startSlider.value = this.startDay.toString();
    endSlider.value = this.endDay.toString();

    const updateDisplay = () => {
      const startDate = new Date(this.precipitationData.generated_at);
      const endDate = new Date(this.precipitationData.generated_at);
      startDate.setDate(startDate.getDate() + this.startDay);
      endDate.setDate(endDate.getDate() + this.endDay);

      const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateDisplay.textContent = `${formatDate(startDate)} - ${formatDate(endDate)} (${this.endDay - this.startDay + 1} days)`;
    };

    startSlider.addEventListener('input', () => {
      let start = parseInt(startSlider.value);
      if (start > this.endDay) {
        start = this.endDay;
        startSlider.value = start.toString();
      }
      this.startDay = start;
      updateDisplay();
      this.updatePrecipitationOverlay();
    });

    endSlider.addEventListener('input', () => {
      let end = parseInt(endSlider.value);
      if (end < this.startDay) {
        end = this.startDay;
        endSlider.value = end.toString();
      }
      this.endDay = end;
      updateDisplay();
      this.updatePrecipitationOverlay();
    });

    updateDisplay();
  }

  private togglePrecipitationOverlay(show: boolean) {
    this.showPrecipitation = show;
    this.snowOverlays.forEach(overlay => overlay.setMap(show ? this.map : null));
    this.rainOverlays.forEach(overlay => overlay.setMap(show ? this.map : null));
  }

  private setupEventListeners() {
    const clearButton = document.getElementById('clearRoutes');
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        this.clearAllRoutes();
      });
    }

    const toggleButton = document.getElementById('togglePrecipitation');
    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        this.showPrecipitation = !this.showPrecipitation;
        this.togglePrecipitationOverlay(this.showPrecipitation);
        toggleButton.textContent = this.showPrecipitation ? 'Hide Weather' : 'Show Weather';
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
