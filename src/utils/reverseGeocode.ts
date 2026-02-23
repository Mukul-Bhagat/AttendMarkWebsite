import { appLogger } from '../shared/logger';
/**
 * Reverse Geocoding Utility using OpenStreetMap Nominatim API
 * 
 * Converts latitude and longitude coordinates to readable addresses.
 * 
 * IMPORTANT: Nominatim Usage Policy
 * - Maximum 1 request per second (rate limit)
 * - Must include a User-Agent header
 * - For production use, consider using your own Nominatim instance
 * 
 * @see https://nominatim.org/release-docs/develop/api/Reverse/
 */

export interface ReverseGeocodeResult {
  address: string;
  displayName: string;
  components: {
    houseNumber?: string;
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countryCode?: string;
  };
  raw?: any; // Full Nominatim response (optional)
}

export interface ReverseGeocodeOptions {
  /**
   * Custom User-Agent string (required by Nominatim)
   * Default: 'AttendanceMark-App/1.0'
   */
  userAgent?: string;
  /**
   * Language for address (ISO 639-1 code)
   * Default: 'en'
   */
  language?: string;
  /**
   * Include raw Nominatim response in result
   * Default: false
   */
  includeRaw?: boolean;
  /**
   * Maximum number of address details to include
   * Default: 18 (Nominatim default)
   */
  addressDetails?: number;
}

// Rate limiting state
let lastRequestTime: number = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second (Nominatim requirement)

/**
 * Rate limiter: Ensures minimum 1 second between requests
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Formats address components into a readable string
 */
function formatAddress(address: any): string {
  const parts: string[] = [];

  // Build address from most specific to least specific
  if (address.house_number) {
    parts.push(address.house_number);
  }
  
  if (address.road) {
    parts.push(address.road);
  }
  
  if (address.suburb || address.neighbourhood || address.village) {
    parts.push(address.suburb || address.neighbourhood || address.village);
  }
  
  if (address.city || address.town || address.municipality) {
    parts.push(address.city || address.town || address.municipality);
  }
  
  if (address.state || address.region) {
    parts.push(address.state || address.region);
  }
  
  if (address.postcode) {
    parts.push(address.postcode);
  }
  
  if (address.country) {
    parts.push(address.country);
  }

  return parts.join(', ') || 'Address not available';
}

/**
 * Extracts address components from Nominatim response
 */
function extractAddressComponents(address: any): ReverseGeocodeResult['components'] {
  return {
    houseNumber: address.house_number,
    road: address.road,
    suburb: address.suburb || address.neighbourhood || address.village,
    city: address.city || address.town || address.municipality,
    state: address.state || address.region,
    postcode: address.postcode,
    country: address.country,
    countryCode: address.country_code?.toUpperCase(),
  };
}

/**
 * Reverse geocode coordinates to address using OpenStreetMap Nominatim API
 * 
 * @param latitude - Latitude coordinate (-90 to 90)
 * @param longitude - Longitude coordinate (-180 to 180)
 * @param options - Optional configuration
 * @returns Promise with formatted address and components
 * @throws Error if coordinates are invalid or API request fails
 * 
 * @example
 * ```typescript
 * const result = await reverseGeocode(19.9975, 73.7898);
 * appLogger.info(result.address); // "College Road, Nashik, Maharashtra, 422005, India"
 * ```
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  options: ReverseGeocodeOptions = {}
): Promise<ReverseGeocodeResult> {
  // Validate coordinates
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Latitude and longitude must be numbers');
  }

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new Error('Latitude and longitude cannot be NaN');
  }

  if (latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }

  // Apply rate limiting
  await waitForRateLimit();

  // Configuration
  const userAgent = options.userAgent || 'AttendanceMark-App/1.0';
  const language = options.language || 'en';
  const addressDetails = options.addressDetails ?? 18;

  // Build Nominatim API URL
  const baseUrl = 'https://nominatim.openstreetmap.org/reverse';
  const params = new URLSearchParams({
    lat: latitude.toString(),
    lon: longitude.toString(),
    format: 'json',
    addressdetails: addressDetails.toString(),
    'accept-language': language,
    zoom: '18', // Higher zoom = more detailed address
  });

  const url = `${baseUrl}?${params.toString()}`;

  try {
    // Make request with required headers
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
        'Accept-Language': language,
      },
    });

    // Check for rate limiting (HTTP 429)
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
      
      appLogger.warn(`Nominatim rate limit hit. Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Retry once after waiting
      const retryResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/json',
          'Accept-Language': language,
        },
      });

      if (!retryResponse.ok) {
        throw new Error(`Nominatim API error: ${retryResponse.status} ${retryResponse.statusText}`);
      }

      const retryData = await retryResponse.json();
      return processNominatimResponse(retryData, options);
    }

    // Handle other HTTP errors
    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Check for error in response
    if (data.error) {
      throw new Error(`Nominatim API error: ${data.error}`);
    }

    return processNominatimResponse(data, options);
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to reach Nominatim API. Please check your internet connection.');
    }

    // Re-throw known errors
    if (error instanceof Error) {
      throw error;
    }

    // Handle unknown errors
    throw new Error(`Reverse geocoding failed: ${String(error)}`);
  }
}

/**
 * Process Nominatim API response into standardized format
 */
function processNominatimResponse(
  data: any,
  options: ReverseGeocodeOptions
): ReverseGeocodeResult {
  if (!data || !data.address) {
    throw new Error('Invalid response from Nominatim API: missing address data');
  }

  const address = data.address;
  const displayName = data.display_name || formatAddress(address);
  const formattedAddress = formatAddress(address);
  const components = extractAddressComponents(address);

  const result: ReverseGeocodeResult = {
    address: formattedAddress,
    displayName: displayName,
    components: components,
    raw: options.includeRaw ? data : undefined, // Include raw response if requested
  };

  return result;
}

/**
 * Batch reverse geocode multiple coordinates
 * Automatically handles rate limiting between requests
 * 
 * @param coordinates - Array of {latitude, longitude} objects
 * @param options - Optional configuration
 * @returns Promise with array of results (same order as input)
 * 
 * @example
 * ```typescript
 * const results = await batchReverseGeocode([
 *   { latitude: 19.9975, longitude: 73.7898 },
 *   { latitude: 18.5204, longitude: 73.8567 }
 * ]);
 * ```
 */
export async function batchReverseGeocode(
  coordinates: Array<{ latitude: number; longitude: number }>,
  options: ReverseGeocodeOptions = {}
): Promise<Array<ReverseGeocodeResult | Error>> {
  const results: Array<ReverseGeocodeResult | Error> = [];

  for (const coord of coordinates) {
    try {
      const result = await reverseGeocode(coord.latitude, coord.longitude, options);
      results.push(result);
    } catch (error) {
      results.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  return results;
}

