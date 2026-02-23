/**
 * Integrated Location Picker with Reverse Geocoding
 * 
 * This component demonstrates the complete flow:
 * 1. User selects a place using Google Places Autocomplete
 * 2. Coordinates are extracted from Places API geometry (NOT Geocoding API)
 * 3. Reverse geocoding is performed using OpenStreetMap Nominatim
 * 4. Formatted address is displayed in the UI
 * 
 * This is a production-ready example showing best practices:
 * - Environment variable for API key (never hardcoded)
 * - Places API geometry data (no Geocoding API)
 * - OpenStreetMap Nominatim for reverse geocoding (fallback)
 */

import React, { useState, useCallback } from 'react';
import PlacesAutocomplete, { PlaceData } from './PlacesAutocomplete';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { MapPin, Loader2, AlertCircle, CheckCircle2, Globe } from 'lucide-react';

import { appLogger } from '../shared/logger';
interface LocationPickerWithReverseGeocodeProps {
  /**
   * Callback when location is selected
   * @param data - Contains coordinates and address
   */
  onLocationSelect?: (data: {
    coordinates: { latitude: number; longitude: number };
    address: string;
    placeData: PlaceData;
  }) => void;
  /**
   * Initial coordinates (optional)
   */
  initialCoordinates?: { latitude: number; longitude: number } | null;
  /**
   * Placeholder for autocomplete input
   */
  placeholder?: string;
  /**
   * Whether to show detailed address information
   */
  showDetails?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const LocationPickerWithReverseGeocode: React.FC<LocationPickerWithReverseGeocodeProps> = ({
  onLocationSelect,
  initialCoordinates,
  placeholder = 'Search for a location...',
  showDetails = true,
  className = '',
}) => {
  // State for selected place
  const [selectedPlace, setSelectedPlace] = useState<PlaceData | null>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    initialCoordinates || null
  );

  // Reverse geocoding hook (using OpenStreetMap Nominatim)
  const { geocode, result: reverseGeocodeResult, isLoading: isReverseGeocoding, error: reverseGeocodeError } = useReverseGeocode({
    language: 'en',
    includeRaw: false,
  });

  // Handle place selection from Places Autocomplete
  const handlePlaceSelect = useCallback(
    async (placeData: PlaceData) => {
      // Update state with selected place
      setSelectedPlace(placeData);
      setCoordinates(placeData.coordinates);

      // Perform reverse geocoding using OpenStreetMap Nominatim
      // This provides a readable address as a fallback
      // Note: We already have formatted_address from Places API,
      // but reverse geocoding gives us additional address components
      try {
        await geocode(placeData.coordinates.latitude, placeData.coordinates.longitude);
      } catch (error) {
        // Error is handled by the hook, but we can still use Places API address
        appLogger.warn('Reverse geocoding failed, using Places API address:', error);
      }

      // Call parent callback if provided
      if (onLocationSelect) {
        onLocationSelect({
          coordinates: placeData.coordinates,
          address: placeData.formattedAddress,
          placeData,
        });
      }
    },
    [geocode, onLocationSelect]
  );

  // Get display address (prefer reverse geocode result, fallback to Places API)
  const displayAddress = reverseGeocodeResult?.address || selectedPlace?.formattedAddress || '';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Places Autocomplete Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Search Location
        </label>
        <PlacesAutocomplete
          placeholder={placeholder}
          onPlaceSelect={handlePlaceSelect}
          showCoordinates={false}
          enableLogging={false}
          countryRestrictions={['in']} // Optional: restrict to India
        />
      </div>

      {/* Loading State - Reverse Geocoding */}
      {isReverseGeocoding && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Getting address details...</span>
          </div>
        </div>
      )}

      {/* Error State - Reverse Geocoding */}
      {reverseGeocodeError && selectedPlace && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300">
                Using address from Places API
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                Reverse geocoding unavailable, but location is valid
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selected Location Display */}
      {selectedPlace && coordinates && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">
                Selected Location
              </p>

              {/* Place Name */}
              <div className="mb-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Place Name</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedPlace.name}
                </p>
              </div>

              {/* Address */}
              <div className="mb-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Address</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {displayAddress}
                </p>
                {reverseGeocodeResult && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Address from OpenStreetMap Nominatim
                  </p>
                )}
                {!reverseGeocodeResult && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Address from Google Places API
                  </p>
                )}
              </div>

              {/* Coordinates */}
              <div className="mb-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Coordinates</p>
                <div className="flex gap-4 text-xs font-mono">
                  <span>
                    <span className="text-gray-500 dark:text-gray-400">Lat:</span>{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {coordinates.latitude.toFixed(6)}
                    </span>
                  </span>
                  <span>
                    <span className="text-gray-500 dark:text-gray-400">Lng:</span>{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {coordinates.longitude.toFixed(6)}
                    </span>
                  </span>
                </div>
              </div>

              {/* Detailed Address Components (if available) */}
              {showDetails && reverseGeocodeResult?.components && (
                <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address Components
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {reverseGeocodeResult.components.road && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Road:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {reverseGeocodeResult.components.road}
                        </span>
                      </div>
                    )}
                    {reverseGeocodeResult.components.city && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">City:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {reverseGeocodeResult.components.city}
                        </span>
                      </div>
                    )}
                    {reverseGeocodeResult.components.state && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">State:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {reverseGeocodeResult.components.state}
                        </span>
                      </div>
                    )}
                    {reverseGeocodeResult.components.postcode && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Postcode:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {reverseGeocodeResult.components.postcode}
                        </span>
                      </div>
                    )}
                    {reverseGeocodeResult.components.country && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Country:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {reverseGeocodeResult.components.country}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Technical Info */}
              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <strong>Note:</strong> Coordinates extracted from Google Places API geometry data.
                  Address obtained via OpenStreetMap Nominatim reverse geocoding (fallback).
                  No Google Geocoding API used.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationPickerWithReverseGeocode;

