import './style.css';
import { skiResorts } from './resorts';
import { SkiResort, RouteInfo, PrecipitationData } from './types';
import precipitationData from '../snowfall_forecast.json';
import mapConfig from '../map-config.json';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Feature toggle for weather functionality
const ENABLE_WEATHER_FEATURES = false;

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

  private getMarkerColor(pass: string): string {
    switch (pass) {
      case 'IKON':
        return '#667eea'; // Purple/Indigo
      case 'EPIC':
        return '#16a34a'; // Green
      case 'INDEPENDENT':
        return '#f97316'; // Orange
      default:
        return '#f59e0b'; // Amber
    }
  }

  async init() {
    await this.loadGoogleMapsAPI();
    this.initMap();
    if (ENABLE_WEATHER_FEATURES) {
      this.initPrecipitationOverlay();
      this.initDateRangeSlider();
    } else {
      // Hide weather UI when feature is disabled
      const weatherControls = document.querySelector('.weather-controls');
      if (weatherControls) {
        weatherControls.classList.add('hidden');
      }
    }
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

    // Initialize map centered on western North America ski areas with dark mode
    this.map = new google.maps.Map(mapElement, {
      center: mapConfig.initialView.center,
      zoom: 5,
      mapTypeId: 'roadmap',
      mapTypeControl: true,
      streetViewControl: false,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#212121' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
        {
          featureType: 'administrative.locality',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#d59563' }],
        },
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
        {
          featureType: 'poi.park',
          elementType: 'geometry',
          stylers: [{ color: '#263c3f' }],
        },
        {
          featureType: 'poi.park',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#6b9a76' }],
        },
        {
          featureType: 'road',
          elementType: 'geometry',
          stylers: [{ color: '#38414e' }],
        },
        {
          featureType: 'road',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#212a37' }],
        },
        {
          featureType: 'road',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#9ca5b3' }],
        },
        {
          featureType: 'road.highway',
          elementType: 'geometry',
          stylers: [{ color: '#746855' }],
        },
        {
          featureType: 'road.highway',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#1f2835' }],
        },
        {
          featureType: 'road.highway',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#f3d19c' }],
        },
        {
          featureType: 'transit',
          elementType: 'geometry',
          stylers: [{ color: '#2f3948' }],
        },
        {
          featureType: 'transit.station',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#d59563' }],
        },
        {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{ color: '#17263c' }],
        },
        {
          featureType: 'water',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#515c6d' }],
        },
        {
          featureType: 'water',
          elementType: 'labels.text.stroke',
          stylers: [{ color: '#17263c' }],
        },
      ],
    });

    // Fit map to western ski areas bounds
    const bounds = new google.maps.LatLngBounds(
      { lat: mapConfig.initialView.bounds.south, lng: mapConfig.initialView.bounds.west },
      { lat: mapConfig.initialView.bounds.north, lng: mapConfig.initialView.bounds.east }
    );
    this.map.fitBounds(bounds);

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
          fillColor: this.getMarkerColor(resort.pass),
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
    let precipInfo = '';

    // Only show precipitation data if weather features are enabled
    if (ENABLE_WEATHER_FEATURES) {
      const precipResort = this.precipitationData.resorts.find(r => r.id === resort.id);

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
          fillColor: this.getMarkerColor(resort.pass),
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
    const startDateInput = document.getElementById('startDate') as HTMLInputElement;
    const endDateInput = document.getElementById('endDate') as HTMLInputElement;

    if (!startDateInput || !endDateInput) {
      console.error('Date input elements not found');
      return;
    }

    // Calculate min and max dates from forecast data
    const baseDate = new Date(this.precipitationData.generated_at);
    const minDate = new Date(baseDate);
    const maxDate = new Date(baseDate);
    maxDate.setDate(maxDate.getDate() + this.precipitationData.forecast_days - 1);

    // Format dates as YYYY-MM-DD for input[type="date"]
    const formatDateForInput = (d: Date) => d.toISOString().split('T')[0];

    // Set min/max bounds on inputs
    startDateInput.min = formatDateForInput(minDate);
    startDateInput.max = formatDateForInput(maxDate);
    endDateInput.min = formatDateForInput(minDate);
    endDateInput.max = formatDateForInput(maxDate);

    // Set initial values
    const initialStartDate = new Date(baseDate);
    initialStartDate.setDate(initialStartDate.getDate() + this.startDay);
    const initialEndDate = new Date(baseDate);
    initialEndDate.setDate(initialEndDate.getDate() + this.endDay);

    startDateInput.value = formatDateForInput(initialStartDate);
    endDateInput.value = formatDateForInput(initialEndDate);

    // Convert date to day offset (0-15)
    const dateToOffset = (dateStr: string): number => {
      const selectedDate = new Date(dateStr + 'T00:00:00');
      const base = new Date(this.precipitationData.generated_at);
      base.setHours(0, 0, 0, 0);
      const diffTime = selectedDate.getTime() - base.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, Math.min(diffDays, this.precipitationData.forecast_days - 1));
    };

    startDateInput.addEventListener('change', () => {
      const startOffset = dateToOffset(startDateInput.value);

      // Ensure end date is not before start date
      if (this.endDay < startOffset) {
        this.endDay = startOffset;
        const newEndDate = new Date(baseDate);
        newEndDate.setDate(newEndDate.getDate() + this.endDay);
        endDateInput.value = formatDateForInput(newEndDate);
      }

      this.startDay = startOffset;
      this.updatePrecipitationOverlay();
    });

    endDateInput.addEventListener('change', () => {
      const endOffset = dateToOffset(endDateInput.value);

      // Ensure start date is not after end date
      if (this.startDay > endOffset) {
        this.startDay = endOffset;
        const newStartDate = new Date(baseDate);
        newStartDate.setDate(newStartDate.getDate() + this.startDay);
        startDateInput.value = formatDateForInput(newStartDate);
      }

      this.endDay = endOffset;
      this.updatePrecipitationOverlay();
    });
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
