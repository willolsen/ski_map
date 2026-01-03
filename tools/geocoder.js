import https from 'https';

/**
 * Converts an address string to longitude and latitude coordinates
 * @param {string} address - The address to geocode
 * @param {string} apiKey - Your Google Maps API key
 * @returns {Promise<{lat: number, lng: number, formattedAddress: string}>}
 */
async function geocodeAddress(address, apiKey) {
  if (!address) {
    throw new Error('Address is required');
  }

  if (!apiKey) {
    throw new Error('Google Maps API key is required');
  }

  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (response.status === 'OK' && response.results.length > 0) {
            const result = response.results[0];
            const location = result.geometry.location;

            resolve({
              lat: location.lat,
              lng: location.lng,
              formattedAddress: result.formatted_address
            });
          } else if (response.status === 'ZERO_RESULTS') {
            reject(new Error('No results found for the given address'));
          } else if (response.status === 'REQUEST_DENIED') {
            reject(new Error(`API request denied: ${response.error_message || 'Check your API key'}`));
          } else {
            reject(new Error(`Geocoding failed with status: ${response.status}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`HTTP request failed: ${error.message}`));
    });
  });
}

export { geocodeAddress };
