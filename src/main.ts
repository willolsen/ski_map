import './style.css';
import { skiResorts } from './resorts';
import { SkiResort, PrecipitationData, PowderScoreData, TripStop, RouteSegment } from './types';
import precipitationData from '../snowfall_forecast.json';
import powderScoreData from '../powder-scores.json';
import mapConfig from '../map-config.json';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Feature toggle for weather functionality
const ENABLE_WEATHER_FEATURES = false;

class SkiMapApp {
  private map!: google.maps.Map;
  private markers: Map<string, google.maps.Marker> = new Map();
  private directionsService!: google.maps.DirectionsService;
  private geocoder!: google.maps.Geocoder;
  private snowOverlays: google.maps.Marker[] = [];
  private rainOverlays: google.maps.Marker[] = [];
  private precipitationData: PrecipitationData = precipitationData as PrecipitationData;
  private powderScoreData: PowderScoreData = powderScoreData as PowderScoreData;
  private showPrecipitation: boolean = true;
  private startDay: number = 0; // First day (today)
  private endDay: number = 6;   // 7 days total (0-6)
  // Trip planner properties
  private tripStops: TripStop[] = [];
  private tripStopMarkers: Map<string, google.maps.Marker> = new Map();
  private routeSegments: RouteSegment[] = [];
  private tripDirectionsRenderer: google.maps.DirectionsRenderer | null = null;
  private mapClickListener: google.maps.MapsEventListener | null = null;
  private isAddingCustomStop: boolean = false;
  private customStopCounter: number = 0;
  private powderTableVisible: boolean = false;

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

    // Initialize map centered on western North America ski areas with darkened terrain
    this.map = new google.maps.Map(mapElement, {
      center: mapConfig.initialView.center,
      zoom: 5,
      mapTypeId: 'terrain',
      mapTypeControl: true,
      streetViewControl: false,
      styles: [
        {
          elementType: 'geometry',
          stylers: [
            { lightness: -60 },
            { saturation: -40 }
          ]
        },
        {
          elementType: 'labels.text.fill',
          stylers: [
            { lightness: 20 }
          ]
        },
        {
          elementType: 'labels.text.stroke',
          stylers: [
            { lightness: -80 }
          ]
        },
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
        {
          featureType: 'road.highway',
          elementType: 'labels.icon',
          stylers: [{ visibility: 'off' }],
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
    this.geocoder = new google.maps.Geocoder();
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

    // Check if resort is already in trip
    const isInTrip = this.tripStops.some(stop =>
      stop.type === 'resort' && stop.resort?.id === resort.id
    );

    const buttonClass = isInTrip ? 'remove-from-trip-btn' : 'add-stop-btn';
    const buttonText = isInTrip ? 'Remove from Trip' : 'Add to Trip';

    return `
      <div class="info-window">
        <h3>${resort.name}</h3>
        <p>${resort.region}, ${resort.country}</p>
        ${resort.accessType ? `<p style="font-size: 0.9em; color: #666;">Access: ${resort.accessType}</p>` : ''}
        ${precipInfo}
        <span class="pass-badge">${resort.pass} PASS</span>
        <button class="${buttonClass}" data-resort-id="${resort.id}">
          ${buttonText}
        </button>
      </div>
    `;
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

  // ============================================================================
  // POWDER SCORE TABLE METHODS
  // ============================================================================

  private togglePowderTable() {
    this.powderTableVisible = !this.powderTableVisible;
    const overlay = document.getElementById('powderTableOverlay');
    if (overlay) {
      if (this.powderTableVisible) {
        overlay.classList.remove('hidden');
        this.renderPowderTable();
      } else {
        overlay.classList.add('hidden');
      }
    }
  }

  private renderPowderTable() {
    const table = document.getElementById('powderScoreTable');
    if (!table) return;

    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    // Clear existing content except first header cell
    while (thead.children.length > 1) {
      thead.removeChild(thead.lastChild!);
    }
    tbody.innerHTML = '';

    // Get all dates from first resort (they should all have the same dates)
    if (this.powderScoreData.resorts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="100" style="text-align: center; padding: 2rem;">No powder score data available</td></tr>';
      return;
    }

    const dates = this.powderScoreData.resorts[0].daily_forecast.map(day => day.date);
    const today = this.powderScoreData.resorts[0].daily_forecast.find(day => day.is_today)?.date;

    // Add date headers
    dates.forEach(date => {
      const th = document.createElement('th');
      const dateObj = new Date(date);
      const isToday = date === today;

      th.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <span style="font-size: 0.75rem; color: #6b7280;">${dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</span>
          <span style="font-weight: 600;">${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          ${isToday ? '<span style="font-size: 0.7rem; color: #667eea;">TODAY</span>' : ''}
        </div>
      `;
      if (isToday) {
        th.classList.add('today-column');
      }
      thead.appendChild(th);
    });

    // Sort resorts alphabetically by name
    const sortedResorts = [...this.powderScoreData.resorts].sort((a, b) =>
      a.resort_info.name.localeCompare(b.resort_info.name)
    );

    // Add resort rows
    sortedResorts.forEach(resort => {
      const tr = document.createElement('tr');

      // Resort name cell
      const resortCell = document.createElement('td');
      resortCell.className = 'resort-cell';
      resortCell.innerHTML = `
        <div>
          <div style="font-weight: 600;">${resort.resort_info.name}</div>
          <div style="font-size: 0.75rem; color: #6b7280;">${resort.resort_info.region}</div>
        </div>
      `;
      tr.appendChild(resortCell);

      // Score cells
      resort.daily_forecast.forEach(day => {
        const td = document.createElement('td');
        const score = day.powder_score.total_score;

        td.className = 'score-cell';
        if (score >= 20) {
          td.classList.add('score-excellent');
        } else if (score >= 10) {
          td.classList.add('score-good');
        } else if (score >= 5) {
          td.classList.add('score-fair');
        } else {
          td.classList.add('score-poor');
        }

        if (day.is_today) {
          td.classList.add('today-column');
        }

        // Add tooltip with details
        const snow = day.precipitation.snow_inches.toFixed(1);
        const rain = day.precipitation.rain_inches;
        const temp = Math.round(day.temperature.avg_f);
        const accum = day.powder_score.accumulated_3day_inches.toFixed(1);

        td.title = `Score: ${score}\nSnow: ${snow}"\nTemp: ${temp}°F\n3-day: ${accum}"${rain > 0 ? `\nRain: ${rain.toFixed(1)}"` : ''}`;
        td.textContent = score.toString();

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // ============================================================================
  // TRIP PLANNER METHODS
  // ============================================================================

  private generateStopId(): string {
    return `stop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addResortStop(resortId: string) {
    const resort = skiResorts.find(r => r.id === resortId);
    if (!resort) return;

    const existingStop = this.tripStops.find(
      stop => stop.type === 'resort' && stop.resort?.id === resortId
    );

    if (existingStop) {
      this.removeStop(existingStop.id);
      return;
    }

    const stop: TripStop = {
      id: this.generateStopId(),
      order: this.tripStops.length + 1,
      location: new google.maps.LatLng(resort.location.lat, resort.location.lng),
      type: 'resort',
      resort: resort
    };

    this.tripStops.push(stop);
    this.createStopMarker(stop);
    this.updateTripPanel();
    this.calculateTripRoute();
    this.showToast(`${resort.name} added to trip`);
  }

  private enableCustomStopMode() {
    if (this.isAddingCustomStop) {
      this.disableCustomStopMode();
      return;
    }

    this.isAddingCustomStop = true;
    const mapDiv = document.getElementById('map');
    if (mapDiv) {
      mapDiv.classList.add('adding-stop');
    }

    const button = document.getElementById('addCustomStop');
    if (button) {
      button.textContent = 'Cancel';
      button.style.background = '#ef4444';
    }

    this.showToast('Click on map to add a stop');

    this.mapClickListener = this.map.addListener('click', async (event: google.maps.MapMouseEvent) => {
      if (event.latLng && this.isAddingCustomStop) {
        await this.addCustomStop(event.latLng);
        this.disableCustomStopMode();
      }
    });
  }

  private disableCustomStopMode() {
    this.isAddingCustomStop = false;

    const mapDiv = document.getElementById('map');
    if (mapDiv) {
      mapDiv.classList.remove('adding-stop');
    }

    const button = document.getElementById('addCustomStop');
    if (button) {
      button.textContent = 'Add Custom Stop';
      button.style.background = '';
    }

    if (this.mapClickListener) {
      google.maps.event.removeListener(this.mapClickListener);
      this.mapClickListener = null;
    }
  }

  private async addCustomStop(location: google.maps.LatLng) {
    this.customStopCounter++;

    // Show loading toast
    this.showToast('Getting location info...');

    // Try to get a meaningful name from reverse geocoding
    let customName = `Custom Stop ${this.customStopCounter}`;

    try {
      const result = await this.geocoder.geocode({ location: location });

      if (result.results && result.results.length > 0) {
        // Try to find a good label from the results
        const firstResult = result.results[0];

        // Look for a place name, street address, or locality
        const placeResult = result.results.find(r =>
          r.types.includes('establishment') ||
          r.types.includes('point_of_interest') ||
          r.types.includes('street_address')
        );

        if (placeResult && placeResult.formatted_address) {
          // Use formatted address but shorten it
          const parts = placeResult.formatted_address.split(',');
          customName = parts.slice(0, 2).join(','); // Use first 2 parts (e.g., "Street, City")
        } else if (firstResult.formatted_address) {
          // Fall back to first result
          const parts = firstResult.formatted_address.split(',');
          customName = parts.slice(0, 2).join(',');
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      // Fall back to generic name if geocoding fails
    }

    const stop: TripStop = {
      id: this.generateStopId(),
      order: this.tripStops.length + 1,
      location: location,
      type: 'custom',
      customName: customName
    };

    this.tripStops.push(stop);
    this.createStopMarker(stop);
    this.updateTripPanel();
    this.calculateTripRoute();
    this.showToast(`${customName} added to trip`);
  }

  private createStopMarker(stop: TripStop) {
    if (stop.type === 'resort' && stop.resort) {
      const marker = this.markers.get(stop.resort.id);
      if (marker) {
        marker.setLabel({
          text: stop.order.toString(),
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 'bold',
        });
        marker.setZIndex(300);
        stop.marker = marker;
      }
    } else {
      const marker = new google.maps.Marker({
        position: stop.location,
        map: this.map,
        title: stop.customName,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#f97316',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        label: {
          text: stop.order.toString(),
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 'bold',
        },
        draggable: true,
        zIndex: 300
      });

      marker.addListener('dragend', () => {
        const newPos = marker.getPosition();
        if (newPos) {
          stop.location = newPos;
          this.calculateTripRoute();
          this.showToast('Stop location updated');
        }
      });

      this.tripStopMarkers.set(stop.id, marker);
      stop.marker = marker;
    }
  }

  private removeStop(stopId: string) {
    const stopIndex = this.tripStops.findIndex(s => s.id === stopId);
    if (stopIndex === -1) return;

    const stop = this.tripStops[stopIndex];

    if (stop.type === 'resort' && stop.resort) {
      const marker = this.markers.get(stop.resort.id);
      if (marker) {
        marker.setLabel(null);
        marker.setZIndex(100);
      }
    } else {
      const marker = this.tripStopMarkers.get(stopId);
      if (marker) {
        marker.setMap(null);
        this.tripStopMarkers.delete(stopId);
      }
    }

    this.tripStops.splice(stopIndex, 1);

    this.tripStops.forEach((s, idx) => {
      s.order = idx + 1;
      if (s.marker) {
        s.marker.setLabel({
          text: s.order.toString(),
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 'bold',
        });
      }
    });

    this.updateTripPanel();
    this.calculateTripRoute();

    const stopName = stop.type === 'resort' ? stop.resort?.name : stop.customName;
    this.showToast(`${stopName} removed from trip`);
  }

  private clearAllStops() {
    if (this.tripStops.length === 0) return;

    if (!confirm(`Clear all ${this.tripStops.length} stops from your trip?`)) {
      return;
    }

    this.tripStops.forEach(stop => {
      if (stop.type === 'resort' && stop.resort) {
        const marker = this.markers.get(stop.resort.id);
        if (marker) {
          marker.setLabel(null);
          marker.setZIndex(100);
        }
      } else {
        const marker = this.tripStopMarkers.get(stop.id);
        if (marker) {
          marker.setMap(null);
        }
      }
    });

    this.tripStopMarkers.clear();
    this.tripStops = [];
    this.routeSegments = [];
    this.customStopCounter = 0;

    if (this.tripDirectionsRenderer) {
      this.tripDirectionsRenderer.setMap(null);
      this.tripDirectionsRenderer = null;
    }

    this.updateTripPanel();
    this.showToast('Trip cleared');
  }

  private async calculateTripRoute() {
    if (this.tripStops.length < 2) {
      if (this.tripDirectionsRenderer) {
        this.tripDirectionsRenderer.setMap(null);
        this.tripDirectionsRenderer = null;
      }
      this.routeSegments = [];
      this.updateTripPanel();
      return;
    }

    try {
      const origin = this.tripStops[0].location;
      const destination = this.tripStops[this.tripStops.length - 1].location;
      const waypoints = this.tripStops.slice(1, -1).map(stop => ({
        location: stop.location,
        stopover: true
      }));

      const result = await this.directionsService.route({
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false
      });

      if (!this.tripDirectionsRenderer) {
        this.tripDirectionsRenderer = new google.maps.DirectionsRenderer({
          map: this.map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#667eea',
            strokeWeight: 5,
            strokeOpacity: 0.8,
          },
        });
      }

      this.tripDirectionsRenderer.setDirections(result);

      this.routeSegments = [];
      const route = result.routes[0];

      route.legs.forEach((leg, index) => {
        this.routeSegments.push({
          fromStopId: this.tripStops[index].id,
          toStopId: this.tripStops[index + 1].id,
          distance: leg.distance?.text || 'Unknown',
          distanceValue: leg.distance?.value || 0,
          duration: leg.duration?.text || 'Unknown',
          durationValue: leg.duration?.value || 0
        });
      });

      this.updateTripPanel();

    } catch (error) {
      console.error('Error calculating trip route:', error);
      this.showToast('Error calculating route', 'error');
    }
  }

  private updateTripPanel() {
    const panel = document.getElementById('tripPanel');
    const emptyState = document.getElementById('emptyState');
    const stopsList = document.getElementById('stopsList');
    const summary = document.getElementById('tripSummary');

    if (!panel || !emptyState || !stopsList || !summary) return;

    if (this.tripStops.length === 0) {
      panel.classList.add('hidden');
      emptyState.classList.remove('hidden');
      stopsList.classList.add('hidden');
      summary.classList.add('hidden');
    } else {
      panel.classList.remove('hidden');
      emptyState.classList.add('hidden');
      stopsList.classList.remove('hidden');

      let stopsHTML = '';

      this.tripStops.forEach((stop, index) => {
        const stopName = stop.type === 'resort' ? stop.resort!.name : stop.customName!;
        const stopLocation = stop.type === 'resort'
          ? `${stop.resort!.region}, ${stop.resort!.country}`
          : 'Custom Location';

        stopsHTML += `
          <div class="stop-card" data-stop-id="${stop.id}">
            <div class="stop-number">${stop.order}</div>
            <div class="stop-info">
              <div class="stop-name">${stopName}</div>
              <div class="stop-location">${stopLocation}</div>
            </div>
            <button class="remove-stop-btn" data-stop-id="${stop.id}" title="Remove stop">×</button>
          </div>
        `;

        if (index < this.tripStops.length - 1 && this.routeSegments[index]) {
          const segment = this.routeSegments[index];
          stopsHTML += `
            <div class="route-segment">
              <div class="route-line"></div>
              <div class="route-stats">
                <span class="route-distance">🚗 ${segment.distance}</span>
                <span class="route-duration">⏱️ ${segment.duration}</span>
              </div>
            </div>
          `;
        }
      });

      stopsList.innerHTML = stopsHTML;

      if (this.routeSegments.length > 0) {
        summary.classList.remove('hidden');

        const totalDistanceValue = this.routeSegments.reduce((sum, seg) => sum + seg.distanceValue, 0);
        const totalDurationValue = this.routeSegments.reduce((sum, seg) => sum + seg.durationValue, 0);

        const totalDistanceMiles = (totalDistanceValue * 0.000621371).toFixed(1);
        const totalHours = Math.floor(totalDurationValue / 3600);
        const totalMinutes = Math.round((totalDurationValue % 3600) / 60);

        const distanceEl = document.getElementById('totalDistance');
        const durationEl = document.getElementById('totalDuration');
        const stopsEl = document.getElementById('totalStops');

        if (distanceEl) distanceEl.textContent = `${totalDistanceMiles} miles`;
        if (durationEl) durationEl.textContent = `${totalHours}h ${totalMinutes}m`;
        if (stopsEl) stopsEl.textContent = `${this.tripStops.length} stops`;
      } else {
        summary.classList.add('hidden');
      }
    }
  }

  private showToast(message: string, type: 'success' | 'error' = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast';
    if (type === 'error') toast.classList.add('error');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }

  private setupEventListeners() {
    // Add Custom Stop button
    const addStopButton = document.getElementById('addCustomStop');
    if (addStopButton) {
      addStopButton.addEventListener('click', () => {
        this.enableCustomStopMode();
      });
    }

    // Clear Trip button
    const clearTripButton = document.getElementById('clearTrip');
    if (clearTripButton) {
      clearTripButton.addEventListener('click', () => {
        this.clearAllStops();
      });
    }

    // Toggle precipitation button
    const toggleButton = document.getElementById('togglePrecipitation');
    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        this.showPrecipitation = !this.showPrecipitation;
        this.togglePrecipitationOverlay(this.showPrecipitation);
        toggleButton.textContent = this.showPrecipitation ? 'Hide Weather' : 'Show Weather';
      });
    }

    // Powder Score Table buttons
    const togglePowderTableButton = document.getElementById('togglePowderTable');
    if (togglePowderTableButton) {
      togglePowderTableButton.addEventListener('click', () => {
        this.togglePowderTable();
      });
    }

    const closePowderTableButton = document.getElementById('closePowderTable');
    if (closePowderTableButton) {
      closePowderTableButton.addEventListener('click', () => {
        this.togglePowderTable();
      });
    }

    // Close powder table when clicking outside the container
    const powderTableOverlay = document.getElementById('powderTableOverlay');
    if (powderTableOverlay) {
      powderTableOverlay.addEventListener('click', (e) => {
        if (e.target === powderTableOverlay) {
          this.togglePowderTable();
        }
      });
    }

    // Event delegation for info window buttons (dynamically added)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle "Add to Trip" / "Remove from Trip" buttons in info windows
      if (target.classList.contains('add-stop-btn')) {
        const resortId = target.getAttribute('data-resort-id');
        if (resortId) {
          this.addResortStop(resortId);
        }
      } else if (target.classList.contains('remove-from-trip-btn')) {
        const resortId = target.getAttribute('data-resort-id');
        if (resortId) {
          this.addResortStop(resortId); // Toggle behavior
        }
      }

      // Handle remove stop buttons in trip panel
      if (target.classList.contains('remove-stop-btn')) {
        const stopId = target.getAttribute('data-stop-id');
        if (stopId) {
          this.removeStop(stopId);
        }
      }
    });
  }
}

// Initialize the app
const app = new SkiMapApp();
app.init().catch((error) => {
  console.error('Failed to initialize app:', error);
  alert('Failed to load the application. Please check your Google Maps API key.');
});
