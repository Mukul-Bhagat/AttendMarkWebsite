import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { getGoogleMapsApiKey, isGoogleMapsApiKeyConfigured, GOOGLE_MAPS_CONFIG } from '../utils/googleMapsConfig';
import { trackApiUsage } from '../utils/billingSafety';

import { appLogger } from '../shared/logger';
// Google Maps libraries - only Places API needed
// We use Places API geometry data, NOT Geocoding API
const libraries = GOOGLE_MAPS_CONFIG.libraries;

export interface PlaceCoordinates {
  latitude: number;
  longitude: number;
}

export interface PlaceData {
  placeId: string;
  name: string;
  formattedAddress: string;
  coordinates: PlaceCoordinates;
}

interface PlacesAutocompleteProps {
  /**
   * Google Maps API key
   * Should be set via environment variable: VITE_GOOGLE_MAPS_API_KEY
   */
  apiKey?: string;
  /**
   * Placeholder text for the input field
   */
  placeholder?: string;
  /**
   * Callback function called when a place is selected
   * @param placeData - Contains placeId, name, formattedAddress, and coordinates
   */
  onPlaceSelect?: (placeData: PlaceData) => void;
  /**
   * Initial value for the input field
   */
  initialValue?: string;
  /**
   * Whether the input is disabled
   */
  disabled?: boolean;
  /**
   * Additional CSS classes for the container
   */
  className?: string;
  /**
   * Restrict autocomplete to specific countries (ISO 3166-1 Alpha-2 country codes)
   * Example: ['us', 'ca'] for United States and Canada
   */
  countryRestrictions?: string[];
  /**
   * Whether to show coordinates in the UI
   */
  showCoordinates?: boolean;
  /**
   * Whether to log place data to console (for debugging)
   */
  enableLogging?: boolean;
}

const PlacesAutocomplete: React.FC<PlacesAutocompleteProps> = ({
  apiKey,
  placeholder = 'Search for a location...',
  onPlaceSelect,
  initialValue = '',
  disabled = false,
  className = '',
  countryRestrictions,
  showCoordinates = false,
  enableLogging = false,
}) => {
  // State
  const [inputValue, setInputValue] = useState<string>(initialValue);
  const [selectedPlace, setSelectedPlace] = useState<PlaceData | null>(null);
  const [coordinates, setCoordinates] = useState<PlaceCoordinates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Get API key from props or environment variable
  // PRODUCTION SAFETY: Validate API key before attempting to load Google Maps
  // Security: API key should NEVER be hardcoded - always use environment variables
  const mapsApiKey = useMemo(() => {
    const key = apiKey || getGoogleMapsApiKey();
    
    // Validate key format in production
    if (import.meta.env.PROD && key && !key.startsWith('AIza')) {
      appLogger.warn('[PRODUCTION] Google Maps API key format appears invalid');
    }
    
    return key;
  }, [apiKey]);

  // PRODUCTION SAFETY: Only load Google Maps if API key is configured
  // This prevents "NoApiKeys" error in production
  const isApiKeyValid = useMemo(() => {
    if (apiKey) {
      return apiKey.trim().length > 0 && apiKey.startsWith('AIza');
    }
    return isGoogleMapsApiKeyConfigured();
  }, [apiKey]);

  // Load Google Maps API dynamically
  // CRITICAL: Only call useJsApiLoader if API key is valid to prevent "NoApiKeys" error
  // Security: API key from environment variable, never hardcoded
  // Libraries: 'places' for Places Autocomplete (NOT Geocoding API)
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-places-autocomplete',
    googleMapsApiKey: isApiKeyValid ? mapsApiKey : '', // Only pass key if valid
    libraries, // Includes 'places' library for Places Autocomplete
    // Prevent loading if key is invalid
    ...(isApiKeyValid ? {} : { preventGoogleFontsLoading: true }),
  });

  // Track API usage for billing safety (client-side monitoring)
  useEffect(() => {
    if (isLoaded) {
      // Track Maps JavaScript API load
      trackApiUsage('mapsJavaScript');
    }
  }, [isLoaded]);

  // Initialize Autocomplete when API is loaded
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) {
      return;
    }

    try {
      // Create Autocomplete instance
      // Request geometry field to get coordinates from Places API (NOT Geocoding API)
      const autocompleteInstance = new google.maps.places.Autocomplete(inputRef.current, {
        fields: GOOGLE_MAPS_CONFIG.autocompleteFields,
        ...(countryRestrictions && countryRestrictions.length > 0 && {
          componentRestrictions: { country: countryRestrictions },
        }),
      });

      autocompleteRef.current = autocompleteInstance;

      // Add place_changed event listener
      autocompleteInstance.addListener('place_changed', handlePlaceChanged);

      // Cleanup function
      return () => {
        if (autocompleteInstance) {
          google.maps.event.clearInstanceListeners(autocompleteInstance);
        }
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize autocomplete';
      setError(errorMessage);
      appLogger.error('PlacesAutocomplete initialization error:', err);
    }
  }, [isLoaded, countryRestrictions]);

  // Handle place selection
  const handlePlaceChanged = useCallback(() => {
    if (!autocompleteRef.current) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const place = autocompleteRef.current.getPlace();

      // Validate place data
      if (!place.geometry || !place.geometry.location) {
        setError('Location not found. Please try a different search term.');
        setIsLoading(false);
        return;
      }

      // Extract coordinates from Places API geometry data
      // Note: We use Places API geometry.location, NOT Geocoding API
      // This eliminates the need for Google Geocoding API
      const latitude = place.geometry.location.lat();
      const longitude = place.geometry.location.lng();

      // Track Places API usage for billing safety
      trackApiUsage('places');

      // Create place data object
      const placeData: PlaceData = {
        placeId: place.place_id || '',
        name: place.name || '',
        formattedAddress: place.formatted_address || '',
        coordinates: {
          latitude,
          longitude,
        },
      };

      // Update state
      setSelectedPlace(placeData);
      setCoordinates({ latitude, longitude });
      setInputValue(place.formatted_address || place.name || '');

      // Log place data if enabled
      if (enableLogging) {
        appLogger.info('📍 Place Selected:', {
          name: placeData.name,
          formattedAddress: placeData.formattedAddress,
          latitude: placeData.coordinates.latitude,
          longitude: placeData.coordinates.longitude,
          placeId: placeData.placeId,
        });
      }

      // Call callback if provided
      if (onPlaceSelect) {
        onPlaceSelect(placeData);
      }

      setIsLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process selected place';
      setError(errorMessage);
      setIsLoading(false);
      appLogger.error('PlacesAutocomplete place selection error:', err);
    }
  }, [onPlaceSelect, enableLogging]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Clear error and selected place when user types
    if (error) {
      setError('');
    }
    if (selectedPlace && value !== selectedPlace.formattedAddress && value !== selectedPlace.name) {
      setSelectedPlace(null);
      setCoordinates(null);
    }
  };

  // Handle input blur (optional: keep selected value)
  const handleInputBlur = () => {
    // Optionally restore the selected place's address if input is cleared
    if (!inputValue.trim() && selectedPlace) {
      setInputValue(selectedPlace.formattedAddress || selectedPlace.name);
    }
  };

  // Reset function removed - was unused
  // If needed in the future, can be added back and exported via ref

  // PRODUCTION SAFETY: Check for missing API key before attempting to load
  // This prevents "NoApiKeys" error and shows user-friendly message
  if (!isApiKeyValid) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2 text-amber-600 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Google Maps API Key Missing</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {import.meta.env.PROD 
                ? 'Please configure VITE_GOOGLE_MAPS_API_KEY in your deployment environment.'
                : 'Please set VITE_GOOGLE_MAPS_API_KEY in your .env file.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while API is loading
  if (!isLoaded && !loadError) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading Places API...</span>
        </div>
      </div>
    );
  }

  // Show error if API failed to load (e.g., invalid key, network issues)
  if (loadError) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2 text-red-600 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load Google Places API</p>
            <p className="text-xs text-red-500 mt-1">
              {loadError.message || 'Please check your API key and network connection.'}
            </p>
            {import.meta.env.PROD && (
              <p className="text-xs text-red-400 mt-1">
                Verify VITE_GOOGLE_MAPS_API_KEY is set correctly in your deployment environment.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <MapPin className="w-5 h-5" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          disabled={disabled || !isLoaded}
          className={`
            w-full pl-10 pr-4 py-2.5
            border rounded-lg
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            ${error ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'}
          `}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 flex items-start gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Selected Place Info */}
      {selectedPlace && showCoordinates && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {selectedPlace.name}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            {selectedPlace.formattedAddress}
          </p>
          <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-500">
            <span>
              Lat: <span className="font-mono font-semibold">{coordinates?.latitude.toFixed(6)}</span>
            </span>
            <span>
              Lng: <span className="font-mono font-semibold">{coordinates?.longitude.toFixed(6)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlacesAutocomplete;

